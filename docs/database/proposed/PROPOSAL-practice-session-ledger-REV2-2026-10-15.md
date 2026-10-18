# Practice session ledger, revision 2 (2026-10-15)

Status: **The SQL of this proposal is on production and the gate is on in observe mode (read-only check 2026-10-18, see `docs/database/README.md`); the patch `2026-10-18-ledger-session-owner.sql` is proposed and NOT applied.** (This line said "Nothing here is applied" until 2026-10-18 and was out of date.) Replaces the SQL drafts of `PROPOSAL-practice-session-ledger-2026-10-13.md` with an executable pair that passed the in-memory replica test.
Files: `2026-10-15-practice-ledger.sql`, `2026-10-15-practice-ledger.down.sql`, `docs/database/replica-test/s5-practice-ledger.mjs`.
Project: CareerAiHub (`ruibdsvrcctxgxctaxwe`) only. Never ZenDMS (`obtmsvhejvcfrkfyucev`).
Labels: VERIFIED · UNKNOWN · PROPOSED · APPROVAL.

## 1. Decisions (owner, 2026-10-15, on the assistant's recommendation)

| # | Decision | Result in the SQL |
|---|---|---|
| D-1 | Five tables, approved with five amendments | `ai_policies`, `practice_sessions`, `practice_submissions`, `ai_requests`, `user_usage_windows` |
| D-2 | No policy row: the gate observes and records, it does not block | `gate_mode = 'observe'` on every request; counters still move |
| D-3 | **Decided C (2026-10-13):** no answer text and no audio on the server | no column for it; the replica test fails if one is added |
| D-4 | Settling "unknown" requests: later, after measured use | the upper bound is a policy key, `unknown_settle_after_seconds`; no number is set |
| D-5 | Cascade on account deletion, for all five tables | tested (X2) |
| D-6 | `challenge` and `interaction` columns: later | not added |
| B2 | One global quota in V1 | `ai_policies.feature` exists (default `'global'`); only `'global'` is read |
| D-7 | Fail-open or fail-closed when the database errors | **PROPOSED, needs APPROVAL**, see section 3 |

## 2. The five amendments

1. **B1 zombie requests.** A request left `reserved` or `started` (the function crashed or was killed) is moved to `unknown_pending` once it is older than `stale_after_seconds` (default 300, minimum 30). It happens lazily inside `reserve_ai_request` for that user, and `expire_stale_requests()` does it for everyone (a cron job can call it later; `pg_cron` is available on the project but **not installed**, and this SQL does not need it). The slot is freed; the reserved tokens stay counted.
2. **B2 feature scope.** Policies are keyed `(feature, version)`; V1 reads `'global'`. Per-feature limits later need a new policy row and a `feature` dimension in the usage window, not a new table.
3. **B3 visibility.** `ai_requests.gate_mode` records `observe` or `enforce` for each request; the Edge Function should put it in the `[usage]` log line. `ai_policy_limits_valid()` rejects unknown keys, non-numbers, values at or below zero and a stale time under 30 s, so a typo cannot leave the gate silently open.
4. **B4 D-7.** Not decided in SQL: it is the Edge Function's behaviour (section 3).
5. **B5 privileges.** VERIFIED on production 2026-10-15: the project's default privileges give `anon` and `authenticated` `arwdDxtm` (all, including TRUNCATE, TRIGGER, REFERENCES) on every new public table. The SQL revokes all and grants `authenticated` only `SELECT` (plus `DELETE` on sessions and submissions, so "Clear memory" can erase history). `anon` gets nothing; `ai_policies` is invisible to browser roles; every function is revoked from `public`, `anon`, `authenticated` and granted to `service_role`. A partial index `ai_requests_active (user_id) WHERE state IN ('reserved','started')` serves the concurrency count.

## 3. D-7: what the Edge Function does when the ledger is unreachable (PROPOSED)

| Gate mode | Database error in `reserve_ai_request` | Why |
|---|---|---|
| observe | **Let the request through**, log `gate_error` | nothing is being enforced; do not break users to measure them |
| enforce | **Let the request through in V1**, log `gate_error` with the user reference and raise an alert | the gate is new and unproven; a ledger outage must not take the product down. Revisit (fail-closed for the most expensive features) once there is measured use and an alert |

This is a product and cost trade-off, so it needs the owner's explicit yes. Until the Edge Function code exists (S4/S5, not written), nothing calls these functions.

## 4. What the replica test proves, and what it does not

**Patch 2026-10-18 (APPLIED to production on 2026-10-18, see `docs/database/README.md`): `2026-10-18-ledger-session-owner.sql` and its `.down.sql`.** The 2026-10-15 SQL was applied to production (read-only check 2026-10-18: the functions exist, 0 policies, so the gate observes only; only `service_role` can execute them). `reserve_ai_request` there does not check that `p_session` belongs to `p_user`: the foreign key only proves the session exists. A request could be attached to another user's session and spend its token cap. Not reachable today (the `ai` function passes no session), but it must be applied before any session API passes a session id, and the Edge Function must still never take a session id from the browser unchecked. The patch replaces one function and keeps its privileges; the down script puts the old body back. The replica test applies the patch on top of the 2026-10-15 file: checks E6, E7 and D4 were added (59 of 59).

VERIFIED: `s5-practice-ledger.mjs`, in-memory Postgres (PGlite), **56 of 56 checks pass** on the 2026-10-15 file alone (re-run 2026-10-18). Mutation check: breaking the SQL five ways makes the suite fail each time (revoking removed: 4 checks fail; stale sweep removed: Z2; unique counted index removed: crash; gate forced off: 5 checks; score averaging that counts failed answers: C3; idempotency removed: crash).
It covers: privileges and RLS per role; limit validation; observe vs enforce; concurrency, daily and per-session caps; idempotency; settle once; unknown requests and expiry; zombie requests; one counted attempt per question; completing a session once and the Trust Score trigger; deletion and cascade; the down script and re-applying.

NOT proved (UNKNOWN):
- **True parallelism.** PGlite has one connection, so "parallel" calls are run one after another. The per-user advisory lock is the design, but real concurrent connections must be tested on a staging or the first production run, with a small script.
- The hosted platform's own settings, PostgREST behaviour, and real traffic.
- Edge Function code, cost numbers (no price table), and any limit value.

## 5. Privacy text to add when this goes live (PROPOSED)

The Privacy Policy says "technical logs". The ledger is database rows. Suggested wording: *"We keep anonymous usage records (when a request was made, which feature, how large it was and whether it succeeded) to run and protect the service. They contain no resume or answer text and are removed with your account. Deleting your practice history removes your feedback and scores; the usage records are kept until you delete your account."*

## 6. Application plan (all APPROVAL, one at a time, owner by hand)

1. Read-only checks again on the day (the `mock_sessions` facts were read on 2026-10-15: columns, RLS, grants, cascade, triggers, `pgcrypto`).
2. Take a schema dump to a folder outside the repo.
3. Run `2026-10-15-practice-ledger.sql` in one transaction in the SQL Editor of **this** project (check the address bar).
4. Read back: five tables with RLS on, privileges of `anon` and `authenticated` as in section 2 (read-only query), no row in any table.
5. Nothing changes for users: no code calls the ledger yet.
Rollback: `2026-10-15-practice-ledger.down.sql` (drops the new objects only; deletes stored sessions and the ledger, so export first if any real use occurred; `mock_sessions` is untouched).

## 7. Still open

D-4 and D-6 (later); D-7 (approval); numbers for every limit (after measured use); the Edge Function code (S4 session API, S5 unified gate); real-concurrency test; whether to install `pg_cron` for the sweeper.
