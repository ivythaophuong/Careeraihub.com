-- APPLIED 2026-10-09 (Supabase SQL Editor; "Success. No rows returned", the expected result for these
-- statements). Tested beforehand against the in-memory replica (docs/database/replica-test/score-metadata.mjs).
-- Nothing in the app reads these columns yet.
--
-- Why: resume_scans.credibility_score holds AI-generated scores of two different meanings (Resume Scan
-- "credibility", ATS Builder "ATS"), and recompute_trust_score takes MAX(credibility_score) on every insert.
-- A rule-based score needs its own column, a type and a version, so it can never be mixed into that MAX,
-- and so a change of scoring rules can be explained to the user.
--
-- What it does
--   * adds three nullable columns: deterministic_score, score_type, score_version
--   * existing rows keep NULL in all three, meaning "scored before this change (AI-generated)"
--   * deterministic_score is 0..100 and, when present, must come with score_type and score_version
--   * does NOT touch credibility_score, recompute_trust_score, the trigger, RLS or grants
--     => the trust score does not change, new rows with these columns do not affect it
--
-- Known limit: the score is computed in the browser, like the AI scores. The database can check its
-- range and that its labels are present; it cannot check that it was computed honestly (same gap as
-- docs/database/README.md "Known gap").
--
-- Rollback (safe: nothing reads the columns):
--   alter table public.resume_scans drop constraint if exists resume_scans_deterministic_score_labelled;
--   alter table public.resume_scans drop constraint if exists resume_scans_deterministic_score_range;
--   alter table public.resume_scans drop column if exists deterministic_score,
--     drop column if exists score_type, drop column if exists score_version;

alter table public.resume_scans add column if not exists deterministic_score integer;
alter table public.resume_scans add column if not exists score_type text;
alter table public.resume_scans add column if not exists score_version text;

alter table public.resume_scans drop constraint if exists resume_scans_deterministic_score_range;
alter table public.resume_scans add constraint resume_scans_deterministic_score_range
  check (deterministic_score is null or (deterministic_score between 0 and 100));

alter table public.resume_scans drop constraint if exists resume_scans_deterministic_score_labelled;
alter table public.resume_scans add constraint resume_scans_deterministic_score_labelled
  check (deterministic_score is null or (score_type is not null and score_version is not null and score_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'));