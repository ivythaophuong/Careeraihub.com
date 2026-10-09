# Status of the Phase 1 foundation documents on `main`

These files (`docs/contracts/README.md`, `docs/database/phase1/`, `docs/database/staging/`) were written and committed on the branch
`feature/phase1-foundation` (commit `5c377ae`, 2026-10-05) and are brought onto `main` as **documentation only**. They are not application code.

What is known about production, by evidence class:

| Statement | Class |
|---|---|
| The migration was applied to production on 2026-10-05 | The owner's own record in `phase1/README.md` ("Applied to production"). Not independently shown by this commit |
| Tables `career_profiles`, `career_targets`, `evidence`, `trusted_issuers`, `verification_requests`, `verification_attempts`, `consents`, the views `evidence_current` and `evidence_active` (`security_invoker=true`), and the functions `start_verification`, `apply_verification_attempt`, `has_consent` exist in the live database | CONFIRMED IN PRODUCTION on 2026-10-09 by read-only catalog queries (`docs/architecture/EVIDENCE_RESULTS_2026-10-09.md`) |
| Object names found live (for example `evidence_trust_requires_binding`, `consents_window`, `trusted_issuers_one_per_policy`, `verification_attempts_guard`) also appear in `001_phase1_foundation.sql` | Compared by name only |
| The live schema equals the script, line by line | **UNKNOWN**. No diff was made; column defaults, grants and policy text were read for some objects but not compared against the script |
| Application code on `main` uses these tables | **No**: no file under `src/` or `supabase/` references them (grep). The Phase 1 README says the same |
| A verifier service calls `start_verification` / `apply_verification_attempt` | **UNKNOWN**; none in this repository |

Do not describe these capabilities as live product features. The database model exists; the application does not use it.

The same branch also changed `CLAUDE.md` and `scripts/smoke-test.sh`. Those changes are **not** included here: `CLAUDE.md` on `main` has moved on and the branch
version conflicts with it. Its "Platform rules" section is the owner's decision to bring across separately.
