# Read-only security and data evidence pass (procedure for the owner)

Purpose: replace the **[UNKNOWN]** items in [PLATFORM_ARCHITECTURE.md](PLATFORM_ARCHITECTURE.md) and [ARCHITECTURE_GAP_MATRIX.md](ARCHITECTURE_GAP_MATRIX.md)
(rows 14, 15, 17, 18, 21, 27, 28) with evidence from the real Supabase project.

This is a request for evidence, **not permission to change anything**. Nothing below modifies data, schema, policies, functions or secrets.
This document was written without access to the project; no query in it has been run.

## Rules

1. Run only the statements in section 1 in the Supabase SQL Editor. They read the system catalogs (`pg_catalog`, `information_schema`) and
   call `pg_get_functiondef`. They do not select rows from any user table, so no resume text, name or e-mail is returned.
2. Do not run any `insert`, `update`, `delete`, `alter`, `create`, `drop`, `grant`, `revoke` or `truncate` as part of this pass.
3. Do not paste secrets, JWTs, API keys or the service-role key anywhere. Secret **names** are enough.
4. Save each result as a text or CSV file under `docs/database/evidence/<YYYY-MM-DD>/` (new folder) and review it before committing.
   If a result contains something sensitive, remove it first.
5. If a query errors or returns something unexpected, stop and report it; do not try to "fix" the project.

## 1. SQL (read-only)

```sql
-- 1.1 Tables in public and whether row-level security is enabled / forced
select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- 1.2 Columns (shape only)
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 1.3 Every RLS policy, with its expressions
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 1.4 Table privileges granted to the API roles
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

-- 1.5 Triggers in public (name, table, timing, event, function called)
select event_object_table as table_name, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table, trigger_name;

-- 1.6 Function definitions in public (includes recompute_trust_score, trigger_recompute_trust_score, lock_trust_columns, lock_employer_verification)
select p.proname as function_name, p.prosecdef as security_definer, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;

-- 1.7 Who may execute those functions
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public' and grantee in ('anon', 'authenticated', 'public')
order by routine_name, grantee;

-- 1.8 Constraints (checks, keys) on the score and verification tables
select conrelid::regclass as table_name, conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where connamespace = 'public'::regnamespace
order by conrelid::regclass::text, conname;
```

## 2. Non-SQL evidence (read-only)

| Item | How | Settles |
|---|---|---|
| Deployed `ai`, `jobs`, `verify-cert` source equals the repo | `supabase functions download <name>` into a scratch folder and diff against `supabase/functions/<name>` | whether `AI_FALLBACK` or other logic exists only on the server (gap row 23) |
| Names of configured function secrets | `supabase secrets list` (shows names/digests, not values) | which providers can be selected |
| Whether `user_metadata` can be changed by the signed-in user, and whether `role` is checked server-side | Supabase dashboard → Authentication settings; plus the policies from 1.3 that mention `role`, `employers`, `employer_members` | gap row 21, N3 |
| Whether any legacy `resume_scans` rows exist | **Not covered by this pass**: it needs a row count, which reads a user table. Ask for it separately and only as `count(*)` | audit §9 item 2 |
| Response headers of the deployed site | `curl -sI https://<site>` (public headers only) | CSP/HSTS at the proxy (gap row 31) |

## 3. What each result decides

| Result | Updates |
|---|---|
| 1.1, 1.3, 1.4 | gap rows 14, 21, 27, 28: which tables enforce ownership, who may read `candidate_trust_profiles`, whether `user_memory` writes are limited to the owner |
| 1.5, 1.6, 1.7 | gap rows 17, 18: the real trust-score formula, whether the browser can write score columns on the three input tables |
| 1.8 | gap rows 15, 18: range and label constraints that exist |
| Function diff and secrets | gap rows 23, 24 |
| Auth settings | gap row 21 and decision N3 |

After the results are committed, each affected row's status is re-assessed from **Unknown** to Confirmed, Partial or Missing, with the file as
evidence. Statuses are not changed without the evidence file.

## 4. Stop conditions

Stop and report instead of continuing if: a policy appears to allow any authenticated user to read another user's rows; a function
that sets a score or verification state is executable by `anon` or `authenticated`; or a table that holds resume text has RLS disabled.
These are findings for a separate, reviewed fix, not something to correct during the evidence pass.
