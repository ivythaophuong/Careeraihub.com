-- PROPOSED, NOT APPLIED. Practice sessions, submissions and the AI request ledger (revision 2 of PROPOSAL-practice-session-ledger-2026-10-13.md).
-- Project: CareerAiHub (ruibdsvrcctxgxctaxwe) only. Never run on ZenDMS (obtmsvhejvcfrkfyucev).
-- Additive: no existing table, column, policy or function is changed. `mock_sessions` is only written through complete_practice_session().
-- Decisions it implements (owner, 2026-10-15): D-1 conditional approval with the five amendments below, D-2 observe-only until limits are configured,
-- D-3 = C (no answer text and no audio on the server), D-5 cascade on account deletion, D-4 and D-6 later, B2 one global quota in V1.
-- Amendments over revision 1: (B1) stale reserved/started requests are expired so a crashed function cannot hold a slot for ever;
-- (B2) ai_policies carries a `feature` column (only 'global' is read in V1); (B3) every request records gate_mode and limits are validated;
-- (B4) fail-open/fail-closed is the Edge Function's decision, see the proposal (D-7); (B5) default table privileges are revoked and only the needed ones granted,
-- plus a partial index for counting concurrent requests.
-- Rollback: 2026-10-15-practice-ledger.down.sql (drops everything this file creates; it deletes stored sessions and the ledger).

begin;

-- ── Limits: versioned, validated, written by the owner only ───────────────────────────────────────────────────────────────────────────────
create or replace function public.ai_policy_limits_valid(l jsonb) returns boolean
language plpgsql immutable set search_path = public, pg_temp as $$
declare k text; v jsonb;
begin
  if l is null or jsonb_typeof(l) <> 'object' then return false; end if;
  for k, v in select * from jsonb_each(l) loop
    if k not in ('max_requests_per_day','max_tokens_per_day','max_concurrent','max_session_tokens','stale_after_seconds','unknown_settle_after_seconds') then return false; end if;
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <= 0 then return false; end if;
    if k = 'stale_after_seconds' and (v #>> '{}')::numeric < 30 then return false; end if;
  end loop;
  return true;
end $$;

create table public.ai_policies (
  version        int  not null,
  feature        text not null default 'global',   -- V1 reads only 'global'; per-feature limits are a later, additive step (no schema change)
  effective_from timestamptz not null,
  limits         jsonb not null,                    -- VALUES SET BY THE OWNER. keys: see ai_policy_limits_valid()
  note           text,
  primary key (feature, version),
  constraint ai_policies_limits_valid check (public.ai_policy_limits_valid(limits))
);

-- ── Sessions and submissions (no answer text: decision D-3 = C) ───────────────────────────────────────────────────────────────────────────
create table public.practice_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  persona          text not null,
  role             text not null default '',
  status           text not null default 'in_progress' check (status in ('in_progress','completed','abandoned')),
  questions        jsonb not null,
  question_set_version int not null default 1,
  policy_version   int,
  mock_session_id  uuid unique,
  created_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at     timestamptz
);
create index practice_sessions_user on public.practice_sessions (user_id, created_at desc);

create table public.practice_submissions (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.practice_sessions(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  question_index int  not null check (question_index >= 0),
  question_hash  text not null,
  revision       int  not null default 1,
  is_counted     boolean not null default false,
  answer_hash    text not null,
  answer_chars   int  not null check (answer_chars between 1 and 3000),
  status         text not null check (status in ('received','evaluating','evaluated','failed','unknown')),
  feedback       jsonb,
  score          int check (score between 0 and 100),
  request_id     uuid,
  created_at     timestamptz not null default now(),
  unique (session_id, question_index, revision)
);
create unique index practice_one_counted on public.practice_submissions (session_id, question_index) where is_counted;
create index practice_submissions_user on public.practice_submissions (user_id);

-- ── The ledger: requests and usage windows ────────────────────────────────────────────────────────────────────────────────────────────────
create table public.ai_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  feature         text not null,
  session_id      uuid references public.practice_sessions(id) on delete set null,
  idempotency_key text not null,
  payload_hash    text not null,
  state           text not null check (state in ('reserved','started','completed','failed','cancelled','unknown_pending')),
  gate_mode       text not null check (gate_mode in ('observe','enforce')),
  reserved_tokens int  not null default 0 check (reserved_tokens >= 0),
  settled_tokens  int,
  settled_basis   text check (settled_basis in ('reported','reserved_upper_bound','none')),
  input_tokens    int, output_tokens int, thinking_tokens int,
  provider        text, model text,
  policy_version  int,
  correlation_id  uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  settled_at      timestamptz,
  unique (user_id, idempotency_key)
);
create index ai_requests_active on public.ai_requests (user_id) where state in ('reserved','started');
create index ai_requests_session on public.ai_requests (session_id) where session_id is not null;

create table public.user_usage_windows (
  user_id         uuid not null references auth.users(id) on delete cascade,
  window_start    date not null,
  requests        int    not null default 0,
  reserved_tokens bigint not null default 0,
  settled_tokens  bigint not null default 0,
  primary key (user_id, window_start)
);

-- ── Functions (service role only; security definer; fixed search_path) ─────────────────────────────────────────────────────────────────────
create or replace function public._active_policy(p_feature text default 'global') returns public.ai_policies
language sql stable security definer set search_path = public, pg_temp as $$
  select * from public.ai_policies where feature = p_feature and effective_from <= now() order by effective_from desc, version desc limit 1 $$;

-- B1: a request that never settled (the function crashed or was killed) stops holding its concurrency slot; its reserved tokens stay counted.
create or replace function public.expire_stale_requests(p_older_than interval default interval '5 minutes') returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  update public.ai_requests set state = 'unknown_pending', updated_at = now()
   where state in ('reserved','started') and updated_at < now() - p_older_than;
  get diagnostics n = row_count; return n;
end $$;

create or replace function public.reserve_ai_request(p_user uuid, p_key text, p_hash text, p_feature text, p_session uuid, p_est_tokens int)
returns table (outcome text, request_id uuid, gate_mode text, reason text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  pol public.ai_policies; lim jsonb; mode text; stale_s numeric; ex public.ai_requests; w public.user_usage_windows; active int; sess_tokens bigint; rid uuid;
begin
  if p_est_tokens < 0 then raise exception 'bad_estimate'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));      -- one user's competing requests are serialised (tabs and devices share one limit)
  -- A session id must belong to the caller: the foreign key only proves the session exists, so without this a request could be attached to another user's session and spend its cap.
  if p_session is not null and not exists (select 1 from public.practice_sessions where id = p_session and user_id = p_user) then raise exception 'bad_session'; end if;
  pol := public._active_policy('global');
  lim := coalesce(pol.limits, '{}'::jsonb);
  mode := case when pol.version is null then 'observe' else 'enforce' end;
  stale_s := coalesce((lim ->> 'stale_after_seconds')::numeric, 300);
  update public.ai_requests set state = 'unknown_pending', updated_at = now()          -- B1, lazily and only for this user
   where user_id = p_user and state in ('reserved','started') and updated_at < now() - make_interval(secs => stale_s);

  select * into ex from public.ai_requests where user_id = p_user and idempotency_key = p_key;
  if found then
    if ex.payload_hash = p_hash then return query select 'existing'::text, ex.id, ex.gate_mode, null::text; return; end if;
    raise exception 'idempotency_conflict';
  end if;

  if mode = 'enforce' then
    select * into w from public.user_usage_windows where user_id = p_user and window_start = current_date;
    select count(*) into active from public.ai_requests where user_id = p_user and state in ('reserved','started');
    if lim ? 'max_concurrent' and active >= (lim ->> 'max_concurrent')::int then
      return query select 'limit_reached'::text, null::uuid, mode, 'concurrency'::text; return; end if;
    if lim ? 'max_requests_per_day' and coalesce(w.requests, 0) >= (lim ->> 'max_requests_per_day')::int then
      return query select 'limit_reached'::text, null::uuid, mode, 'requests'::text; return; end if;
    if lim ? 'max_tokens_per_day' and coalesce(w.reserved_tokens, 0) + coalesce(w.settled_tokens, 0) + p_est_tokens > (lim ->> 'max_tokens_per_day')::bigint then
      return query select 'limit_reached'::text, null::uuid, mode, 'tokens'::text; return; end if;
    if p_session is not null and lim ? 'max_session_tokens' then
      select coalesce(sum(coalesce(settled_tokens, reserved_tokens)), 0) into sess_tokens from public.ai_requests where session_id = p_session and user_id = p_user;
      if sess_tokens + p_est_tokens > (lim ->> 'max_session_tokens')::bigint then
        return query select 'limit_reached'::text, null::uuid, mode, 'session_tokens'::text; return; end if;
    end if;
  end if;

  insert into public.ai_requests (user_id, feature, session_id, idempotency_key, payload_hash, state, gate_mode, reserved_tokens, policy_version)
  values (p_user, p_feature, p_session, p_key, p_hash, 'reserved', mode, p_est_tokens, pol.version) returning id into rid;
  insert into public.user_usage_windows (user_id, window_start, requests, reserved_tokens) values (p_user, current_date, 1, p_est_tokens)
  on conflict (user_id, window_start) do update set requests = public.user_usage_windows.requests + 1, reserved_tokens = public.user_usage_windows.reserved_tokens + p_est_tokens;
  return query select 'reserved'::text, rid, mode, null::text;
end $$;

create or replace function public.mark_started(p_id uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.ai_requests set state = 'started', updated_at = now() where id = p_id and state = 'reserved' $$;

-- The server stopped waiting without knowing the outcome: free the slot, keep the tokens reserved (ADR-012, Approach B).
create or replace function public.mark_unknown(p_id uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.ai_requests set state = 'unknown_pending', updated_at = now() where id = p_id and state in ('reserved','started') $$;

create or replace function public._settle(p_id uuid, p_state text, p_in int, p_out int, p_think int, p_provider text, p_model text, p_basis text, p_amount int) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.ai_requests; amt int;
begin
  select * into r from public.ai_requests where id = p_id for update;
  if not found then raise exception 'unknown_request'; end if;
  if r.state in ('completed','failed','cancelled') then return r.state; end if;          -- a second settle is a no-op
  amt := p_amount;
  update public.ai_requests set state = p_state, settled_tokens = amt, settled_basis = p_basis, input_tokens = p_in, output_tokens = p_out, thinking_tokens = p_think,
    provider = coalesce(p_provider, provider), model = coalesce(p_model, model), settled_at = now(), updated_at = now() where id = p_id;
  update public.user_usage_windows set reserved_tokens = greatest(0, reserved_tokens - r.reserved_tokens), settled_tokens = settled_tokens + amt
   where user_id = r.user_id and window_start = r.created_at::date;
  return p_state;
end $$;

-- Outcome known. Missing usage keeps the reservation as the amount (never assumes zero cost).
create or replace function public.settle_ai_request(p_id uuid, p_state text, p_in int default null, p_out int default null, p_think int default null, p_provider text default null, p_model text default null) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare reserved int; amt int; basis text;
begin
  if p_state not in ('completed','failed','cancelled') then raise exception 'bad_state'; end if;
  select reserved_tokens into reserved from public.ai_requests where id = p_id;
  if reserved is null then raise exception 'unknown_request'; end if;
  if p_in is not null or p_out is not null or p_think is not null then
    amt := coalesce(p_in, 0) + coalesce(p_out, 0) + coalesce(p_think, 0); basis := 'reported';
  elsif p_state = 'completed' then amt := reserved; basis := 'reserved_upper_bound';
  else amt := 0; basis := 'none'; end if;
  return public._settle(p_id, p_state, p_in, p_out, p_think, p_provider, p_model, basis, amt);
end $$;

-- Old unknown requests are settled at their reserved amount, so exposure never exceeds what was reserved.
create or replace function public.expire_unknown_requests(p_older_than interval) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; n int := 0;
begin
  for r in select id, reserved_tokens from public.ai_requests where state = 'unknown_pending' and updated_at < now() - p_older_than loop
    perform public._settle(r.id, 'failed', null, null, null, null, null, 'reserved_upper_bound', r.reserved_tokens); n := n + 1;
  end loop;
  return n;
end $$;

-- Finish a session once: the average is computed here, from the counted and evaluated submissions only; a question never evaluated is not scored as 0.
create or replace function public.complete_practice_session(p_session uuid, p_user uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.practice_sessions; avg_score numeric; n int; mid uuid;
begin
  select * into s from public.practice_sessions where id = p_session and user_id = p_user for update;
  if not found then raise exception 'unknown_session'; end if;
  if s.mock_session_id is not null then return s.mock_session_id; end if;
  if s.status <> 'in_progress' then raise exception 'session_not_open'; end if;
  select count(*), avg(score) into n, avg_score from public.practice_submissions where session_id = p_session and is_counted and status = 'evaluated' and score is not null;
  if n = 0 then raise exception 'nothing_to_complete'; end if;
  insert into public.mock_sessions (user_id, mode, questions_count, avg_score) values (p_user, s.persona, n, round(avg_score)::int) returning id into mid;
  update public.practice_sessions set status = 'completed', completed_at = now(), mock_session_id = mid, last_activity_at = now() where id = p_session;
  return mid;
end $$;

-- ── Row level security and grants (B5): the default privileges of this project give anon and authenticated everything on a new table; take them back ──
alter table public.ai_policies          enable row level security;
alter table public.practice_sessions    enable row level security;
alter table public.practice_submissions enable row level security;
alter table public.ai_requests          enable row level security;
alter table public.user_usage_windows   enable row level security;

revoke all on public.ai_policies, public.practice_sessions, public.practice_submissions, public.ai_requests, public.user_usage_windows from public, anon, authenticated;
grant select on public.practice_sessions, public.ai_requests, public.user_usage_windows to authenticated;
grant select, delete on public.practice_sessions, public.practice_submissions to authenticated;
create policy practice_sessions_own_select    on public.practice_sessions    for select to authenticated using (user_id = auth.uid());
create policy practice_sessions_own_delete    on public.practice_sessions    for delete to authenticated using (user_id = auth.uid());
create policy practice_submissions_own_select on public.practice_submissions for select to authenticated using (user_id = auth.uid());
create policy practice_submissions_own_delete on public.practice_submissions for delete to authenticated using (user_id = auth.uid());
create policy ai_requests_own_select          on public.ai_requests          for select to authenticated using (user_id = auth.uid());
create policy user_usage_windows_own_select   on public.user_usage_windows   for select to authenticated using (user_id = auth.uid());
-- ai_policies: no policy and no grant for browser roles. service_role bypasses RLS.
grant all on public.ai_policies, public.practice_sessions, public.practice_submissions, public.ai_requests, public.user_usage_windows to service_role;

revoke all on function public.ai_policy_limits_valid(jsonb), public._active_policy(text), public.expire_stale_requests(interval), public.reserve_ai_request(uuid,text,text,text,uuid,int),
  public.mark_started(uuid), public.mark_unknown(uuid), public._settle(uuid,text,int,int,int,text,text,text,int), public.settle_ai_request(uuid,text,int,int,int,text,text),
  public.expire_unknown_requests(interval), public.complete_practice_session(uuid,uuid) from public, anon, authenticated;
grant execute on function public.expire_stale_requests(interval), public.reserve_ai_request(uuid,text,text,text,uuid,int), public.mark_started(uuid), public.mark_unknown(uuid),
  public.settle_ai_request(uuid,text,int,int,int,text,text), public.expire_unknown_requests(interval), public.complete_practice_session(uuid,uuid), public._active_policy(text), public.ai_policy_limits_valid(jsonb) to service_role;

commit;
