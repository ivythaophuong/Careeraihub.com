-- Phase 1 foundation (contracts v1.0). DESIGN: not applied to any database.
-- Written from docs/contracts/README.md. Apply only after the test database run (see README.md here) and the owner's approval.
--
-- Creates: career_profiles, career_targets, evidence (+ evidence_current and evidence_active views), trusted_issuers,
--          verification_requests, verification_attempts, consents, and the server functions
--          start_verification / apply_verification_attempt / purge_raw_credential / has_consent.
-- Creates NO score and no Verified Trust engine (contract decision 9).
--
-- Roles: "browser" = anon, authenticated. The verification service uses service_role (bypasses RLS).
-- The pattern `current_user in ('anon','authenticated')` is the same one used by the 2026-10-05 migration.

begin;

-- ── helpers ─────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at := now(); return new; end $$;

-- ── 1. career_profiles: the candidate's canonical identity (one per user) ───
create table public.career_profiles (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  full_name    text,
  headline     text,
  summary      text,
  location     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint career_profiles_lengths check (
    char_length(coalesce(full_name, '')) <= 200 and char_length(coalesce(headline, '')) <= 300
    and char_length(coalesce(summary, '')) <= 5000 and char_length(coalesce(location, '')) <= 200)
);
create trigger trg_career_profiles_touch before update on public.career_profiles
  for each row execute function public.touch_updated_at();

-- ── 2. career_targets: what the candidate is aiming for (referenced by scores as target_id) ──
create table public.career_targets (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role_title   text not null check (char_length(role_title) between 1 and 200),
  level        text check (char_length(level) <= 100),
  market       text check (char_length(market) <= 100),
  jd_text      text check (char_length(jd_text) <= 20000),
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index career_targets_one_primary on public.career_targets (candidate_id) where is_primary;
create index career_targets_candidate on public.career_targets (candidate_id);
create trigger trg_career_targets_touch before update on public.career_targets
  for each row execute function public.touch_updated_at();

-- ── 3. evidence: claim + artifact references + summary of the latest verification ──
create table public.evidence (
  id                  uuid primary key default gen_random_uuid(),
  candidate_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type                text not null check (type in ('identity','education','certification','experience','project','skill','achievement')),
  claim               text not null check (char_length(claim) between 1 and 2000),
  source_type         text not null check (source_type in ('user_claim','user_upload','platform_url','signed_credential','issuer_api','employer_attestation')),
  source_url          text check (char_length(source_url) <= 2048),
  source_provider     text check (char_length(source_provider) <= 255),
  -- immutable versions: an edit inserts a new row that supersedes the old one
  version             int  not null default 1 check (version >= 1),
  supersedes_id       uuid references public.evidence(id),
  -- summary of the latest verification (history is in verification_attempts)
  verification_status text not null default 'UNVERIFIED' check (verification_status in ('UNVERIFIED','PENDING','VERIFIED','FAILED','REVOKED','EXPIRED')),
  trust_status        text not null default 'NOT_ELIGIBLE' check (trust_status in ('NOT_ELIGIBLE','ELIGIBLE')),
  verification_method text not null default 'none' check (verification_method in ('none','platform_page','opencerts','open_badges','issuer_api','manual_review')),
  confidence          text check (confidence in ('LOW','MEDIUM','HIGH')),
  checks              jsonb not null default '{}'::jsonb check (jsonb_typeof(checks) = 'object'),
  subject_id          text check (char_length(subject_id) <= 500),
  subject_binding     text not null default 'none' check (subject_binding in ('none','email_verified','did_proof','profile_name_hint')),
  raw_credential      jsonb,
  valid_from          timestamptz,
  valid_until         timestamptz,
  status_url          text check (char_length(status_url) <= 2048),
  created_by          uuid references auth.users(id) default auth.uid(),   -- the candidate; null if the system created it
  verified_by         text,                                                -- 'verifier:<adapter>:<version>', never a user
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  verified_at         timestamptz,
  withdrawn_at        timestamptz,   -- the candidate stopped using this claim; never a delete, never a revocation
  raw_purged_at       timestamptz,   -- when raw_credential was purged under the retention policy
  constraint evidence_version_matches_chain check ((supersedes_id is null) = (version = 1)),
  constraint evidence_verified_by_is_a_service check (verified_by is null or verified_by like 'verifier:%'),
  constraint evidence_final_states_have_a_verifier check (
    verification_status in ('UNVERIFIED','PENDING') or (verified_by is not null and verified_at is not null)),
  constraint evidence_identity_keeps_no_document check (type <> 'identity' or raw_credential is null),
  constraint evidence_withdrawn_is_not_trusted check (withdrawn_at is null or trust_status = 'NOT_ELIGIBLE'),
  constraint evidence_platform_page_never_high check (not (verification_method = 'platform_page' and confidence = 'HIGH')),
  -- VALID CREDENTIAL ≠ VERIFIED CANDIDATE EVIDENCE: trust needs verified + issuer trusted + recipient bound
  constraint evidence_trust_requires_binding check (
    trust_status = 'NOT_ELIGIBLE' or (
      verification_status = 'VERIFIED'
      and subject_binding in ('email_verified','did_proof')
      and checks ->> 'issuer_trusted' = 'true'
      and checks ->> 'recipient_binding_verified' = 'true'))
);
create unique index evidence_one_successor on public.evidence (supersedes_id) where supersedes_id is not null;
create index evidence_candidate_type on public.evidence (candidate_id, type);
create index evidence_status on public.evidence (verification_status);

create view public.evidence_current with (security_invoker = true) as
  select e.* from public.evidence e
  where not exists (select 1 from public.evidence s where s.supersedes_id = e.id);

-- Only ACTIVE evidence (latest version, not withdrawn) may feed a future trust calculation.
create view public.evidence_active with (security_invoker = true) as
  select * from public.evidence_current where withdrawn_at is null;

-- Insert guard: whoever inserts, the version follows the chain; a browser can only create a clean, unverified claim.
create or replace function public.evidence_before_insert() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare prev public.evidence;
begin
  if new.supersedes_id is not null then
    select * into prev from public.evidence where id = new.supersedes_id;
    if not found then raise exception 'superseded evidence not found' using errcode = '23503'; end if;
    if prev.candidate_id <> new.candidate_id then
      raise exception 'evidence can only supersede the same candidate''s evidence' using errcode = '42501';
    end if;
    if prev.withdrawn_at is not null then
      raise exception 'withdrawn evidence cannot be superseded; add it again as a new claim' using errcode = '23514';
    end if;
    new.version := prev.version + 1;
  else
    new.version := 1;
  end if;
  if current_user in ('anon','authenticated') then
    new.verification_status := 'UNVERIFIED'; new.trust_status := 'NOT_ELIGIBLE';
    new.verification_method := 'none'; new.confidence := null; new.checks := '{}'::jsonb;
    new.subject_binding := 'none'; new.verified_by := null; new.verified_at := null;
    new.withdrawn_at := null; new.raw_purged_at := null;
    new.created_by := auth.uid();
  end if;
  return new;
end $$;
create trigger trg_evidence_before_insert before insert on public.evidence
  for each row execute function public.evidence_before_insert();

-- Update guard. Claim and artifact fields are immutable for everyone (raw_credential can only be purged to NULL).
-- A browser may do exactly one thing: withdraw its own evidence, once. verification_status moves only along the
-- allowed transitions.
create or replace function public.evidence_before_update() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user in ('anon','authenticated') and
     not (old.withdrawn_at is null and new.withdrawn_at is not null) then
    raise exception 'evidence cannot be edited from the browser; add a new version, or withdraw it' using errcode = '42501';
  end if;
  if (new.candidate_id, new.type, new.claim, new.source_type, new.source_url, new.source_provider,
      new.version, new.supersedes_id, new.created_by, new.created_at)
     is distinct from
     (old.candidate_id, old.type, old.claim, old.source_type, old.source_url, old.source_provider,
      old.version, old.supersedes_id, old.created_by, old.created_at) then
    raise exception 'evidence claim and artifact fields are immutable; insert a new version instead' using errcode = '42501';
  end if;
  if new.raw_credential is distinct from old.raw_credential then
    if new.raw_credential is not null then
      raise exception 'raw_credential is immutable; it can only be purged' using errcode = '42501';
    end if;
    new.raw_purged_at := now();
  end if;
  if new.withdrawn_at is distinct from old.withdrawn_at then
    if old.withdrawn_at is not null then raise exception 'evidence is already withdrawn' using errcode = '42501'; end if;
    new.withdrawn_at := now();
    new.trust_status := 'NOT_ELIGIBLE';
  end if;
  if new.verification_status is distinct from old.verification_status and not (
       (old.verification_status = 'UNVERIFIED' and new.verification_status = 'PENDING')
    or (old.verification_status = 'PENDING'    and new.verification_status in ('VERIFIED','FAILED'))
    or (old.verification_status = 'VERIFIED'   and new.verification_status in ('REVOKED','EXPIRED'))
    or (old.verification_status in ('FAILED','EXPIRED') and new.verification_status = 'PENDING')) then
    raise exception 'illegal verification transition % -> %', old.verification_status, new.verification_status using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_evidence_before_update before update on public.evidence
  for each row execute function public.evidence_before_update();

-- ── 4. trusted_issuers: a versioned CareerAiHub policy, edited by admins only ──
create table public.trusted_issuers (
  id                  uuid primary key default gen_random_uuid(),
  issuer_identifier   text not null check (char_length(issuer_identifier) between 1 and 500),  -- domain or DID
  issuer_name         text not null,
  issuer_type         text not null check (issuer_type in ('university','polytechnic','professional_body','employer','international_institution','platform','other')),
  verification_method text not null check (verification_method in ('platform_page','opencerts','open_badges','issuer_api','manual_review')),
  allowed_domains     text[] not null default '{}',
  status              text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED')),
  effective_from      timestamptz not null default now(),
  effective_until     timestamptz,
  policy_version      text not null,
  added_by            text,
  notes               text,
  created_at          timestamptz not null default now(),
  constraint trusted_issuers_window check (effective_until is null or effective_until > effective_from),
  constraint trusted_issuers_one_per_policy unique (issuer_identifier, verification_method, policy_version)
);
alter table public.trusted_issuers enable row level security;   -- no browser policy: service role only

-- ── 5. verification_requests: the candidate asks; the service answers ──
create table public.verification_requests (
  id               uuid primary key default gen_random_uuid(),
  evidence_id      uuid not null references public.evidence(id) on delete cascade,
  evidence_version int  not null,
  candidate_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trigger          text not null default 'candidate' check (trigger in ('candidate','recheck')),
  status           text not null default 'QUEUED' check (status in ('QUEUED','RUNNING','DONE','CANCELLED')),
  requested_at     timestamptz not null default now(),
  started_at       timestamptz,
  finished_at      timestamptz
);
create unique index verification_requests_one_open on public.verification_requests (evidence_id) where status in ('QUEUED','RUNNING');
create index verification_requests_candidate on public.verification_requests (candidate_id, requested_at desc);

create or replace function public.verification_requests_before_insert() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare ev public.evidence;
begin
  select * into ev from public.evidence where id = new.evidence_id;
  if not found then raise exception 'evidence not found' using errcode = '23503'; end if;
  new.evidence_version := ev.version;
  if current_user in ('anon','authenticated') then
    if ev.candidate_id <> auth.uid() then raise exception 'not your evidence' using errcode = '42501'; end if;
    if ev.withdrawn_at is not null then raise exception 'withdrawn evidence cannot be sent for verification' using errcode = '23514'; end if;
    if exists (select 1 from public.evidence s where s.supersedes_id = ev.id) then
      raise exception 'this evidence has a newer version; verify that one' using errcode = '23514'; end if;
    if ev.verification_status not in ('UNVERIFIED','FAILED','EXPIRED') then
      raise exception 'evidence in state % cannot be sent for verification', ev.verification_status using errcode = '23514'; end if;
    if (select count(*) from public.verification_requests
        where candidate_id = auth.uid() and requested_at > now() - interval '1 hour') >= 5 then
      raise exception 'verification limit reached: 5 requests per hour' using errcode = '54000'; end if;
    new.candidate_id := auth.uid(); new.trigger := 'candidate'; new.status := 'QUEUED';
    new.started_at := null; new.finished_at := null; new.requested_at := now();
  else
    new.candidate_id := ev.candidate_id;
  end if;
  return new;
end $$;
create trigger trg_verification_requests_before_insert before insert on public.verification_requests
  for each row execute function public.verification_requests_before_insert();

-- ── 6. verification_attempts: append-only audit trail ──
create table public.verification_attempts (
  id                      uuid primary key default gen_random_uuid(),
  evidence_id             uuid not null references public.evidence(id) on delete cascade,
  evidence_version        int  not null,
  verification_request_id uuid references public.verification_requests(id) on delete set null,
  provider                text not null,
  adapter_version         text not null,
  policy_version          text not null,
  started_at              timestamptz not null,
  finished_at             timestamptz not null default now(),
  outcome                 text not null check (outcome in ('VERIFIED','FAILED','REVOKED','EXPIRED','ERROR')),
  previous_status         text not null check (previous_status in ('UNVERIFIED','PENDING','VERIFIED','FAILED','REVOKED','EXPIRED')),
  new_status              text not null check (new_status in ('UNVERIFIED','PENDING','VERIFIED','FAILED','REVOKED','EXPIRED')),
  checks                  jsonb not null check (jsonb_typeof(checks) = 'object'),
  raw_result              jsonb,
  error                   text
);
create index verification_attempts_evidence on public.verification_attempts (evidence_id, finished_at);

-- Append-only, with two deliberate exceptions: (1) raw_result may be redacted to NULL (retention); (2) rows may be
-- deleted only as a cascade from deleting the evidence or the account (pg_trigger_depth() > 1), so erasure works.
create or replace function public.verification_attempts_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then return old; end if;
    raise exception 'verification_attempts is append-only' using errcode = '42501';
  end if;
  if new.raw_result is null and old.raw_result is not null
     and (to_jsonb(new) - 'raw_result') = (to_jsonb(old) - 'raw_result') then
    return new;
  end if;
  raise exception 'verification_attempts is append-only' using errcode = '42501';
end $$;
create trigger trg_verification_attempts_append_only before update or delete on public.verification_attempts
  for each row execute function public.verification_attempts_guard();

-- ── 7. consents: consent-first; no row = PRIVATE ──
create table public.consents (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  employer_id  uuid not null references public.employers(id) on delete cascade,        -- who
  scope        jsonb not null check (jsonb_typeof(scope) = 'object' and scope ? 'parts' and jsonb_typeof(scope -> 'parts') = 'array'),  -- what
  purpose      text not null check (purpose in ('recruiter_review','matching','verification_share')),
  granted_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  constraint consents_window check (expires_at > granted_at and expires_at <= granted_at + interval '365 days')
);
create index consents_candidate on public.consents (candidate_id);
create index consents_employer on public.consents (employer_id) where revoked_at is null;

create or replace function public.consents_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if current_user in ('anon','authenticated') then
      new.candidate_id := auth.uid(); new.granted_at := now(); new.revoked_at := null;
    end if;
    return new;
  end if;
  -- UPDATE: a consent can only be revoked, once
  if (new.id, new.candidate_id, new.employer_id, new.scope, new.purpose, new.granted_at, new.expires_at)
     is distinct from (old.id, old.candidate_id, old.employer_id, old.scope, old.purpose, old.granted_at, old.expires_at) then
    raise exception 'a consent cannot be edited; revoke it and grant a new one' using errcode = '42501';
  end if;
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'consent is already revoked' using errcode = '42501';
  end if;
  if new.revoked_at is not null and old.revoked_at is null then new.revoked_at := now(); end if;
  return new;
end $$;
create trigger trg_consents_guard before insert or update on public.consents
  for each row execute function public.consents_guard();

create or replace function public.has_consent(p_candidate uuid, p_employer uuid, p_purpose text, p_part text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.consents c
    where c.candidate_id = p_candidate and c.employer_id = p_employer and c.purpose = p_purpose
      and c.revoked_at is null and c.expires_at > now()
      and c.scope -> 'parts' ? p_part)
$$;

-- ── 8. server functions: the only way evidence becomes VERIFIED ──
create or replace function public.start_verification(p_request_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.verification_requests;
begin
  select * into r from public.verification_requests where id = p_request_id for update;
  if not found then raise exception 'request not found' using errcode = '23503'; end if;
  if r.status <> 'QUEUED' then raise exception 'request is %', r.status using errcode = '23514'; end if;
  update public.evidence set verification_status = 'PENDING' where id = r.evidence_id and verification_status in ('UNVERIFIED','FAILED','EXPIRED');
  update public.verification_requests set status = 'RUNNING', started_at = now() where id = r.id;
end $$;

create or replace function public.apply_verification_attempt(
  p_evidence_id uuid, p_request_id uuid, p_provider text, p_adapter_version text, p_policy_version text,
  p_started_at timestamptz, p_outcome text, p_method text, p_confidence text, p_checks jsonb,
  p_subject_id text, p_subject_binding text, p_raw jsonb, p_error text,
  p_valid_from timestamptz default null, p_valid_until timestamptz default null, p_status_url text default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  ev public.evidence;
  new_status text;
  eligible boolean;
  attempt_id uuid;
begin
  select * into ev from public.evidence where id = p_evidence_id for update;
  if not found then raise exception 'evidence not found' using errcode = '23503'; end if;
  if exists (select 1 from public.evidence s where s.supersedes_id = ev.id) then
    raise exception 'evidence has a newer version' using errcode = '23514'; end if;

  new_status := case
    when p_outcome = 'ERROR' then case when ev.verification_status = 'PENDING' then 'FAILED' else ev.verification_status end
    else p_outcome end;

  -- trust eligibility is a separate layer from verification (contracts: evidence)
  eligible := ev.withdrawn_at is null
    and p_outcome = 'VERIFIED'
    and coalesce(p_checks ->> 'credential_valid', '') = 'true'
    and coalesce(p_checks ->> 'signature_valid', '') = 'true'
    and coalesce(p_checks ->> 'issuer_trusted', '') = 'true'
    and coalesce(p_checks ->> 'recipient_binding_verified', '') = 'true'
    and coalesce(p_checks ->> 'revocation_checked', '') <> 'false'
    and coalesce(p_checks ->> 'expiration_valid', '') <> 'false'
    and p_subject_binding in ('email_verified','did_proof');

  insert into public.verification_attempts (evidence_id, evidence_version, verification_request_id, provider, adapter_version,
      policy_version, started_at, outcome, previous_status, new_status, checks, raw_result, error)
  values (ev.id, ev.version, p_request_id, p_provider, p_adapter_version, p_policy_version, p_started_at, p_outcome,
      ev.verification_status, new_status, p_checks, p_raw, p_error)
  returning id into attempt_id;

  update public.evidence set
      verification_status = new_status,
      trust_status        = case when eligible and new_status = 'VERIFIED' then 'ELIGIBLE' else 'NOT_ELIGIBLE' end,
      verification_method = coalesce(p_method, verification_method),
      confidence          = p_confidence,
      checks              = p_checks,
      subject_id          = coalesce(p_subject_id, subject_id),
      subject_binding     = coalesce(p_subject_binding, subject_binding),
      valid_from          = coalesce(p_valid_from, valid_from),
      valid_until         = coalesce(p_valid_until, valid_until),
      status_url          = coalesce(p_status_url, status_url),
      verified_by         = case when new_status in ('VERIFIED','FAILED','REVOKED','EXPIRED') then 'verifier:' || p_provider || ':' || p_adapter_version else verified_by end,
      verified_at         = case when new_status in ('VERIFIED','FAILED','REVOKED','EXPIRED') then now() else verified_at end
  where id = ev.id;

  if p_request_id is not null then
    update public.verification_requests set status = 'DONE', finished_at = now() where id = p_request_id;
  end if;
  return attempt_id;
end $$;

create or replace function public.purge_raw_credential(p_evidence_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.evidence set raw_credential = null where id = p_evidence_id and raw_credential is not null;
  update public.verification_attempts set raw_result = null where evidence_id = p_evidence_id and raw_result is not null;
end $$;

-- ── 9. privileges: nothing by default, then the minimum ──
revoke all on public.career_profiles, public.career_targets, public.evidence, public.evidence_current, public.evidence_active, public.trusted_issuers,
  public.verification_requests, public.verification_attempts, public.consents from anon, authenticated;

grant select, insert, delete on public.career_profiles to authenticated;
grant update (full_name, headline, summary, location) on public.career_profiles to authenticated;
grant insert (full_name, headline, summary, location) on public.career_profiles to authenticated;

grant select, delete on public.career_targets to authenticated;
grant insert (role_title, level, market, jd_text, is_primary) on public.career_targets to authenticated;
grant update (role_title, level, market, jd_text, is_primary) on public.career_targets to authenticated;

grant select on public.evidence, public.evidence_current, public.evidence_active to authenticated;
grant update (withdrawn_at) on public.evidence to authenticated;
grant insert (type, claim, source_type, source_url, source_provider, supersedes_id, raw_credential) on public.evidence to authenticated;

grant select on public.verification_requests to authenticated;
grant insert (evidence_id) on public.verification_requests to authenticated;

grant select on public.verification_attempts to authenticated;

grant select on public.consents to authenticated;
grant insert (employer_id, scope, purpose, expires_at) on public.consents to authenticated;
grant update (revoked_at) on public.consents to authenticated;

revoke execute on function public.start_verification(uuid), public.has_consent(uuid, uuid, text, text), public.purge_raw_credential(uuid) from public, anon, authenticated;
revoke execute on function public.apply_verification_attempt(uuid, uuid, text, text, text, timestamptz, text, text, text, jsonb, text, text, jsonb, text, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.start_verification(uuid), public.has_consent(uuid, uuid, text, text), public.purge_raw_credential(uuid) to service_role;
grant execute on function public.apply_verification_attempt(uuid, uuid, text, text, text, timestamptz, text, text, text, jsonb, text, text, jsonb, text, timestamptz, timestamptz, text) to service_role;
grant all on public.career_profiles, public.career_targets, public.evidence, public.evidence_current, public.evidence_active, public.trusted_issuers,
  public.verification_requests, public.verification_attempts, public.consents to service_role;

-- ── 10. row level security: each person sees only their own rows ──
alter table public.career_profiles       enable row level security;
alter table public.career_targets        enable row level security;
alter table public.evidence              enable row level security;
alter table public.verification_requests enable row level security;
alter table public.verification_attempts enable row level security;
alter table public.consents              enable row level security;

create policy "own profile"          on public.career_profiles       for all    using (candidate_id = auth.uid()) with check (candidate_id = auth.uid());
create policy "own targets"          on public.career_targets        for all    using (candidate_id = auth.uid()) with check (candidate_id = auth.uid());
create policy "read own evidence"    on public.evidence              for select using (candidate_id = auth.uid());
create policy "add own evidence"     on public.evidence              for insert with check (candidate_id = auth.uid());
create policy "withdraw own evidence" on public.evidence             for update using (candidate_id = auth.uid()) with check (candidate_id = auth.uid());
create policy "read own requests"    on public.verification_requests for select using (candidate_id = auth.uid());
create policy "add own request"      on public.verification_requests for insert with check (candidate_id = auth.uid());
create policy "read own attempts"    on public.verification_attempts for select
  using (exists (select 1 from public.evidence e where e.id = verification_attempts.evidence_id and e.candidate_id = auth.uid()));
create policy "read own consents"    on public.consents              for select using (candidate_id = auth.uid());
create policy "grant own consent"    on public.consents              for insert with check (candidate_id = auth.uid());
create policy "revoke own consent"   on public.consents              for update using (candidate_id = auth.uid()) with check (candidate_id = auth.uid());

commit;
