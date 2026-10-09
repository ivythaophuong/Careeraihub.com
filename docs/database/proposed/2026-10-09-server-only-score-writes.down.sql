-- Undo for 2026-10-09-server-only-score-writes.sql: gives INSERT and UPDATE on the three tables back to the browser roles, exactly as the
-- production catalog showed on 2026-10-09 (GRANT ALL to anon and authenticated). Row-level security still limits each user to their own rows.
begin;
grant insert, update on public.resume_scans to authenticated, anon;
grant insert, update on public.mock_sessions to authenticated, anon;
grant insert, update on public.star_stories to authenticated, anon;
commit;
