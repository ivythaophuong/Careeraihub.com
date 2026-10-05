-- Read-only checks to run in the SQL editor of the STAGING project after the migration.
-- Run each query on its own. The "expect" lines say what a correct result looks like.

-- 1. Row level security is on for every new table.   expect: every row rls_enabled = true
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in ('career_profiles','career_targets','evidence','trusted_issuers','verification_requests','verification_attempts','consents')
order by 1;

-- 2. Table privileges of the browser roles.   expect: anon has no row at all; authenticated only the privileges below
--    career_profiles/career_targets: SELECT, INSERT, DELETE (+ column UPDATE) · evidence: SELECT, INSERT(columns), UPDATE(withdrawn_at)
--    verification_requests: SELECT, INSERT(evidence_id) · verification_attempts: SELECT · consents: SELECT, INSERT(columns), UPDATE(revoked_at)
--    trusted_issuers: nothing
select grantee, table_name, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon','authenticated')
  and table_name in ('career_profiles','career_targets','evidence','evidence_current','evidence_active','trusted_issuers','verification_requests','verification_attempts','consents')
group by grantee, table_name order by table_name, grantee;

-- 3. Column privileges (the part that stops a browser from naming verification_status).   expect: for evidence, authenticated has INSERT only on
--    type, claim, source_type, source_url, source_provider, supersedes_id, raw_credential and UPDATE only on withdrawn_at
select grantee, table_name, privilege_type, string_agg(column_name, ', ' order by column_name) as columns
from information_schema.column_privileges
where table_schema = 'public' and grantee in ('anon','authenticated') and table_name in ('evidence','verification_requests','consents')
  and privilege_type in ('INSERT','UPDATE')
group by grantee, table_name, privilege_type order by table_name, privilege_type;

-- 4. Who can run the functions.   expect: anon_can_run = false and authenticated_can_run = false for ALL; service_can_run = true
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_can_run,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_run,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  as service_can_run,
       p.prosecdef as security_definer,
       p.proconfig as fixed_settings
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('start_verification','apply_verification_attempt','purge_raw_credential','has_consent','recompute_trust_score','trigger_recompute_trust_score')
order by 1;
--    also expect: security_definer = true for those, and fixed_settings contains search_path=public, pg_temp

-- 5. The views obey the caller's row level security.   expect: both views list security_invoker=true
select c.relname, c.reloptions
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('evidence_current','evidence_active');

-- 6. Policies.   expect: no policy on trusted_issuers; no UPDATE/DELETE policy on verification_*; evidence has select, insert, and the withdraw update
select tablename, policyname, cmd from pg_policies
where schemaname = 'public'
  and tablename in ('career_profiles','career_targets','evidence','trusted_issuers','verification_requests','verification_attempts','consents')
order by tablename, cmd, policyname;

-- 7. Nothing unexpected was left behind by a rollback.   (run after 001_phase1_foundation.down.sql)   expect: 0 rows
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('career_profiles','career_targets','evidence','evidence_current','evidence_active','trusted_issuers','verification_requests','verification_attempts','consents');
