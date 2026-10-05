# Validating Phase 1 on a Supabase staging project

Gate before the OpenCerts adapter: **PGlite 94/94 proves the design; staging proves the security model on real Supabase.**
Nothing here touches production. `staging-test.mjs` refuses to run against the production project.

## What staging must answer

| # | Question | How it is checked |
|---|---|---|
| 1 | Default privileges: does a candidate get anything beyond the migration? | `staging-checks.sql` queries 2 and 3 |
| 2 | Real RLS: A sees only A, B only B, anonymous nothing, service role runs the workflow | `staging-test.mjs` (R, F, C, P groups) |
| 3 | Column privileges: a candidate cannot name `verification_status`, `trust_status`, `verified_at` | `staging-test.mjs` E2, E3, E6; `staging-checks.sql` query 3 |
| 4 | `SECURITY DEFINER`: fixed `search_path`; `anon` and signed-in users cannot execute | `staging-checks.sql` query 4; `staging-test.mjs` F1 to F4 |
| 5 | `security_invoker` views obey RLS | `staging-checks.sql` query 5; `staging-test.mjs` R3, R4 |
| 6 | `service_role` can run start → attempt → apply; a browser cannot | `staging-test.mjs` F1 to F10 |
| 7 | Rollback leaves nothing behind | run `phase1/001_phase1_foundation.down.sql`, then `staging-checks.sql` query 7 |
| + | Erasure: deleting an account also removes the append-only audit rows | `staging-test.mjs` Z1 |

## Steps
1. Create a new, empty Supabase project named `careeraihub-staging` (free plan is enough). Keep its keys out of chat.
2. Save its URL, anon key and service-role key to `~/.careeraihub-staging.env` (three lines `STAGING_URL=`, `STAGING_ANON_KEY=`,
   `STAGING_SERVICE_ROLE_KEY=`) using a hidden prompt, never the clipboard of a chat.
3. In the staging SQL editor, run, one at a time and in this order:
   `staging/00_bootstrap_public_schema.sql` → `2026-10-05-lock-scores-and-verify-employers.sql` → `phase1/001_phase1_foundation.sql`.
4. Run `staging-checks.sql` queries 1 to 6 and compare with the "expect" lines.
5. Run `node docs/database/staging/staging-test.mjs`; every line should be `PASS`.
6. Rollback test: run `phase1/001_phase1_foundation.down.sql`, run query 7 (expect no rows), then run the migration again.
7. Record the result and any difference from PGlite in the pull request. Only then open the OpenCerts adapter branch.

If anything differs from PGlite (for example a privilege you did not expect), fix the migration and re-run the PGlite suite
first; do not patch staging by hand and move on.
