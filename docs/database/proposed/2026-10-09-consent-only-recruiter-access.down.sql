-- Undo for 2026-10-09-consent-only-recruiter-access.sql. Restores the three policies exactly as read from production on 2026-10-09
-- (evidence query 1.3) and drops the two functions. No table data is changed.
begin;

drop policy if exists "verified recruiter creates pipeline" on public.pipeline_entries;
create policy "verified recruiter creates pipeline" on public.pipeline_entries
  for insert with check (is_verified_employer_member(employer_id) and candidate_is_visible(candidate_id));

drop policy if exists "verified recruiter creates matches" on public.trust_matches;
create policy "verified recruiter creates matches" on public.trust_matches
  for insert with check (is_verified_employer_member(employer_id) and candidate_is_visible(candidate_id));

drop policy if exists "recruiters can read visible profiles" on public.candidate_trust_profiles;
create policy "recruiters can read visible profiles" on public.candidate_trust_profiles
  for select using ((is_visible = true) and is_verified_employer_member());

drop function if exists public.employer_view_candidates(uuid, uuid);
drop function if exists public.employer_has_consent(uuid, uuid, text);

commit;
