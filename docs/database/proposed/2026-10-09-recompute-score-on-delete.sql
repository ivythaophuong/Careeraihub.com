-- PROPOSED, NOT APPLIED. Tested only on the in-memory replica (docs/database/replica-test/s1-recompute-on-delete.mjs).
-- Review it, then apply it yourself in the Supabase SQL Editor. Plan: docs/architecture/plans/PLAN-score-and-consent-integrity.md (S1, finding F-5).
--
-- Problem (production, read 2026-10-09): the triggers that recompute candidate_trust_profiles run AFTER INSERT and AFTER UPDATE on resume_scans,
-- mock_sessions and star_stories, never AFTER DELETE. Deleting an input (a STAR story, or "Clear memory") leaves the stored score unchanged.
--
-- What this does
--   * adds one function, trigger_recompute_trust_score_after_delete(), and one statement-level AFTER DELETE trigger on each of the three tables
--   * recomputes once per affected user per DELETE statement (transition table), not once per row
--   * skips a user that no longer exists in auth.users. Account deletion cascades from auth.users; recompute upserts into
--     candidate_trust_profiles, which has a foreign key to auth.users, so recomputing for a user that is going away would fail the whole deletion
--   * does NOT change recompute_trust_score, the formula, the score columns, RLS, policies or grants
--
-- What it does not do (separate steps): missing data still counts as 0, MAX is still used, and "Clear memory" still does not touch
-- candidate_trust_profiles. After the last input is deleted the stored score becomes 0 (the v0 rule), not NULL.
--
-- Rollback: 2026-10-09-recompute-score-on-delete.down.sql (drops the three triggers and the function; no data is changed by either direction
-- except that the next recompute writes the score).
-- Safe to run twice.

begin;

create or replace function public.trigger_recompute_trust_score_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare uid uuid;
begin
  for uid in select distinct user_id from old_rows where user_id is not null loop
    if exists (select 1 from auth.users u where u.id = uid) then
      perform public.recompute_trust_score(uid);
    end if;
  end loop;
  return null;
end $$;

revoke execute on function public.trigger_recompute_trust_score_after_delete() from public, anon, authenticated;

drop trigger if exists trg_trust_on_resume_scan_delete on public.resume_scans;
create trigger trg_trust_on_resume_scan_delete
  after delete on public.resume_scans
  referencing old table as old_rows
  for each statement execute function public.trigger_recompute_trust_score_after_delete();

drop trigger if exists trg_trust_on_mock_session_delete on public.mock_sessions;
create trigger trg_trust_on_mock_session_delete
  after delete on public.mock_sessions
  referencing old table as old_rows
  for each statement execute function public.trigger_recompute_trust_score_after_delete();

drop trigger if exists trg_trust_on_star_story_delete on public.star_stories;
create trigger trg_trust_on_star_story_delete
  after delete on public.star_stories
  referencing old table as old_rows
  for each statement execute function public.trigger_recompute_trust_score_after_delete();

commit;
