-- Undo for 2026-10-09-list-open-jobs.sql. Drops only that function. No table data is changed.
begin;
drop function if exists public.list_open_jobs(integer);
commit;
