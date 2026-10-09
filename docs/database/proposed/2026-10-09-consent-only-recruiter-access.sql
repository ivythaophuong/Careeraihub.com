-- PROPOSED, NOT APPLIED. Tested only on the in-memory replica (docs/database/replica-test/s3-consent-only-access.mjs).
-- Review it, then apply it yourself in the Supabase SQL Editor. Plan: docs/architecture/plans/PLAN-score-and-consent-integrity.md (S3, finding F-4).
-- Owner decision (2026-10-09): a recruiter may read a candidate only with that candidate's consent.
--
-- Problem (production, read 2026-10-09): the policy "recruiters can read visible profiles" lets any member of ANY verified employer read ALL columns of
-- every candidate_trust_profiles row with is_visible = true (name, headline, bio, skills, salary range, location, practice scores). consents and has_consent()
-- exist but are not used. Match and pipeline inserts check candidate_is_visible() instead of consent.
--
-- What this does
--   1. drops the policy "recruiters can read visible profiles": recruiters get NO direct SELECT on candidate_trust_profiles
--   2. adds employer_view_candidates(employer, candidate default null): the only recruiter read path. It returns a row only if the caller is a verified
--      member of that employer AND an active consent exists from that candidate to that employer, purpose 'recruiter_review', that lists part 'profile'.
--      Columns follow the consented parts: 'profile' -> name, headline, bio, skills, location, work preference; 'salary' -> salary range and currency
--      (NULL without it). Several active consents are combined. The practice scores are not returned (see below).
--   3. adds employer_has_consent(candidate, employer, part): used by the match and pipeline insert policies. False unless the caller is a verified
--      member of the employer, so it cannot be used to probe other employers' consents.
--   4. replaces candidate_is_visible() with employer_has_consent() in the insert policies of trust_matches and pipeline_entries
--   is_visible no longer grants any read. A revoked or expired consent stops the next request.
--
-- Consequences the owner has accepted or must handle
--   * Recruiters cannot browse candidates. Until the app can ask the candidate for consent and the Employer Portal calls employer_view_candidates, the
--     portal's candidate views return nothing. There is no consent screen in the app today.
--   * The practice score (trust_score and sub-scores) is not exposed to recruiters at all. This is the containment for finding F-1 until scores are
--     written by the server (S4).
--   * Existing trust_matches / pipeline_entries rows stay readable by their employer (they hold ids, status and the recruiter's own notes, not the
--     candidate profile). Revocation stops new matches/pipeline entries and all profile reads; it does not delete those rows or end chats.
--   * Parts vocabulary used here: 'profile', 'salary'. Other parts ('evidence', ...) are accepted in a consent but expose nothing yet.
--
-- Does not change: the consents table, consents_guard, candidate policies, the service role, scores, grants on other objects.
-- Rollback: 2026-10-09-consent-only-recruiter-access.down.sql (restores the three policies exactly as read from production). Safe to run twice.

begin;

create or replace function public.employer_has_consent(p_candidate uuid, p_employer uuid, p_part text default 'profile')
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_verified_employer_member(p_employer)
     and exists (
       select 1 from public.consents c
       where c.candidate_id = p_candidate and c.employer_id = p_employer
         and c.purpose in ('recruiter_review', 'matching')
         and c.revoked_at is null and c.expires_at > now()
         and c.scope -> 'parts' ? p_part)
$$;

create or replace function public.employer_view_candidates(p_employer_id uuid, p_candidate_id uuid default null)
returns table (
  user_id uuid, full_name text, headline text, bio text, skills text[], location text, work_preference text,
  salary_min integer, salary_max integer, currency text, consented_parts text[], consent_expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_verified_employer_member(p_employer_id) then
    return;
  end if;
  return query
  with active as (
    select c.candidate_id as cid, array_agg(distinct part) as parts, max(c.expires_at) as exp
    from public.consents c
    cross join lateral jsonb_array_elements_text(c.scope -> 'parts') as part
    where c.employer_id = p_employer_id and c.purpose = 'recruiter_review'
      and c.revoked_at is null and c.expires_at > now()
      and (p_candidate_id is null or c.candidate_id = p_candidate_id)
    group by c.candidate_id)
  select p.user_id, p.full_name, p.headline, p.bio, p.skills, p.location, p.work_preference,
         case when a.parts @> array['salary'] then p.salary_min end,
         case when a.parts @> array['salary'] then p.salary_max end,
         case when a.parts @> array['salary'] then p.currency end,
         a.parts, a.exp
  from active a
  join public.candidate_trust_profiles p on p.user_id = a.cid
  where a.parts @> array['profile'];
end $$;

revoke execute on function public.employer_has_consent(uuid, uuid, text) from public, anon;
revoke execute on function public.employer_view_candidates(uuid, uuid) from public, anon;
grant execute on function public.employer_has_consent(uuid, uuid, text) to authenticated;
grant execute on function public.employer_view_candidates(uuid, uuid) to authenticated;

drop policy if exists "recruiters can read visible profiles" on public.candidate_trust_profiles;

drop policy if exists "verified recruiter creates matches" on public.trust_matches;
create policy "verified recruiter creates matches" on public.trust_matches
  for insert with check (public.employer_has_consent(candidate_id, employer_id, 'profile'));

drop policy if exists "verified recruiter creates pipeline" on public.pipeline_entries;
create policy "verified recruiter creates pipeline" on public.pipeline_entries
  for insert with check (public.employer_has_consent(candidate_id, employer_id, 'profile'));

commit;
