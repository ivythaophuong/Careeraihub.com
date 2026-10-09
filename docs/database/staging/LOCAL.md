# Proving the fixes without a second Supabase project

The free plan allows two active projects, so a staging project may not be possible. There are three ways to get real-stack evidence (real PostgREST, real Auth,
real RLS), best first. None of them touches production data. The in-memory replica (PGlite) remains the fast check; these add the real API.

| Option | Cost | Needs | What it proves | Risk to production |
|---|---|---|---|---|
| **A. Local Supabase stack** (recommended) | free | Docker Desktop (or OrbStack/Colima) and the Supabase CLI you already have | Everything in `rest-consent-test.mjs`: RLS, column privileges, functions, REST attacks, with real JWTs | none |
| **B. Pause your other project, create staging, delete it afterwards** | free | you accept pausing the other project | the same as A on Supabase's own infrastructure (hosting, settings) | none for production; check the other project is safe to pause |
| **C. Self-rolling-back probe on production** | free | no Docker | behaviour on the real schema, inside one transaction that always aborts | low but non-zero: DDL takes short exclusive locks while it runs. Only after a backup/rollback plan. **Not built; ask for it if A and B are impossible** |

## Option A: local stack

1. Install Docker Desktop and start it. Check: `docker info` prints a server section.
2. In a folder outside the repository:
   ```
   mkdir ~/supabase-local && cd ~/supabase-local
   supabase init
   supabase start          # first run downloads images; takes several minutes
   supabase status -o env  # shows API_URL, ANON_KEY, SERVICE_ROLE_KEY for the LOCAL stack
   ```
3. Save the three local values (they are only valid on your machine, but still keep them out of chat) in `~/.careeraihub-staging.env`:
   ```
   STAGING_URL=<API_URL>
   STAGING_ANON_KEY=<ANON_KEY>
   STAGING_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
   ```
4. Build the schema production had, in this order (from the repository folder):
   ```
   supabase db query --local -f docs/database/staging/00_bootstrap_public_schema.sql
   supabase db query --local -f docs/database/2026-10-05-lock-scores-and-verify-employers.sql
   supabase db query --local -f docs/database/phase1/001_phase1_foundation.sql
   supabase db query --local -f docs/database/staging/01_live_columns.sql
   ```
   (Run from `~/supabase-local` if the CLI asks for a project folder: `--workdir ~/supabase-local`.)
5. Reproduce the problems on the real stack: `node docs/database/staging/rest-consent-test.mjs --expect=before`. Expect every issue OPEN and no MISMATCH.
6. Apply the proposed fixes, in this order:
   ```
   supabase db query --local -f docs/database/proposed/2026-10-09-recompute-score-on-delete.sql
   supabase db query --local -f docs/database/proposed/2026-10-09-lock-match-fields.sql
   supabase db query --local -f docs/database/proposed/2026-10-09-list-open-jobs.sql
   supabase db query --local -f docs/database/proposed/2026-10-09-consent-only-recruiter-access.sql
   ```
7. `node docs/database/staging/rest-consent-test.mjs --expect=after`. Expect F-5, F-2, F-4a, F-4d FIXED, F-1 still OPEN (that is S4), every control and fix check PASS.
8. Rollback test: run the four `.down.sql` files in reverse order, re-run step 5 (the issues must be back), then re-apply.
9. Clean up: `supabase stop --no-backup`.

## What is not covered
- The production project's own settings (Auth configuration, rate limits, the proxy in front of the site). Those need the read-only catalog export and a look at the dashboard.
- `rest-consent-test.mjs` was written without a stack to run it on. If a check fails on the first run, send the output: it may be a test mistake, and it will be fixed before anything else is concluded.
- The local database is built from the reduced bootstrap, not from a dump of production. Run `docs/database/evidence/export-catalog.sh` against the linked project and compare
  the policies, functions and privileges with what the local stack has; any difference is a finding.

## Without Docker: export the production catalog (read-only)
`bash docs/database/evidence/export-catalog.sh <folder>` writes 12 JSON files using `supabase db query --linked` (no Docker, no database password). It runs only SELECTs and
refuses anything else. It needs `supabase login` and `supabase link --project-ref <ref>` once, in a folder outside the repository.
