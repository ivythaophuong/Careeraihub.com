-- PROPOSED, NOT APPLIED. Tested only on the in-memory replica (docs/database/replica-test/s3b-list-open-jobs.mjs).
-- Review it, then apply it yourself in the Supabase SQL Editor. Design: docs/architecture/plans/CONSENT-FLOW-DESIGN.md (section 5).
--
-- Why: a candidate who is asked to share their profile must see WHO will receive it. job_listings has no employer name and employers is readable only by
-- its owner, so the candidate screen cannot show the company (TrustMatch reads job.employer_name, a column that does not exist, and falls back to "Employer").
--
-- What this does: adds list_open_jobs(p_limit), executable by signed-in users only. It returns the open job listings of VERIFIED employers (the same jobs
-- the policy "candidates can read open jobs" already shows) together with the employer's id, name and website. It does not return posted_by, other employer
-- columns, or jobs of unverified employers, and it skips listings whose closes_at has passed. p_limit is capped at 50.
-- Owner decision needed: employer names of verified employers with open jobs become visible to every signed-in user (as on any job board).
--
-- Does not change tables, policies or existing grants. Rollback: 2026-10-09-list-open-jobs.down.sql. Safe to run twice.

begin;

create or replace function public.list_open_jobs(p_limit integer default 20)
returns table (
  id uuid, employer_id uuid, employer_name text, employer_website text, title text, description text,
  skills_required text[], salary_min integer, salary_max integer, currency text, work_preference text, location text,
  created_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select j.id, j.employer_id, e.name, e.website, j.title, j.description,
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
