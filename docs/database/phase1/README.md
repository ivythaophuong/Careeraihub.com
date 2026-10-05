# Phase 1 foundation: design and test notes

Status: **applied to production on 2026-10-05** (see "Applied" at the end). Designed and tested on an in-memory Postgres first. Written from the frozen
contracts (`docs/contracts/README.md`, v1.0). Applying it needs the owner's approval.

Files: `001_phase1_foundation.sql` (migration), `001_phase1_foundation.down.sql` (undo), `test.mjs` (71 scenarios).

## What it creates

| Table | Purpose | Who writes |
|---|---|---|
| `career_profiles` | the candidate's canonical identity (one per user) | candidate |
| `career_targets` | what the candidate is aiming for; scores will point to `target_id` | candidate |
| `evidence` | claim + artifact references + **summary** of the latest verification. Immutable versions. | candidate inserts claims; only the server changes verification fields |
| `evidence_current` (view) | the latest version of each piece of evidence | read-only |
| `trusted_issuers` | versioned issuer policy | service role only |
| `verification_requests` | the candidate asks for verification; one open request per evidence; 5 per hour | candidate inserts; server completes |
| `verification_attempts` | **append-only** audit trail: adapter, adapter version, policy version, checks, before/after status | server only |
| `consents` | consent-first sharing: who, what, purpose, granted, expires (max 365 days), revoked | candidate grants and revokes; never edits or deletes |

Functions (service role only): `start_verification`, `apply_verification_attempt` (the only path to `VERIFIED`),
`has_consent` (for future employer policies).

**Not in Phase 1 on purpose:** any score (no Verified Trust, no `input_hash` column yet), the `practice_score` rename,
the OpenCerts adapter, employers reading evidence, any UI, and moving data out of `user_memory`.

## State machine (enforced by a trigger and constraints)

```
UNVERIFIED ──► PENDING ──► VERIFIED ──► REVOKED   (final)
     ▲            │            └──────► EXPIRED ──► PENDING (re-verify)
     │            └──────► FAILED ────► PENDING (retry)
     └ the candidate can only create evidence in this state
```
Any other jump (for example `UNVERIFIED → VERIFIED`, `REVOKED → VERIFIED`) is rejected, even for the service role.
`trust_status = ELIGIBLE` additionally requires, in a `CHECK` constraint: status `VERIFIED`, recipient binding
`email_verified` or `did_proof`, `issuer_trusted` and `recipient_binding_verified` both true. A platform page can never be
`HIGH` confidence. **A valid credential is not verified candidate evidence.**

## Who can do what (RLS and privileges)

| | Candidate (own rows) | Other candidate | Employer (verified or not) | Anonymous | Service role |
|---|---|---|---|---|---|
| career_profiles, career_targets | read, write, delete | nothing | nothing | denied | all |
| evidence | read; **insert** unverified claims; no update or delete | nothing | nothing (until consent policies, Phase 4B) | denied | updates verification fields only |
| verification_requests | read; insert for own latest evidence | nothing | nothing | denied | all |
| verification_attempts | read own | nothing | nothing | denied | insert via function only; no update or delete |
| consents | read; insert; revoke once | nothing | nothing (reads go through `has_consent`) | denied | all |
| trusted_issuers | denied | denied | denied | denied | all |

The browser's `INSERT` on `evidence` is limited by **column privileges** to the claim and artifact columns, so it cannot
even name `verification_status`, `trust_status`, `checks` or `candidate_id`. A trigger also resets those fields as a second
layer.

## Decisions made in this design (please review)
1. `text` + `CHECK` instead of Postgres enums: adding a value is a small migration, not an `ALTER TYPE`.
2. Evidence is **insert and select only** for candidates: no edits, no deletes (history must stay stable for scores).
   Erasure happens when the account is deleted (`ON DELETE CASCADE`). *Open:* do candidates need a "withdraw" flag?
3. `consents` require an expiry within 365 days; a consent can only be revoked, once. No row means private.
4. The rate limit (5 requests per hour per candidate) lives in a trigger; the number is easy to change.
5. `verified_by` must look like `verifier:<adapter>:<version>`, so a user can never be recorded as the verifier.
6. `trusted_issuers` has no browser access in Phase 1. If the UI later shows "issuer recognised", add a narrow view.

## Open questions for the owner
- Raw credentials and uploads contain personal data (`evidence.raw_credential`): retention period, and whether `identity`
  evidence should store only a reference.
- Where will the verification service run (an Edge Function with the service-role key)? That key must never reach the browser.
- Consent wording and the exact `scope.parts` vocabulary (`profile`, `evidence`, ...) before any employer feature.

## How it was tested
`test.mjs` builds the audited production schema plus the 2026-10-05 migration in PGlite (real Postgres compiled to
WebAssembly), applies this migration, and runs 71 scenarios: isolation between candidates, privilege escapes, immutable
versions, the state machine, trust eligibility, the audit trail, consents, rate limit, anonymous access, the existing
score lock, and the down migration. As a check on the tests themselves, removing each of seven safeguards from the SQL
makes the matching tests fail.

    npm i @electric-sql/pglite        # in any scratch folder
    REPO=/path/to/repo node docs/database/phase1/test.mjs

Differences from real Supabase to confirm on a staging project before production: default function and table privileges
(the migration revokes then grants explicitly), `security_invoker` views (PostgreSQL 15 or later), and the `service_role`
bypass.

## Applying it (only after approval)
1. Create a **staging** Supabase project with the same schema (or a Supabase branch) and run the migration there; repeat the
   checks below and the actor tests by hand.
2. Take a backup of production, then run `001_phase1_foundation.sql` once in the SQL editor (it is one transaction).
3. Verify: 7 new tables exist with RLS on; `select tablename, policyname from pg_policies where tablename in (...)`;
   the browser cannot insert `verification_status`; `anon` cannot read the new tables.
4. To undo: run `001_phase1_foundation.down.sql` (drops the new objects only).

## Applied to production (2026-10-05)
Applied with `supabase db query --linked -f 001_phase1_foundation.sql`; file SHA-256 `58df1ca0029ce408…`. The owner chose to skip a
separate staging project; the compensating checks were:
- Pre-flight (`preflight.sql`): no name clash; PostgreSQL 17.6; `service_role`, `auth.uid()`, `employers` present; the earlier
  score-lock migration present. Run again immediately before applying.
- Catalog checks after applying: RLS on for all 7 tables; both views `security_invoker=true`; `anon` has no privilege on any new
  object; `authenticated` can write only the claim columns and `withdrawn_at` on `evidence`; all functions are `SECURITY DEFINER` with
  `search_path = public, pg_temp`, executable by `service_role` only; no policy on `trusted_issuers`.
- A self-rolling-back probe on production (17 behaviour checks as candidate, other candidate, anonymous and service role); all passed,
  and nothing was left behind.
- Row counts of every existing table unchanged; website, `ai` function and REST API still up.

Not done: the API-level run of `staging/staging-test.mjs` (it refuses to run against production by design). Do it against a staging
project or local Supabase before the first feature writes real data into these tables. Until then nothing in the app writes to them.
