-- PROPOSED, NOT APPLIED. Tested only on the in-memory replica (docs/database/replica-test/s3b-list-open-jobs.mjs).
-- Review it, then apply it yourself in the Supabase SQL Editor. Design: docs/architecture/plans/CONSENT-FLOW-DESIGN.md (section 5).
--
-- Why: a candidate who is asked to share their profile must see WHO will receive it. job_listings has no employer name and employers is readable only by
-- its owner, so the candidate screen cannot show the company (TrustMatch reads job.employer_name, a column that does not exist, and falls back to "Employer").
--
-- What this does: adds list_open_jobs(p_limit), executable by signed-in users only. It returns the open job listings of VERIFIED employers together with the
-- employer's id and NAME. Nothing else of the employer is returned (no website, owner, size or other columns), and not posted_by. It skips unverified employers
-- and listings whose closes_at has passed. p_limit is capped at 50.
--
-- What is NEW and what is not: every job column returned here (title, description, skills_required, salary_min, salary_max, currency, work_preference, location,
-- created_at) is already readable by any signed-in user through the policy "candidates can read open jobs" plus the SELECT privilege on job_listings
-- (evidence queries 1.3 and 1.4). The only new information is the employer name for verified employers with an open job. Whether salary ranges in job
-- listings should be visible to every signed-in user is a separate, existing question for the owner; this function neither widens nor narrows it.
--
-- Two independent guards keep anonymous callers out: EXECUTE is revoked from public and anon, AND the query itself returns nothing unless auth.uid() is set.
-- Each is tested on its own.
--
-- Does not change tables, policies or existing grants. Rollback: 2026-10-09-list-open-jobs.down.sql. Safe to run twice.

begin;

create or replace function public.list_open_jobs(p_limit integer default 20)
returns table (
  id uuid, employer_id uuid, employer_name text, title text, description text,
  skills_required text[], salary_min integer, salary_max integer, currency text, work_preference text, location text,
  created_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select j.id, j.employer_id, e.name, j.title, j.description,
         j.skills_required, j.salary_min, j.salary_max, j.currency, j.work_preference, j.location, j.created_at
  from public.job_listings j
  join public.employers e on e.id = j.employer_id
  where auth.uid() is not null
    and j.status = 'open'
    and e.verified_at is not null
    and (j.closes_at is null or j.closes_at > now())
  order by j.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

revoke execute on function public.list_open_jobs(integer) from public, anon;
grant execute on function public.list_open_jobs(integer) to authenticated;

commit;
