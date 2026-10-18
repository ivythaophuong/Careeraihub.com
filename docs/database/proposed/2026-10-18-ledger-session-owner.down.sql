-- DOWN for 2026-10-18-ledger-session-owner.sql: puts back the body applied on 2026-10-15 (no session ownership check). Privileges are unchanged.
begin;
create or replace function public.reserve_ai_request(p_user uuid, p_key text, p_hash text, p_feature text, p_session uuid, p_est_tokens int)
returns table (outcome text, request_id uuid, gate_mode text, reason text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  pol public.ai_policies; lim jsonb; mode text; stale_s numeric; ex public.ai_requests; w public.user_usage_windows; active int; sess_tokens bigint; rid uuid;
begin
  if p_est_tokens < 0 then raise exception 'bad_estimate'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));      -- one user's competing requests are serialised (tabs and devices share one limit)
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
      select coalesce(sum(coalesce(settled_tokens, reserved_tokens)), 0) into sess_tokens from public.ai_requests where session_id = p_session;
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
revoke all on function public.reserve_ai_request(uuid,text,text,text,uuid,int) from public, anon, authenticated;
grant execute on function public.reserve_ai_request(uuid,text,text,text,uuid,int) to service_role;

commit;
