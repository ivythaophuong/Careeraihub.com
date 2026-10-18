-- PROPOSED, NOT APPLIED. Written 2026-10-18. Project: CareerAiHub (ruibdsvrcctxgxctaxwe) only. Never ZenDMS (obtmsvhejvcfrkfyucev).
-- Why: the project's default privileges gave anon and authenticated every privilege on the 20 older public tables (read-only audit 2026-10-18,
-- docs/audits/RLS-AUDIT-2026-10-18.md, findings 3 and 4). Rows are protected by RLS today; this takes away privileges nobody uses, so that one wrong policy
-- can no longer expose or destroy a table by itself.
-- What it does NOT touch: authenticated SELECT/INSERT/UPDATE/DELETE (the app needs them); anon on culture_leads, culture_quiz_events and waitlist (their writer
-- is not in this repository: UNKNOWN, so only TRUNCATE, TRIGGER and REFERENCES go); anon SELECT on job_listings (its policy is written for guests); RLS; policies; triggers.
-- Effect on users: none expected. PostgREST and GraphQL never use TRUNCATE, TRIGGER or REFERENCES, and no screen of this app reads or writes these tables as anon.
-- Down: 2026-10-18-revoke-excess-privileges.down.sql grants back exactly what was held on 2026-10-18.
begin;

-- 1. No TRUNCATE (it ignores RLS), TRIGGER or REFERENCES for the browser roles on any of the 20 tables.
revoke truncate, trigger, references on public.applications, public.candidate_trust_profiles, public.cover_letters, public.culture_leads, public.culture_quiz_events, public.employer_members, public.employers, public.insights, public.jd_analyses, public.job_listings, public.mock_sessions, public.negotiation_practice, public.pipeline_entries, public.profiles, public.resume_scans, public.star_stories, public.trust_matches, public.trust_messages, public.user_memory, public.waitlist from anon, authenticated;

-- 2. anon has no business with the 16 private tables: every policy on them is auth.uid()-based, so anon matched no row anyway.
revoke all on public.applications, public.candidate_trust_profiles, public.cover_letters, public.employer_members, public.employers, public.insights, public.jd_analyses, public.mock_sessions, public.negotiation_practice, public.pipeline_entries, public.profiles, public.resume_scans, public.star_stories, public.trust_matches, public.trust_messages, public.user_memory from anon;

-- 3. job_listings: anon keeps SELECT only (the policy "candidates can read open jobs" is written for public); no writes.
revoke insert, update, delete on public.job_listings from anon;

commit;
