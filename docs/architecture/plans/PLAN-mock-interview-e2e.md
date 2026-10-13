# Plan: Interview Coach and Mock Interview, end to end

Status: **PLAN. Nothing in sections 4 to 8 is started except step A1.** Written 2026-10-13 for the product owner (Ivy).
Inputs: `docs/audits/MOCK-INTERVIEW-E2E-PHASE0-AUDIT-2026-10-13.md` (facts, sections 14 to 17), `docs/audits/R1-AI-PROXY-MITIGATION-PROPOSAL-2026-10-13.md`, `DESIGN-mock-interview-progression.md`, `INTERVIEW-CONSTRAINTS-PHASE0-AUDIT.md`, ADR-011, 012, 013.
Rules for every step: a step starts only after its gate; SQL, deploy, production configuration, enabling a flag and any money or provider decision need the owner's explicit approval, each time; new branch name per push (repo ruleset); commit text in English; no commit or push unless the owner asks.

## 1. Where we are (verified 2026-10-13)

- Text Mock Interview works; state lives in the browser until the final save. No server session, no history review, no idempotency, no quota.
- Production: sign-up open without email confirmation; `ai` has no per-user budget; both providers on the free tier (owner); fallback chain Gemini then Groq; usage logging live (counts only, no prices); trust score still takes the interview average by trigger; no verified employer, no consent rows.
- UI foundation (PR 2a) is written on `feat/mock-interview-ui-foundation`, tests and build pass, **not committed**.

## 2. Goal and non-goals

Goal: a guided, honest text practice that survives refresh and device loss of state, with server-owned session records, server-enforced limits from measured data, and a path to timed and voice practice.
Non-goals until separately approved: voice, changing scoring or the trust formula, recruiter exposure of practice data, numeric limits without measured usage, signed stateless `start`.

## 3. Tracks and order

```
Track U (UI)      A1 foundation ──► A2 guided next step ──► A3 timed text ──► (voice, blocked)
Track R (risk)    R-a owner checks ──► R-b measure ──► R-c interim limits ──┐
Track S (server)  S1 SQL proposal ──► S2 replica test ──► S3 approved apply ──► S4 session API ──► S5 unified AI gate + quotas ──► S6 reconciliation
Track T (trust)   T1 read-only report (done) ──► T2 consent-only access (separate approval, not part of this plan)
```

Order of work: R-a and A1 now (no dependency); S1 in parallel (documents only); A2 after S4; A3 after A2 and the soft-limit approval; S5 only with owner-approved numbers.

## 4. Track R: the open `ai` proxy (R1)

| Step | Work | Gate / approval | Done when |
|---|---|---|---|
| R-a | Owner checks: Gemini project has no billing account attached; provider quotas known; decide whether sign-up requires email confirmation (dashboard setting, owner only) | owner | answers recorded in the R1 document |
| R-b | Pull 7 days of `ai` logs, group `[usage]` by `feature`, report p50/p95/max tokens and chars, failed-attempt share, calls per `user_ref`, unlabelled calls | owner downloads logs; I analyse | table in the R1 document; no limit chosen yet |
| R-c | Interim ceilings (M2) and per-label ceilings (M1, clean-up only) | owner approves the numbers after R-b | tests proving every legitimate call in the R1 impact table still passes; deploy by the owner |
| (S5) | Real per-user budget (M3) | SQL approved | quota invariants hold under concurrent tests |

Not planned: closing `ai`, banning PDFs (onboarding, JD Analyzer, cover letter, salary script and question generation need them).

## 5. Track U: UI

**A1 Foundation (done, uncommitted).** Scope: practice-mode panel with voice disabled and explained; continue-on-this-device; optional elapsed timer; progress panel; honest wording for drafts and failures; tab-close warning; focus to feedback; "AI estimate" caption. Gate to merge: owner reviews locally, `npm test` and `npm run build` green (they are). Rollback: revert the PR; no data or server change.

**A2 Guided next step.** After a finished session, one next step with a reason and four choices (take it, review feedback, continue as is, preview). Based on finished-session count and the user's choice, never the AI score. Copy in one reviewable file. Needs approval P1, P2 of the progression design. Tests: never locks, never says "ready/not ready", never reads a score. Depends on S4 only if "finished sessions" must come from the server; the local count from `memory.mockSessions` is enough for a first version.

**A3 Timed text.** Opt-in challenge, soft limit, answer kept at zero, switch back to untimed, time never affects the score. Needs P3, P4 (the default time values are the owner's). Tests: answer preserved at zero, no score input from time, untimed always reachable.

**Voice (L3) and simulation (L4): blocked.** Unblock requires the owner's decisions on provider, privacy and consent, storage and retention, maximum duration and cost; then a separate plan. Until then the UI shows the disabled, explained option (already done in A1).

## 6. Track S: server session, ledger, limits

| Step | Work | Gate | Evidence |
|---|---|---|---|
| S1 | SQL **proposal document**: tables for session, submission (question id and version, revision), AI request (idempotency key, state, estimated and actual tokens, policy version), atomic reservation function, unique constraints, RLS following the owner-scoped pattern of the Phase 1 tables, retention options listed (no period chosen), compatibility with existing `mock_sessions` rows and the triggers, undo script | owner approves drafting (given) | document reviewed by owner |
| S2 | Run the SQL on the in-memory replica (`docs/database/replica-test/`), including concurrent reservation tests and RLS cases (user A cannot read user B) | S1 approved | test output committed |
| S3 | Owner applies SQL by hand in the SQL Editor; I give paste-ready steps, one at a time, with read-only verification queries | explicit owner approval | verification results recorded in `docs/database/README.md` |
| S4 | Session API in `score-interview`: create session with stored question set, submit with idempotency key, get session; states created, in progress, completed (abandoned only if the product needs it); same payload and key returns the same result, different payload is rejected | S3 applied | handler tests: ownership, state transitions, duplicate request, unknown outcome |
| S5 | One execution gate for `ai` and `score-interview`: allowlisted provider and model, bounded input and output, retries and total time, atomic per-user and per-session reservation, actual usage settled | owner-approved numbers from R-b | concurrency tests on the replica; no alternate AI entry point bypasses it |
| S6 | Reconciliation for unknown outcomes (Approach B, ADR-012): release the concurrency slot only when the server knows it has stopped holding the request; keep the cost reservation until settled or expired; operator runbook | S5 | failure-matrix tests (timeout, 429, malformed output, missing usage metadata, duplicate settlement) |

Server-side feature flag (env secret per function) controls the new session endpoints; the browser flag only hides UI. Rollback disables new sessions and keeps the protections for requests already accepted. A flag does not undo provider usage or database writes.

## 7. Track T: trust boundary (report only)

Verified live: interview average reaches `candidate_trust_profiles` by trigger; policy `recruiters can read visible profiles` is still in force; 0 verified employers, 0 consents. This plan does not change it. Standing rule: no employer is verified until consent-only access is applied and tested, or the owner decides in writing. No wording may say practice scores are separate from the trust score. Ask for a re-run of the read-only counts before any employer verification and before releasing S4.

## 8. Testing and release

Every step: a test that fails on the old behaviour; `npm test` and `npm run build`; legacy rows from `mock_sessions` load (T-D3); replica run for SQL; stated list of what was not run (deployed function, live RLS, real model). Never use paid or production AI calls for load tests; concurrency tests run against mocks and the replica. Release: non-production first (UNKNOWN whether a staging project exists; the owner confirms), checklist, flag procedure, monitoring of the `[usage]` lines, rollback plan, acceptance report mapped to the Definition of Done. Production rollout only on the owner's explicit authorisation.

## 9. Owner decisions and actions, in the order they are needed

| # | Needed for | Item | Type |
|---|---|---|---|
| 1 | A1 | Commit the UI foundation branch (and open the PR yourself) | decision |
| 2 | R-a | Confirm no billing account on the Gemini project; provider quotas | check |
| 3 | R-a | Email confirmation at sign-up: yes or no | decision |
| 4 | R-b | Download 7 days of `ai` logs | action |
| 5 | A2 | Progression P1, P2 | decision |
| 6 | S1 | Review the SQL proposal; retention options for answer text (N2) | decision |
| 7 | S3 | Apply SQL by hand when approved | action |
| 8 | A3 | P3 soft limit rule; P4 time values | decision |
| 9 | S5 | Limit numbers from R-b | decision |
| 10 | Voice | Provider, privacy, retention, duration, cost | decision (separate plan) |

## 10. Risks

Free-tier quota exhaustion by account farming makes real users see "busy" (R1); local-device state is not a server record, so A2 and A3 must not claim saved progress; harder modes feed the same trust row; the progression wording can read as a grade; stale documents (`FAILURE_MATRIX`, `SYSTEM_MAP`, `DATA_LINEAGE`) mislead readers until updated, update them in a docs-only PR; the receipt TTL of 2 hours bounds how long a device-kept session can be saved.

## 11. Next action

Waiting on decision 1 (commit A1) and the checks 2 to 4. In parallel, with no approval needed beyond what is given, I draft S1 (documents only).

## 12. Added 2026-10-13: finding P0-T, score tables writable by signed-in users

The ACL read on production (see `docs/database/proposed/PROPOSAL-practice-session-ledger-2026-10-13.md` sections 10.2 and 10.3) shows `INSERT` and `UPDATE` open to `authenticated` on `mock_sessions`, `star_stories`, `resume_scans`, contradicting the 2026-10-09 record. **New step T0, before S2:** (1) read-only check for forged rows; (2) the owner decides whether to re-apply the existing server-only-writes SQL; (3) apply by hand, one step at a time; (4) re-run the ACL query and a live save test; (5) record the result in `docs/database/README.md` including the unexplained difference. No other step of this plan changes.

## 13. Decision D-3 recorded 2026-10-13: option C

The original answer is not stored on the server (first version). Server keeps question set, progress, feedback and score (no verbatim quotes), answer hash and length, and the cost ledger. See section 6 of `docs/database/proposed/PROPOSAL-practice-session-ledger-2026-10-13.md`. New obligations: (a) three pre-release checks (draft recovery, no answer text in logs or tables, deletion matches the published policy); (b) the owner reads Gemini and Groq current data-use terms for free tiers before the Privacy wording is written; (c) the Privacy and Terms pages must state what is stored and how to delete it; (d) the evidence-quote idea for feedback is shown live only, never persisted.

## 14. Provider data terms read 2026-10-13

Gemini free tier may use submitted content to improve Google products and let human reviewers read it; Groq's page says it does not retain inference data by default (its Services Agreement and DPA are unread). See `docs/audits/AI-PROVIDER-DATA-TERMS-2026-10-13.md`. A platform decision (options A to D there) is needed before the Privacy page is written; it is outside this plan's scope but blocks the Mock Interview privacy wording.
