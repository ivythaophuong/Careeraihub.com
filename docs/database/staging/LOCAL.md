# Proving the fixes without a second Supabase project

The free plan allows two active projects, so a staging project may not be possible. There are three ways to get real-stack evidence (real PostgREST, real Auth,
real RLS), best first. None of them touches production data. The in-memory replica (PGlite) remains the fast check; these add the real API.

| Option | Cost | Needs | What it proves | Risk to production |
|---|---|---|---|---|
| **A. Local Supabase stack** (recommended) | free | Docker Desktop (or OrbStack/Colima) and the Supabase CLI you already have | Everything in `rest-consent-test.mjs`: RLS, column privileges, functions, REST attacks, with real JWTs | none |
| **B. Pause your other project, create staging, delete it afterwards** | free | you accept pausing the other project | the same as A on Supabase's own infrastructure (hosting, settings) | none for production; check the other project is safe to pause |
| **C. Self-rolling-back probe on production** | free | no Docker | behaviour on the real schema, inside one transaction that always aborts | low but non-zero: DDL takes short exclusive locks while it runs. Only after a backup/rollback plan. **Not built; ask for it if A and B are impossible** |

## Option A: local stack

**One command** (after Docker is running and `supabase init` has been done once in a folder outside the repository):
```
bash docs/database/staging/run-local-proof.sh ~/supabase-local
```
It starts only the containers it needs (database, auth, gateway, REST), RESETS the local database (local data only), builds the schema production had, proves the
problems through the real API, applies the four fixes, proves them, rolls them back (the problems must return), re-applies, and runs the Phase 1 security suite.
It refuses to run unless the stack's URL is 127.0.0.1. First run downloads container images.

Manual steps, if you want to see each one:
1. `mkdir ~/supabase-local && cd ~/supabase-local && supabase init && supabase start -x studio,imgproxy,storage-api,realtime,edge-runtime,logflare,vector,mailpit,postgres-meta,supavisor`
2. `supabase status -o env` shows API_URL, ANON_KEY, SERVICE_ROLE_KEY of the LOCAL stack. Save them without quotes in `~/.careeraihub-staging.env` as
   `STAGING_URL=`, `STAGING_ANON_KEY=`, `STAGING_SERVICE_ROLE_KEY=` (local-only values, still keep them out of chat).
3. Apply SQL files with `psql` inside the database container. **`supabase db query --local -f` cannot run files with several statements**:
   `docker exec -i supabase_db_<project_id> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < <file>`. Order: `staging/00_bootstrap_public_schema.sql`,
   `2026-10-05-lock-scores-and-verify-employers.sql`, `phase1/001_phase1_foundation.sql`, `staging/01_live_columns.sql`. Then
   `docker exec -i supabase_db_<project_id> psql -U postgres -d postgres -c "notify pgrst, 'reload schema'"`.
4. `node docs/database/staging/rest-consent-test.mjs --expect=before` (every issue OPEN), apply the four `proposed/2026-10-09-*.sql` files in the order
   recompute-score-on-delete, lock-match-fields, list-open-jobs, consent-only-recruiter-access, reload the schema cache, then `--expect=after`.
5. Rollback: the four `.down.sql` files in reverse order, reload, `--expect=before` again.
6. `supabase stop --no-backup` when done.

### Result of the first full run (2026-10-09, local stack, Supabase CLI 2.119.0, Docker Desktop)
- `--expect=before`: 9 checks, 0 mismatches. F-1, F-5, F-4a, F-4d, F-2 reproduced through PostgREST with real JWTs.
- Fixes applied: `--expect=after` 27 checks, 0 mismatches. F-5, F-2, F-4a, F-4d FIXED; F-1 still OPEN (needs S4); 18 consent/open-jobs checks pass.
- Rollback: the issues returned (9 checks, 0 mismatches); re-applied: 27 checks, 0 mismatches.
- Phase 1 security suite (`staging-test.mjs`) with all fixes in place: 40/40.
- An earlier run showed 4 failures on `evidence`. The cause was a blanket `grant ... on all tables` in the test setup that overrode Phase 1's column privileges, not the fixes.
  The setup now grants only the pre-Phase-1 tables; the in-memory suites were corrected the same way and re-run (all pass).

## What is not covered
- The production project's own settings (Auth configuration, rate limits, the proxy in front of the site). Those need the read-only catalog export and a look at the dashboard.
- The local stack runs Supabase's open-source services, not the hosted platform: hosting limits, the Auth settings of the production project and the proxy in front of the site are not exercised.
- The local database is built from the reduced bootstrap, not from a dump of production. Run `docs/database/evidence/export-catalog.sh` against the linked project and compare
  the policies, functions and privileges with what the local stack has; any difference is a finding.

## Without Docker: export the production catalog (read-only)
`bash docs/database/evidence/export-catalog.sh <folder>` writes 12 JSON files using `supabase db query --linked` (no Docker, no database password). It runs only SELECTs and
refuses anything else. It needs `supabase login` and `supabase link --project-ref <ref>` once, in a folder outside the repository.
