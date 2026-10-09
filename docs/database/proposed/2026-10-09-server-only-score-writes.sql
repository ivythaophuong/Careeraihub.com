-- PROPOSED, NOT APPLIED. Step S4 slice 3 (finding F-1): only the server may write the three tables that feed the practice score.
-- Plan: docs/architecture/plans/PLAN-score-and-consent-integrity.md section 4; Edge Functions score-star and score-interview.
--
-- Problem (production, read 2026-10-09): policies "Users manage own ..." plus GRANT ALL let a signed-in user insert or edit their own rows in
-- resume_scans, mock_sessions and star_stories with any score 0..100; the recompute triggers turn that into trust_score.
--
-- What this does: removes INSERT and UPDATE on those three tables from the browser roles (authenticated, anon). SELECT and DELETE stay, so the app
-- still reads a user's history and "Clear memory" / deleting a story still work (and the S1 triggers still recompute on delete). The Edge
-- Functions write with the service role, which this does not touch.
--
-- ONLY APPLY AFTER: score-star and score-interview are deployed AND the site that is live was built with server scoring on (the default since
-- this change). An older cached site will get "permission denied" when it tries to save a story or an interview, and nothing is saved.
-- Today the only browser writers are STARBuilder (star_stories) and HiringManagerSim (mock_sessions); resume_scans has no live writer.
--
-- Does not change rows, policies, triggers or other tables. Rollback: 2026-10-09-server-only-score-writes.down.sql. Safe to run twice.

begin;

revoke insert, update on public.resume_scans from authenticated, anon;
revoke insert, update on public.mock_sessions from authenticated, anon;
revoke insert, update on public.star_stories from authenticated, anon;

commit;
