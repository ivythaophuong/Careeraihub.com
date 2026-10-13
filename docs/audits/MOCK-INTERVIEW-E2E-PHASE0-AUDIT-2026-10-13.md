# Phase 0 audit: Interview Coach and Mock Interview, end-to-end implementation contract

Status: **read-only audit plus UI/state specification. No application code, SQL, environment or production change was made.**
Written 2026-10-13 for the product owner (Ivy). Supersedes the *facts* of `INTERVIEW-CONSTRAINTS-PHASE0-AUDIT.md` (2026-10-11) where they differ; that document's owner decisions (ADR-012, ADR-013) still stand.

Labels: **VERIFIED** (read in source/docs or run) · **INFERRED** (with evidence) · **UNKNOWN** · **PROPOSED** · **APPROVAL** (owner approval required).

---

## 1. Summary

1. The Mock Interview exists and works for text: `HiringManagerSim.jsx` (5 questions, persona, per-answer AI feedback, retry-as-practice, summary, save). Everything is **client-held state** until the final save. There is **no server session**, no resume, no draft persistence, no voice. VERIFIED.
2. Two of the three reachable AI calls are bounded by `score-interview` (HMAC receipts). **Question generation still goes through the open `ai` proxy**, unsigned and unmetered against any budget. VERIFIED.
3. Since the 2026-10-11 audit, **PR 2 has landed**: an overall fallback deadline (`DEFAULT_DEADLINE_MS = 90_000`, `AI_DEADLINE_MS` secret) and usage metering (log only, `PRICE_TABLE` empty). Production deployment of those function versions: **UNKNOWN**.
4. **No quota, entitlement, credits, concurrency control, idempotency or cost ledger exists.** The only limits are 20 req/min/user/instance (in memory) and 10 saved sessions per 24 h (count-then-insert, not atomic). VERIFIED.
5. **Voice has no foundation**: no recorder, STT provider, storage or retention decision in the repo. VERIFIED (grep for MediaRecorder / getUserMedia / SpeechRecognition / whisper found nothing). ADR-012 forbids choosing a provider without the owner.
6. **Trust Score conflict persists** (ADR-012 #3, ADR-013): `mock_sessions.avg_score` feeds `trust_score` by trigger. The contract says practice must not become recruiter evidence. Resolution is gated on consent-only access, not on this work.
7. **The contract and the approved design disagree in places** (section 8). The largest: the contract asks for server-persisted sessions, resume and history, which needs SQL; the owner has approved "no limit values before measured usage".
8. Baseline: `npm test` on `fix/dashboard-mobile` @ `0804677`: **143 files passed, 1 skipped; 2052 tests passed, 24 expected-fail, 4 skipped, 17 todo; 0 failed.** Run 2026-10-13.

## 2. Repository state

| Item | Value |
|---|---|
| Branch / SHA | `fix/dashboard-mobile` @ `0804677f9df478614c0fb7774cfcb4f2f492a205` (the session's initial snapshot said `main`; the live checkout is this branch; it is not `main`) |
| Working tree | untracked only: White Paper HTML and four `docs/audits/*` files (not mine); this file is new and untracked |
| Canonical docs read | `CLAUDE.md`, `docs/DECISIONS.md` (ADR-001..013), `INTERVIEW-CONSTRAINTS-PHASE0-AUDIT.md`, `PR2-BRIEF`, `DESIGN-mock-interview-tier0.md`, `docs/database/README.md` |
| Not re-read this pass | `PLATFORM_ARCHITECTURE.md`, `AI_ARCHITECTURE_CONTRACT.md`, `FAILURE_MATRIX.md`, `MIGRATION_MATRIX.md`, `REGRESSION_TEST_PLAN.md`. `AI_ENTRYPOINT_INVENTORY.md` is known stale (it predates fallback and metering). Treat the inventory in section 3 as the current one. |

## 3. AI entry points reachable from Interview Coach (re-derived from source)

`InterviewCoach.jsx` is a tab shell over `HiringManagerSim`, `STARBuilder`, `WeaknessRadar`, `ReadinessScore`, `MemoryDashboard`.

| # | Call site | Path | Auth | Limits | Persisted | Notes |
|---|---|---|---|---|---|---|
| A1 | `HiringManagerSim.jsx:83` question generation, feature `mock_questions` | `callLLMFor` → `callLLM` → `ai` | JWT via auth server | maxTokens 2500 (server cap 8192), body ≤ 12 MB, prompt ≤ 200k chars, may carry PDF base64; 20/min/instance | no (React state) | **Unsigned questions; open proxy (R1, R3)** |
| A2 | `:102` `evaluateAnswerOnServer` | `score-interview` `evaluate` | JWT | answer 3000 chars, question 500, CV 6000, 1800 out tokens; 20/min/instance | no; returns HMAC receipt (ts, sig) | server fallback chain with 90 s deadline; client does not retry |
| A3 | `:136` `saveInterviewOnServer` | `score-interview` `save` | JWT | 1–5 items, receipt TTL 2 h, 10/24 h | `mock_sessions` (service role) | no AI call; trigger updates trust score |
| A4 | `:105` legacy `mock_evaluate_legacy` | `ai`, only if `VITE_SERVER_SCORING=false` | JWT | 1800 | `mock_sessions` browser write, now **blocked by applied SQL** | dead-but-reachable; fails closed |
| A5 | STARBuilder (`score-star`, legacy `ai`) | – | – | – | `star_stories` | out of scope for this feature, same boundary |
| A6 | `MemoryDashboard.jsx` personalised plan | `ai` | JWT | 1500 | state | model sets `overallProgress` |
| A7 | `WeaknessRadar`, `ReadinessScore` | none | – | – | – | VERIFIED no AI/fetch |

Bypass: any signed-in user can call `ai` directly with arbitrary prompts. Any limit placed only in `score-interview` does not protect cost. VERIFIED.
Unaccounted: function versions deployed on production (UNKNOWN); the prompt content `buildMemoryContext` sends in A6 (UNKNOWN, not re-read).

## 4. Request lifecycle today

Browser → `callLLM`/`post` (Supabase session token, 100 s client timeout; `callLLM` retries once on 429/5xx/timeout/network) → Edge Function → `authenticate` (auth server) → per-instance rate limit → validation → `callWithFallback` (sequential providers, 80 s each, 90 s overall) → response. Save path: receipts verified with HMAC, average computed server-side, `mock_sessions` row inserted with `user_id, mode, questions_count, avg_score`. A client abort does not cancel the function (the deadline bounds it) and does not prove the provider stopped billing. VERIFIED.

## 5. Data, entitlements, flags

- **Schema:** `mock_sessions` known columns: `id`, `user_id`, `mode`, `questions_count`, `avg_score`, `created_at`. Full DDL, indexes, FKs and RLS: **UNKNOWN from repo** (no migrations; `docs/database/` holds hand-applied records). Privileges after applied S4: authenticated has SELECT and DELETE only. The browser loads the newest 20 (`SESSIONS_KEPT`).
- **What is not stored:** questions, answers, feedback, drafts, retries. The `memory.mockSessions` record the app builds keeps first attempts only and is in `user_memory`/React state; the DB row keeps only the average. **A completed session cannot be reviewed question-by-question after a page reload today.** VERIFIED.
- **Entitlements / credits / tiers:** none (X3 of the earlier audit still holds). `docs/product/PRICING-AND-CREDITS-STRATEGY.md` says no credits system exists.
- **Feature flags:** only `VITE_SERVER_SCORING` (build time; turning it off breaks save because of S4). No server flag, no per-user flag. A flag for this work is **PROPOSED** and needs a server-side switch (APPROVAL for the mechanism).
- **Providers:** chosen from secrets; chain order `AI_FALLBACKS`; prices unknown (`PRICE_TABLE` empty on purpose).

## 6. Findings (ranked)

| Id | Sev | Finding |
|---|---|---|
| R1 | High | `ai` is an open proxy; no daily/budget cap; per-instance 20/min only |
| R2 | High | `evaluate` has no session, idempotency or per-question cap: unlimited re-grades, best receipt can be saved |
| R3 | Medium | Questions not signed; user can pick their own |
| R4 | Medium | Save count-then-insert is not atomic; same graded answer can be saved in several sessions |
| R5 | Medium (reduced) | Fallback now has a 90 s deadline; cost of abandoned requests still unreconciled |
| R6 | Medium | Practice average → `trust_score` → recruiter-readable table (ADR-012/013) |
| R7 | Low-Med | In-memory rate limiter is per instance |
| R11 | Medium | **UI gaps vs. contract:** no resume, no draft save, no history review, no setup beyond persona+role, no unknown-outcome state, leave-confirmation covers only Exit button, no elapsed timer, no side panel |
| R12 | Low | Skip + retry logic, summary and HMS flow live in one 395-line component; `HiringManagerSim.test.jsx` and `sessionRoundTrip.test.js` pin the current call order |

## 7. UI/UX contract mapped onto the existing app

Design system: inline-style components in `src/components/CommonUI.jsx` (`Card`, `Badge`, `Btn`, `Spinner`, `EmptyState`, `NextStepBanner`), palette `C` in `src/styles/theme.js`, dark default. Interview Coach tabs use `--lp-*` CSS variables. No router; screens are state phases. **Recommendation:** keep `simulate` → `InterviewCoach` → "Live Session" tab as the route; implement Screens A–H as phases inside the existing feature, extracting phase components from `HiringManagerSim.jsx`. Do not add a module or route.

Mapping: A landing = current `select` phase plus Continue/Recent; B setup = role, persona, (question count only if server range approved); C active; D/E feedback = current `current` card plus states; F results = `summary`; G history = `memory.mockSessions` first, server history only after SQL approval; H error states = shared `SessionNotice` component. Voice option rendered **disabled with explanation** until Phase B (ADR-012, section 11 of the earlier audit).

### UI-state matrix (contract section 5)

Legend: persisted = where the truth lives. "Today" = what the code does now; "Target" = what this contract needs.

| Action | Client validation | Server request | Persisted (today → target) | Loading | Failure / retry | Recovery |
|---|---|---|---|---|---|---|
| Start session | role or resume present | A1 today; target `start` creates session + signed question set | none → session row (SQL) | "preparing questions" | confirmed failure: nothing consumed, safe to retry; unknown (timeout): do not auto-retry, show "may have used allowance" | target: reopen same question set from session id |
| Continue session | eligible session exists | target `get session` | none → session row | skeleton | not found / expired → H state, offer new | server is source |
| Generate/retrieve questions | – | A1 / target stored set | state → stored set | spinner | as Start | never regenerated on rerender |
| Save draft | length ≤ 3000 | target PATCH draft | none → draft column | "Saving…/Saved" | "Save failed, text kept here" | local copy retained in component state |
| Submit text answer | 80?–3000 chars (use `MIN/MAX_ANSWER_CHARS`) | `evaluate` with idempotency key (target) | receipt → submission row | "Saved" then "Evaluating" (two labels) | confirmed fail: answer kept, retry; 429: limit state; unknown: reconcile before retry | answer always preserved |
| Start/stop recording | permission, support, max duration | none until stop | – | recording timer | denied / unsupported / too long states | **disabled until Phase B** |
| Transcribe / review / submit transcript | – | STT call (provider UNDECIDED) | – | – | – | **blocked: APPROVAL (provider, retention, cost)** |
| Request feedback | answer saved | = submit | per above | spinner | per above | per above |
| Navigate questions | only to answered or current | none | – | – | – | – |
| Leave and resume | confirm on any exit path incl. browser unload | none | draft + session (target) | – | – | today: lost; target: resumable |
| Complete session | ≥1 answered | `save` | `mock_sessions` row | "Saving" | save failed shown on results without losing feedback | retry save without re-grading |
| Retry confirmed failure | allowed | new idempotency key only if previous confirmed failed | – | – | – | – |
| Recover unknown outcome | not allowed to resubmit | target `get request status` | request row (SQL) | "Checking…" | – | settle or expire |

Accessibility baseline to implement: labelled textarea (exists), `role="alert"` errors (exists), `aria-live` for the save/evaluation status, focus moved to feedback heading after evaluation, visible focus ring, 44 px touch targets, side panel stacking below 768 px, no colour-only state.

## 8. Conflicts between the contract and approved decisions

1. **Numeric limits** (questions per session, recording seconds, tokens, budget, retention): the contract says propose with evidence; ADR-012 says none before measured usage. No measured usage exists yet (metering deployed state UNKNOWN). → no numbers proposed here. Existing hard-coded values (5 items, 3000 chars, 1800 tokens, 10 saves/day) stay.
2. **Scores:** the contract asks for rubric-based evidence-aware criteria and forbids invented scores; the live feature shows an AI-set 0–100 clamped by code (ADR-011 not yet applied here; Structure Score gated by `ENABLED_LANGUAGES = []`). `DESIGN-mock-interview-tier0.md` D3 says to remove the AI number only when Structure Score is enabled. → keep the existing score, labelled as an AI estimate; no new aggregate; no scoring change (the contract itself forbids it).
3. **Quotations/evidence in feedback:** current feedback schema is `worked / missed / tip / outline`; no evidence-quote field. Adding one means a prompt and `normalizeEvaluation` change plus a code check that a quote is a substring of the answer. PROPOSED, small, testable, no SQL.
4. **Practice → Trust Score:** cannot be fixed by this work; stays gated (ADR-012 #3). No UI text may say practice no longer affects it.
5. **Paste/tab signals:** none exist; ADR-012 #4 forbids them. Consistent.
6. **Hard deadline:** none exists in the UI. Consistent.

## 9. Recommended architecture (smallest sufficient)

Two tracks, split by whether SQL is needed:

**Track 1: no SQL (can start after approval of scope)**
- Extract phase components and a shared `SessionNotice` (Screen H) from `HiringManagerSim.jsx`; add elapsed timer (informational), side panel, `beforeunload`/exit confirmation, two-stage "saved vs. feedback ready" labels, honest voice-unavailable control.
- Local draft in `sessionStorage` (per-viewer convenience only; wrapped in try/catch); states for unknown outcome (client timeout is "unknown", not "failed").
- Evidence check: if `quote` is added, code verifies it occurs in the answer, otherwise drops it (never fabricated).
- Route `mock_questions` through a bounded path: either a `start` action in `score-interview` (needs signing key only, no SQL) or keep `ai`. A signed question set with `session_id` derived from HMAC (stateless) closes R3 without SQL. PROPOSED.
- Server tests with mocked providers for timeout, 429, malformed JSON.

**Track 2: needs approved SQL**
- Session + request ledger (session id, status, policy version, idempotency key, request state, estimated/actual tokens), atomic reservation function, atomic save with unique constraint. Needed for: R2, R4, true resume, history review, quotas, unknown-outcome reconciliation (Approach B). Proposal to be drafted as a separate document and tested on the replica first (`docs/database/replica-test`). Not applied; not drafted here.

Flag: a server-side switch (env secret read by the Edge Functions) controlling `start`/new session endpoints, with the browser flag only hiding UI. PROPOSED.

## 10. Proposed sequence

1. **PR 1 (this document, docs only)** → owner approves scope.
2. **PR 2a UI foundation (Track 1)**: phases, notices, timer, exit protection, draft, voice-unavailable, tests. No backend change.
3. **PR 2b signed `start` + R3/R4 hardening that needs no SQL** (deploy of `score-interview`, APPROVAL).
4. **SQL proposal PR** (docs only) → replica test → owner applies by hand per `docs/database/` practice.
5. **PR 3–4**: session/ledger, idempotency, route `ai` and `score-interview` through one execution gate.
6. **PR 5**: quotas from measured usage (needs owner numbers), Approach B reconciliation.
7. **Voice**: only after provider/retention/cost approval.
8. **Release prep**: checklist, flag procedure, rollback, acceptance report.

## 11. Approvals needed before implementation

| # | Decision | My recommendation |
|---|---|---|
| 1 | Approve Track 1 as the first scope (UI foundation, no backend, no SQL) | Yes |
| 2 | Deploy state of `ai`, `score-star`, `score-interview` on production, and whether `USAGE_LOG_SALT` is set (so measured usage can exist) | Ivy checks and tells me; otherwise UNKNOWN stays |
| 3 | Stateless signed `start` (no SQL) vs. waiting for session tables | Stateless first; sessions after SQL |
| 4 | Whether evidence quotes may be added to the feedback schema (prompt + normaliser change) | Yes, with a substring check |
| 5 | SQL: allow me to draft (not apply) the session/ledger proposal | Yes, docs-only |
| 6 | Server-side feature flag mechanism | Env secret per function |
| 7 | Voice: provider, retention, max duration, cost | Not decided; stays unavailable |
| 8 | Numeric limits and budgets | Wait for C1 usage data |
| 9 | Branch strategy: the current branch is `fix/dashboard-mobile`; work should start from `main` on a new branch name (GitHub ruleset allows one push per branch) | Confirm |

## 12. Not verified in this pass

Production function versions; production RLS on `mock_sessions`; Supabase Edge wall-clock limit; real provider prices; whether the deployed bundle has `VITE_SERVER_SCORING` on; the 5 architecture docs listed in section 2; browser support matrix for MediaRecorder.

## 13. Evidence

- `npm test` 2026-10-13: Test Files 143 passed | 1 skipped (144); Tests 2052 passed | 24 expected fail | 4 skipped | 17 todo. Log kept in the session scratchpad only.
- Files read in full: `HiringManagerSim.jsx`, `score-interview/handler.js`, `serverScoring.js`, `aiFeature.js`, `InterviewCoach.jsx` (first 80 lines), `DESIGN-mock-interview-tier0.md`, `DECISIONS.md`, `INTERVIEW-CONSTRAINTS-PHASE0-AUDIT.md`, `PR2-BRIEF`. Partially read: `ai/handler.js`, `ai/providers.js`, `_shared/usage.js`, `CommonUI.jsx` (exports only), `docs/database/README.md`.

---

## 14. Addendum (2026-10-13, after owner review): R1 consumer map, deadline semantics, doc freshness, revised order

Still read-only. No code, SQL, config or deploy.

### 14.1 Architecture documents read this pass

| Document | Freshness against `0804677` |
|---|---|
| `FAILURE_MATRIX.md` | **Stale.** Says "no fallback, single provider per request", "no request id", "Logged: no". Source now has `callWithFallback`, a 90 s deadline, a `requestId` in 4xx/5xx bodies, and usage log lines. Do not use its "Fallback" and "Logged" columns. |
| `AI_ENTRYPOINT_INVENTORY.md` | Stale (same reason); section 3 and 14.2 here replace it for this scope. |
| `PLATFORM_ARCHITECTURE.md` (406 lines), `AI_ARCHITECTURE_CONTRACT.md` (206), `MIGRATION_MATRIX.md` (131), `REGRESSION_TEST_PLAN.md` (115) | Skimmed by headings and grep only (section 6 AI architecture, section 7 resilience policy, section 8 trust). **Not read line by line**; whether they conflict with section 9 of this audit is UNKNOWN until read. This is the remaining gap for Step 1. |

### 14.2 Every consumer of the `ai` function (R1), from `grep callLLM` in `src`

All go through `callLLM` (`src/lib/ai.jsx`) with a client-chosen `feature` label.

| Feature label | File | maxTokens | PDF? |
|---|---|---|---|
| mock_questions | HiringManagerSim.jsx:83 | 2500 | yes |
| mock_evaluate_legacy | HiringManagerSim.jsx:105 | 1800 | no (only if `VITE_SERVER_SCORING=false`) |
| star_review_legacy | STARBuilder.jsx:63 | 2500 | no (legacy path) |
| ai_coach | AICoach.jsx:141 | 600 | no |
| memory_plan | MemoryDashboard.jsx:60 | 1500 | no |
| jd_analyze | JDAnalyzer.jsx:41 | 2500 | yes |
| scan_template_parse, scan_jd_match | ResumeScan.jsx:167, 223 | per call | no |
| ats_parse, ats_bullet_rewrite | ATSBuilder.jsx:110, 606 | per call | no |
| cover_letter, cover_letter_tone | CoverLetterGen.jsx:38, 77 | 2500, 1500 | yes (first) |
| skills_gap | SkillsGap.jsx:82 | per call | no |
| salary_market, salary_script | SalaryCoach.jsx:83, 291 | per call, 3000 | yes (script) |
| onboarding_pdf_extract, onboarding_profile | App.jsx:365, 601 | 3000, 800 | yes (first) |
| (unlabelled) | resumeParser.js:42, 56 | per call | possibly |

Facts that constrain a fix:
1. `feature` is a **client-supplied label** (`sanitizeFeature` only checks its shape). It cannot be a security gate.
2. 17+ product features depend on `ai`; closing it blindly breaks onboarding, ATS, scan, cover letter, salary, skills gap, coach.
3. The server enforces only: auth, 20/min/instance, body ≤ 12 MB, prompt ≤ 200k chars, ≤ 20 messages, output ≤ 8192 tokens. **No per-user daily or token budget exists anywhere.** A signed-in user can send up to about 200k characters (plus a 10 MB PDF) with 8192 output tokens, repeatedly, at 20 per minute per instance. VERIFIED from `validate()` and `LIMITS`.
4. Whether sign-up needs email confirmation, and how many instances run: UNKNOWN, so real exposure is UNKNOWN. I have not tried to exploit it.

R1 mitigation options (nothing built; owner picks):

| Option | SQL | Effect | Risk |
|---|---|---|---|
| M1. Per-feature ceilings on the server (an allowlist `feature → max tokens, max prompt chars, PDF allowed`, unknown label gets the strictest ceiling), values taken from the table above | no | caps size of each call and removes PDF for features that never send one | label is spoofable, so an attacker picks the loosest label; helps against accidents, only bounds the worst call |
| M2. Lower global ceilings (prompt chars, `maxTokensCap`) from C1 log data | no | bounds every call | too low breaks long CVs; needs measured data first |
| M3. Durable per-user daily counter (calls and tokens) in `ai` | **yes** (the ledger of Track 2) | the only real budget control | needs SQL approval, replica test, atomic reservation |
| M4. Dedicated authenticated functions per feature (like `score-*`) and close `ai` | no for the split, large work | removes the open proxy | large; each feature migrates separately; high regression cost |

Recommendation: M1 plus M2 as a no-SQL interim (after C1 numbers exist), M3 as the real fix inside the session/ledger design. Nothing is claimed safe until M3 exists.

### 14.3 Deadline and timeout semantics (reviewer point A)

- Each provider attempt has an `AbortController`; the chain stops starting new attempts when less than 5 s of the 90 s remain (`providers.js:218-225`). Worst case in time: first attempt up to 80 s, later attempts bounded by what remains, so the chain ends about 90 s after start. VERIFIED in source; covered by `fallback.test.js` per the PR 2 brief (test not re-run individually, but the full suite passed).
- It does **not** bound cost: each attempt that reached a provider may be billed. Up to one attempt per keyed provider (max 7 in `DEFAULT_MODELS`) can start inside 90 s if the earlier ones fail fast.
- Aborting `fetch` closes our connection. Whether the provider stops generating or stops billing: UNKNOWN per provider.
- Usage is emitted on success **with** token usage; on error or timeout the event carries `durationMs` and no usage (`providers.js:232`). So tokens of timed-out or failed attempts are **not recorded**. A timed-out attempt is therefore invisible to cost accounting today. VERIFIED.
- The client retries once on 429/5xx/timeout/network (`callLLM`); each client retry starts a new server chain. `score-interview` calls (`post`) do not retry.

### 14.4 Practice to recruiter path (reviewer point on Trust Score)

From `TRUST-SCORE-TRACE.md` (2026-10-11, read this pass) and ADR-013: `mock_sessions.avg_score` (average of the newest 5 sessions) is 35% of `trust_score` by trigger `recompute_trust_score`, whose body is **not in the repo** (read from the live DB on 2026-10-09 by the owner). Employer Portal in non-consent mode reads `candidate_trust_profiles` directly and shows `trust` and `interview` numbers; the database policy limits that to verified employers. Counts on 2026-10-09: 0 verified employers, 6 profiles, 1 visible, 0 consents (**stale, UNKNOWN today**). So the path exists in code and DB, but no one outside the owner of the profile could see it on that date. Still to verify with read-only SQL by the owner: trigger body today, current policies on `candidate_trust_profiles`, current counts. This feature must not change the trigger and must not write any text saying practice no longer affects it.

### 14.5 Review points accepted and the changes they cause

- **sessionStorage** is a per-device draft convenience only. UI must say "Draft kept on this device", never "Saved". "Saved" is shown only after a server write succeeds.
- **Stateless signed `start`**: not approved. Its benefit (R3: questions cannot be self-chosen) is real but it does not stop requesting many new sets (no ledger) and does not limit re-grading (R2). I recommend deferring it and designing `start` as the first action of the real session table so that nothing needs to be redone.
- **R2** needs a server-side operation identity and a policy-approved cap per question; I will not pick the number.
- **Unknown outcome:** UI shows "Checking…" and offers no blind retry. Without a request ledger the server cannot tell the client the outcome, so until Track 2 the honest state is "We could not confirm whether this was evaluated. Your answer is kept here; trying again may use your AI allowance." This wording must be approved because it is an honest limitation, not a reconciliation.

### 14.6 Revised order (reviewer's, adopted)

1. Finish reading the five architecture documents line by line; list conflicts with this audit.
2. R1: owner picks M1/M2 interim and confirms M3 belongs to the ledger design; produce a mitigation proposal. If the owner can read the Supabase auth settings (email confirmation required or not) and the log volume, exposure can be rated. If not, exposure stays UNKNOWN.
3. UI foundation (Track 1), no scoring change, honest labels per 14.5.
4. SQL proposal (docs only) incl. replica test plan, `start`, idempotency, ledger, reconciliation.
5. Session and unified AI control after approval; then quotas from measured usage.
6. Feedback evidence, history, tests, rollout docs; voice only on a separate decision.

### 14.7 Decisions still open

Owner has not yet marked which of the seven proposed decisions are accepted. Awaiting: (1) UI foundation PR; (2) R1 priority; (3) SQL proposal drafting; (4) signed `start` deferred; (5) voice stays unavailable; (6) scoring and Trust Score untouched with a separate verification report; (7) confirm.

---

## 15. Step 1 completed: the four remaining architecture documents, read in full (2026-10-13)

Read line by line: `PLATFORM_ARCHITECTURE.md`, `AI_ARCHITECTURE_CONTRACT.md`, `MIGRATION_MATRIX.md`, `REGRESSION_TEST_PLAN.md` (plus `FAILURE_MATRIX.md` in section 14). All four carry a **2026-10-09 baseline** (907 tests, "no fallback", "no metering", "no CI"). They are stale on the AI path; they are still the governing intent. Not read: `docs/DATA_LINEAGE.md`, `docs/SYSTEM_MAP.md`, `docs/VERIFICATION_STATUS.md`, `docs/architecture/adr/*` (CLAUDE.md names the first three as control documents; listed as remaining).

### 15.1 Where those documents are stale (verified against `0804677`)

| Statement in the document | Now |
|---|---|
| PLATFORM §6, AI contract §4/§7, FAILURE_MATRIX: single provider, no fallback, `AI_FALLBACK` unused | `callWithFallback` exists, chain from `AI_FALLBACKS`, 90 s deadline |
| PLATFORM §6/§9, MATRIX PR-53: no usage/cost/latency metering | `_shared/usage.js` emits a log line per attempt; `PRICE_TABLE` empty; **tokens only on success** |
| PLATFORM §9: no CI; 907 tests | `.github/workflows/test.yml` exists; 2052 tests pass |
| MATRIX PR-33: server-side writer for AI scores needed | done for `mock_sessions` (S4, `score-interview`, applied 2026-10-09) |
| TEST_PLAN T-U5: `InterviewCoach` wrapper untested | `InterviewCoach.overview.test.jsx` exists |
| AI contract §7: provider 401/403 should not be retried by the client | still true: `statusFor` maps it to 500 and `LLMError.retryable` is `status >= 500`, so the client retries once pointlessly (code read; not exercised) |

### 15.2 What those documents require of this work (no conflict found, four obligations)

1. **Gateway target (PLATFORM §6):** "one server-side entry … per-user and global limits at the provider and in the gateway". This is the same design as M3 and Track 2; the Mock Interview work should be the first consumer of that gateway, not a parallel one. No conflict.
2. **Persistence preconditions (PLATFORM §5, D5):** audited schema, RLS, ownership, deletion and retention policy, backfill plan, backward-compatibility tests, no migration before a reviewed design. The SQL proposal must carry all of these. Retention for answer text is undecided (N2 open): **the proposal cannot fix a retention period; it must list options and ask**.
3. **Build on the live model, not beside it (PLATFORM §11):** Phase 1 tables are in production (`career_profiles`, `career_targets`, `evidence`, `trusted_issuers`, `verification_requests`, `verification_attempts`, `consents`; read from `docs/database/phase1/001_phase1_foundation.sql`). **None is a session, usage or idempotency table**, so new tables are unavoidable for those; `consents` is the existing pattern to follow for anything shared with recruiters.
4. **Score vocabulary (PLATFORM §11, contracts v1.1):** `AI_ESTIMATE` and `PRACTICE_SCORE` are the defined types, and unknown is `null`. UI labels for Mock Interview scores should use those words ("AI estimate", "practice score") rather than new ones. ADR-013 Q-D adds `score_type`/`score_version` columns for `mock_sessions` as a proposal; the session SQL must not collide with it.

### 15.3 Test obligations inherited (REGRESSION_TEST_PLAN section 4 gates)

For each PR in this work: a test that **fails on the old behaviour**; `npm test` and `npm run build` green; legacy-data scenario T-D3 (old `mock_sessions` rows, null new columns, load and render); replica run of any SQL in `docs/database/replica-test/`; a documented rollback; and a stated list of what was not run (deployed function, live RLS, real model). Also T-S4 (document exactly which fields `buildMemoryContext`/`buildSystemPrompt` send): still unread, relevant to A6.

### 15.4 Outcome

Step 1 is complete for the five named documents. No contradiction with sections 8 to 10 of this audit. Three control documents remain unread (`SYSTEM_MAP`, `DATA_LINEAGE`, `VERIFICATION_STATUS`) plus the ADR folder; I will read them before the R1 proposal so the consumer table is cross-checked against `DATA_LINEAGE`.

### 15.5 Owner decisions recorded from the 2026-10-13 review (as given, not widened)

| # | Decision | Scope limit |
|---|---|---|
| 1 | UI foundation PR allowed, on a new branch from `origin/main`, after the docs are read | UI, error states, local draft, exit protection. No scoring, no schema |
| 2 | R1: **draft the options only**; M1 and M2 are not applied | First: inspect existing logs and tabulate impact on every `ai` consumer; M2 only after the effect on legitimate users is known |
| 3 | SQL proposal allowed, documents only | session, ledger, atomic limit, idempotency, unknown-outcome reconciliation, replica test plan. Nothing run on production |
| 4 | Signed `start` deferred | |
| 5 | Voice stays unavailable | until provider, privacy, retention, duration and cost are decided |
| 6 | Scoring and Trust Score untouched | but verify `mock_sessions.avg_score` → `trust_score` path with read-only queries (owner runs them) |
| 7 | Close after the documents are read | done for five documents; three control docs remain |

UI wording rules adopted: local draft says "Draft kept on this device"; "Saved" only after server confirmation; an unconfirmed request shows an undetermined state, with no blind resend.

### 15.6 What cannot be answered from the repo (stays UNKNOWN until the owner looks, read-only)

Email confirmation required at sign-up; which function versions are deployed; whether `USAGE_LOG_SALT` is set; whether `[usage]` log lines exist and how many; trigger body, policies and counts for `candidate_trust_profiles`. None requires changing configuration.

---

## 16. Public, read-only checks done by the assistant (2026-10-13)

Only unauthenticated or anon-key requests the browser itself makes. No account created, no AI call, no configuration changed.

| Check | Result |
|---|---|
| `GET {prod project}/auth/v1/settings` (project ref matches the one in `docs/database/README.md`) | `disable_signup: false`, **`mailer_autoconfirm: true`** |
| Live site bundle (`careeraihub.com`, `assets/index-BQDVvT6a.js`) | contains `score-interview` (2), `score-star` (2), `functions/v1/ai` (1): the S4 build is live |
| `OPTIONS` on `ai`, `score-interview`, `score-star` | all three answer 204: the functions exist |

**Consequence for R1:** sign-up is open and needs no email confirmation, so anyone can obtain a valid signed-in account in seconds (and make many). The only per-user limit (20/min/instance) is per account, so many accounts multiply it. R1 is therefore **easily reachable**, not theoretical. Actual abuse has not been looked for (no log access). This meets the review's condition to propose a minimal mitigation before the UI work; see the R1 proposal to follow.

Still UNKNOWN (needs the owner's dashboard): deployed function versions and `AI_DEADLINE_MS`/`USAGE_LOG_SALT`, whether `[usage]` lines exist, instance count, trigger body and current counts for `candidate_trust_profiles`.

### 16.1 Functions list read by the owner from the dashboard (2026-10-13)

| Function | Created | Updated | Deployments | Requests (last 1 h) | 5xx (1 h) |
|---|---|---|---|---|---|
| ai | 11 days ago | 2 days ago | 26 | 1 | 0% |
| score-interview | 4 days ago | 2 days ago | 11 | none | – |
| score-star | 4 days ago | 2 days ago | 10 | 1 | 0% |
| jobs | 11 days ago | 11 days ago | 13 | none | – |
| verify-cert | 5 months ago | 8 days ago | 17 | none | – |

(The "1" in the Updated column of the pasted text is the request count; the last column is Deployments.)

Reading, INFERRED from dates (the dashboard shows no commit): "2 days ago" is about 2026-10-11. The fallback deadline (`23f4372`, 2026-10-11) and Stage 1 labels (`e0236d6`, 2026-10-11 15:22) fit that date, so the deployed `ai` very likely has the deadline and metering. Commit `bc2fd45` (2026-10-12 08:55, "one graded answer per question per saved session" in `score-interview`) is **later** than the last update, so it is very likely **not deployed**, which matches `DESIGN-mock-interview-tier0.md` section 13 ("not deployed"). Exact versions: UNKNOWN until the deployed source is compared.
Traffic is very low (about 1 request per hour on `ai`), so abuse is not visible in volume at this moment. That is one hour of data, not a history.

### 16.2 `ai` function logs, last 24 h (owner, 2026-10-13)

The Logs tab of `ai` showed 74 results; the 18 rows pasted were only `booted` and `shutdown` events (deployment version 26, matching the 26 deployments; shutdown reason `EarlyDrop`). No `[usage]` line and no `[ai] answered by` line was among the rows seen. **Inconclusive:** it is not known whether the search filter was applied or whether the other 56 rows contain console lines. `[usage]` presence therefore remains UNKNOWN. Not evidence that metering is absent.

### 16.3 `[usage]` lines found (owner, 2026-10-13; supersedes the "inconclusive" in 16.2)

Logs of `ai`, deployment version 26, window 2026-10-12 ~13:00 to 2026-10-13 12:00 (local). The owner's screenshot and paste show `[usage]` JSON lines and `[ai] answered by ...` lines. **Metering is deployed and writing.** The feature label (`ats_parse`) and `resume_kind`/`resume_chars` are present, so the Stage 1 build is live.

Observed in the sample (about 6 logical calls, all one `user_ref`, all `ats_parse`; likely the owner's own testing; the log window had 74 rows, only a part was pasted):

| Fact | Evidence in the sample |
|---|---|
| Lines hold counts and metadata only: no CV text, no answer, no raw user id (`user_ref` is a 16-hex hash) | all pasted lines |
| Tokens are reported on success including thinking tokens (e.g. input 1707, output 1987, thinking 1022, total 4716, 21.3 s) | success lines |
| Failed attempts carry **no tokens** (`usage_status: not_applicable`, e.g. Gemini 503 after 0.7 to 2.2 s) | error lines |
| Fallback works: Gemini 503 then Groq `openai/gpt-oss-120b` succeeded, 4 of 6 sampled calls needed it | correlation ids 6fb1bbd6, d616b76c, c4a5621f |
| `cost_usd` is `null` / `price_unknown` everywhere (`PRICE_TABLE` empty, as designed) | every line |
| Per-call size seen: 2.9k to 4.7k total tokens for an ATS parse of a 4k-char resume | success lines |

Consequences: (1) C1 data now exists and can feed the limits decision (ADR-012 #1), but only 1 feature (ats_parse) and 1 user appear in this sample, so it is **not** enough to set limits; need a wider pull (download the 24 h log, group by `feature`). (2) Thinking tokens are material (up to ~1000 per call) and are priced differently by provider; a price table must say how. (3) The failed-attempt blind spot in 14.3 is confirmed in real data. Still UNKNOWN: whether `USAGE_LOG_SALT` is a dedicated secret or the service-role key is being used as the salt (code falls back to it, `ai/handler.js:138`).

### 16.4 Edge Function secret NAMES (owner screenshot, values not seen)

Custom secrets present: `GEMINI_API_KEY`, `AI_PROVIDER`, `AI_MODEL`, `ALLOWED_ORIGINS`, `AI_FALLBACK`, `GROQ_API_KEY`, `USAGE_LOG_SALT`. (Default secrets such as `SUPABASE_URL` also exist; not listed fully in the screenshot, so `SUPABASE_SERVICE_ROLE_KEY` and the receipt signing key are not confirmed visible here. The list may continue below the crop: UNKNOWN.)
- `USAGE_LOG_SALT` **is set** (the open point in 16.3 is closed: `user_ref` hashes use a dedicated salt).
- Only two provider keys exist (Gemini, Groq), so the live fallback chain is at most **2 attempts**: Gemini then Groq (`providerChain` includes only keyed providers). This bounds worst-case duplicate billing to 2 provider calls per `ai` request, plus 1 client retry = up to 4. That is derived from code and secret names; the other secrets' absence (OpenAI, Anthropic, OpenRouter) is inferred from the list, not proven.
- `AI_DEADLINE_MS` is not set: the 90 s default applies. `AI_FALLBACKS` (plural, the name the code reads) is not set; **`AI_FALLBACK` (singular) is a leftover name nothing reads** (`AI_ARCHITECTURE_CONTRACT.md` section 4 said so). Harmless; order is `PROVIDERS` order filtered by keys.
- `ALLOWED_ORIGINS` is set (CORS), consistent with localhost being blocked (memory note).

### 16.5 Triggers on the trust inputs, read-only query by the owner (2026-10-13)

All enabled (`O`): `trg_lock_trust_columns` on `candidate_trust_profiles`; on `mock_sessions` `trg_trust_on_mock_session` and `trg_trust_on_mock_session_delete`; the same pair on `resume_scans` and `star_stories`. This matches `docs/database/README.md` (S1 delete triggers applied 2026-10-09; score columns locked). **Verified live: a row written to `mock_sessions` still fires a trust recompute (insert and delete).** The function body, the formula and who can read `candidate_trust_profiles` are not yet read (queries 2 and 3).

### 16.6 `recompute_trust_score` body, read live by the owner (2026-10-13)

VERIFIED on production: interview component = `COALESCE(ROUND(AVG(avg_score)) over the newest 5 mock_sessions, 0)`; ATS = `COALESCE(MAX(credibility_score), 0)`; STAR = average of the newest 5 `star_stories.score`, default 0; `trust_score = ROUND(ATS*0.40 + Interview*0.35 + STAR*0.25)`; upserted into `candidate_trust_profiles`. SECURITY DEFINER, `search_path` fixed. The delete trigger recomputes only for users that still exist in `auth.users`. This equals the 2026-10-09 evidence and `TRUST-SCORE-TRACE.md`: **no change; missing data is still 0, not null**, so ADR-013 Q-C is not yet applied in the database. Practice scores from this feature therefore reach `candidate_trust_profiles.interview_score` and `trust_score` today. Who can read that table is the remaining question (policy query next).

### 16.7 Policies on `candidate_trust_profiles`, read live by the owner (2026-10-13)

Two policies: `candidate owns profile` (ALL, `auth.uid() = user_id`) and **`recruiters can read visible profiles`** (SELECT, `is_visible = true AND is_verified_employer_member()`), both for role `public`. So the legacy recruiter read policy that ADR-013 says must go is **still in force**; `2026-10-09-consent-only-recruiter-access.sql` has **not** been applied (consistent with ADR-013's note). A verified employer member can therefore read `interview_score` and `trust_score` of every visible profile, without per-candidate consent, as soon as one employer is verified. Whether any employer is verified today: counts query next (the 2026-10-09 figure was 0).

### 16.8 Counts, read live by the owner (2026-10-13)

`employers.verified_at is not null`: **0**; `candidate_trust_profiles`: 7 rows, 1 visible; `consents`: 0. So today no recruiter can read any practice score (the policy in 16.7 needs a verified employer member). This is a **current condition, not a protection**: the policy would expose `interview_score` and `trust_score` of visible profiles the moment one employer is verified. ADR-013 standing rule 6 (no employer is verified until consent-only access is applied and tested, or the owner decides in writing) is the only guard and is a human rule, not a database rule. Practice-vs-recruiter path summary: **real in the database, currently unreachable by any recruiter.** This feature must not change it and must not claim otherwise.

### 16.9 Read-only checks completed

Done: sign-up setting (16.0), live bundle and functions (16.0), function list (16.1), `[usage]` lines (16.3), secret names (16.4), triggers (16.5), trust function body (16.6), policies (16.7), counts (16.8). Remaining UNKNOWN: whether a recruiter can self-register and be marked verified only by an admin SQL step (ADR-004 says admin-only; not re-tested here), instance count, and the full list of default secrets.

---

## 17. UI foundation (PR 2a, Track 1) implemented on `feat/mock-interview-ui-foundation` (from `origin/main` @ `f1d6215`), not committed

Changed: `HiringManagerSim.jsx` (practice mode with voice disabled and explained; "Continue your practice" card; optional elapsed timer, hidden by default; progress side panel; honest status wording; unknown-outcome vs known-failure messages; tab-close warning; focus moved to feedback; results caption "AI estimate, not verified evidence"), new `deviceSession.js` (sessionStorage, per user, 2 h, validated, cleared on exit, on a saved finish and on sign-out in `App.jsx`), `sessionUi.js`, `SessionPanel.jsx`. No server, SQL, scoring, prompt or schema change.
Tests: 3 new files (`deviceSession.test.js`, `sessionUi.test.js`, `HiringManagerSim.foundation.test.jsx`); two existing files only gained `sessionStorage.clear()` in `beforeEach`. `npm test`: 147 files passed, 1 skipped; 2094 tests passed, 24 expected fail, 4 skipped, 17 todo, 0 failed. `npm run build` succeeded. Not visually checked in a browser; not tested against a real AI call.
Honest limits: a session kept on this device is not a server session (no idempotency, no quota, closes with the tab); the "answer saved vs feedback ready" two-stage state needs a server record and waits for Track 2; no history review, no setup options beyond persona and role, no question-count choice (needs an approved server range).
