-- PRE-FLIGHT for 001_phase1_foundation.sql on PRODUCTION. Read-only: changes nothing.
-- Run each query on its own, in a NEW query tab. Do not run the migration until all three look right.

-- A. Name clashes: anything the migration would create or overwrite that already exists.   expect: 0 rows
select 'table or view' as kind, c.relname as name
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('career_profiles','career_targets','evidence','evidence_current','evidence_active','trusted_issuers','verification_requests','verification_attempts','consents')
union all
select 'function', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('touch_updated_at','evidence_before_insert','evidence_before_update','verification_requests_before_insert','verification_attempts_guard','consents_guard','has_consent','start_verification','apply_verification_attempt','purge_raw_credential')
order by 1, 2;

-- B. Things the migration depends on.   expect: version 17.x; every other value true (employers.id: uuid)
select 'postgres version' as check_name, current_setting('server_version') as value
union all select 'role service_role exists',          exists (select 1 from pg_roles where rolname = 'service_role')::text
union all select 'auth.users exists',                 (to_regclass('auth.users') is not null)::text
union all select 'auth.uid() exists',                 exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'auth' and p.proname = 'uid')::text
union all select 'public.employers exists',           (to_regclass('public.employers') is not null)::text
union all select 'employers.id type',                 coalesce((select data_type from information_schema.columns where table_schema = 'public' and table_name = 'employers' and column_name = 'id'), 'MISSING')
union all select '2026-10-05 migration applied (score lock trigger)', exists (select 1 from pg_trigger where tgname = 'trg_lock_trust_columns')::text
union all select '2026-10-05 migration applied (employers.verified_at)', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'employers' and column_name = 'verified_at')::text;

-- C. Row counts of the existing tables: write these down, and compare after the migration.   expect: unchanged afterwards
select 'candidate_trust_profiles' as table_name, count(*) as rows from public.candidate_trust_profiles
union all select 'employers',        count(*) from public.employers
union all select 'employer_members', count(*) from public.employer_members
union all select 'job_listings',     count(*) from public.job_listings
union all select 'trust_matches',    count(*) from public.trust_matches
union all select 'pipeline_entries', count(*) from public.pipeline_entries
union all select 'resume_scans',     count(*) from public.resume_scans
union all select 'mock_sessions',    count(*) from public.mock_sessions
union all select 'star_stories',     count(*) from public.star_stories
union all select 'user_memory',      count(*) from public.user_memory
union all select 'profiles',         count(*) from public.profiles
order by 1;
