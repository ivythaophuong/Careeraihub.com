-- P0-5a (trust score integrity) + P0-6 (employer access).
-- Applied by hand in the Supabase SQL Editor on 2026-10-05. Tested first on an in-memory Postgres replica
-- (see replica-test/). Do not run it twice: the new policies already exist.
--
-- What this does
--   1. Functions that compute the trust score can no longer be called from the browser.
--   2. A browser can no longer write trust_score / ats_score / interview_score / star_score.
--   3. Employers must be VERIFIED (employers.verified_at, set only by an admin) to read candidate
--      profiles, create matches/pipeline rows, or have their job listings shown to the public.
--   4. employer_id / candidate_id on matches and pipeline rows can't be re-pointed from the browser.
--   5. Score columns on the three input tables are limited to 0..100.
--
-- "Browser" below means the Postgres roles `anon` and `authenticated`. Admin/SQL-editor sessions
-- (postgres) and the trust-score trigger (SECURITY DEFINER, owner) are not affected.

begin;

-- ── 1. Lock down the trust-score functions ───────────────────────────────────
revoke execute on function public.recompute_trust_score(uuid) from public, anon, authenticated;
revoke execute on function public.trigger_recompute_trust_score() from public, anon, authenticated;
alter function public.recompute_trust_score(uuid) set search_path = public, pg_temp;
alter function public.trigger_recompute_trust_score() set search_path = public, pg_temp;

-- ── 2. Browser can't write score columns ─────────────────────────────────────
-- SECURITY INVOKER on purpose: current_user is the caller. Inside recompute_trust_score
-- (SECURITY DEFINER) current_user is the owner, so the system's own writes pass through.
create or replace function public.lock_trust_columns() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.trust_score := 0; new.ats_score := 0; new.interview_score := 0; new.star_score := 0;
    else
      new.trust_score := old.trust_score; new.ats_score := old.ats_score;
      new.interview_score := old.interview_score; new.star_score := old.star_score;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_lock_trust_columns on public.candidate_trust_profiles;
create trigger trg_lock_trust_columns
  before insert or update on public.candidate_trust_profiles
  for each row execute function public.lock_trust_columns();

-- ── 3. Employer verification ─────────────────────────────────────────────────
alter table public.employers add column if not exists verified_at timestamptz;

create or replace function public.lock_employer_verification() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then new.verified_at := null; else new.verified_at := old.verified_at; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_lock_employer_verification on public.employers;
create trigger trg_lock_employer_verification
  before insert or update on public.employers
  for each row execute function public.lock_employer_verification();

-- Helpers read employers / employer_members / candidate_trust_profiles past their own RLS.
create or replace function public.employer_is_verified(p_employer_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.employers where id = p_employer_id and verified_at is not null)
$$;

-- True when the caller owns or belongs to a verified employer (any, or the given one).
create or replace function public.is_verified_employer_member(p_employer_id uuid default null) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.employers e
    where e.verified_at is not null
      and (p_employer_id is null or e.id = p_employer_id)
      and (e.owner_id = auth.uid()
           or exists (select 1 from public.employer_members em where em.employer_id = e.id and em.user_id = auth.uid()))
  )
$$;

create or replace function public.candidate_is_visible(p_user_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.candidate_trust_profiles where user_id = p_user_id and is_visible)
$$;

revoke execute on function public.employer_is_verified(uuid) from public;
revoke execute on function public.is_verified_employer_member(uuid) from public, anon;
revoke execute on function public.candidate_is_visible(uuid) from public, anon;
grant execute on function public.employer_is_verified(uuid) to anon, authenticated;
grant execute on function public.is_verified_employer_member(uuid) to authenticated;
grant execute on function public.candidate_is_visible(uuid) to authenticated;

-- Candidate profiles: only verified employers may read the visible ones.
drop policy if exists "recruiters can read visible profiles" on public.candidate_trust_profiles;
create policy "recruiters can read visible profiles" on public.candidate_trust_profiles
  for select using (is_visible = true and public.is_verified_employer_member());

-- Matches: verified employers only, and only for candidates who chose to be visible.
drop policy if exists "recruiter manages matches for their employer" on public.trust_matches;
create policy "verified recruiter reads matches" on public.trust_matches
  for select using (public.is_verified_employer_member(employer_id));
create policy "verified recruiter creates matches" on public.trust_matches
  for insert with check (public.is_verified_employer_member(employer_id) and public.candidate_is_visible(candidate_id));
create policy "verified recruiter updates matches" on public.trust_matches
  for update using (public.is_verified_employer_member(employer_id))
  with check (public.is_verified_employer_member(employer_id));
create policy "verified recruiter deletes matches" on public.trust_matches
  for delete using (public.is_verified_employer_member(employer_id));

-- Pipeline: same rules.
drop policy if exists "recruiter manages pipeline" on public.pipeline_entries;
create policy "verified recruiter reads pipeline" on public.pipeline_entries
  for select using (public.is_verified_employer_member(employer_id));
create policy "verified recruiter creates pipeline" on public.pipeline_entries
  for insert with check (public.is_verified_employer_member(employer_id) and public.candidate_is_visible(candidate_id));
create policy "verified recruiter updates pipeline" on public.pipeline_entries
  for update using (public.is_verified_employer_member(employer_id))
  with check (public.is_verified_employer_member(employer_id));
create policy "verified recruiter deletes pipeline" on public.pipeline_entries
  for delete using (public.is_verified_employer_member(employer_id));

-- Public job board: only listings from verified employers.
drop policy if exists "candidates can read open jobs" on public.job_listings;
create policy "candidates can read open jobs" on public.job_listings
  for select using (status = 'open' and public.employer_is_verified(employer_id));

-- ── 4. Parties of a match / pipeline row can't be changed from the browser ───
create or replace function public.lock_row_parties() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.employer_id is distinct from old.employer_id or new.candidate_id is distinct from old.candidate_id) then
    raise exception 'employer_id and candidate_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_lock_row_parties on public.trust_matches;
create trigger trg_lock_row_parties before update on public.trust_matches
  for each row execute function public.lock_row_parties();
drop trigger if exists trg_lock_row_parties on public.pipeline_entries;
create trigger trg_lock_row_parties before update on public.pipeline_entries
  for each row execute function public.lock_row_parties();

-- ── 5. Sanity limits on scores (NOT VALID: new/changed rows are checked, old rows are not) ──
alter table public.resume_scans drop constraint if exists resume_scans_score_range;
alter table public.resume_scans add constraint resume_scans_score_range
  check (credibility_score between 0 and 100) not valid;
alter table public.mock_sessions drop constraint if exists mock_sessions_score_range;
alter table public.mock_sessions add constraint mock_sessions_score_range
  check (avg_score between 0 and 100) not valid;
alter table public.star_stories drop constraint if exists star_stories_score_range;
alter table public.star_stories add constraint star_stories_score_range
  check (score between 0 and 100) not valid;

commit;

-- After applying: nobody is verified. To verify a real employer (admin only, SQL editor):
--   update public.employers set verified_at = now() where id = '<employer id>';
-- A private rollback script exists with the owner.
