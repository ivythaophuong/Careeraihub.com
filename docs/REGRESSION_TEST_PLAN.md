# Regression test plan (Deterministic-First migration)

Branch `feat/deterministic-score-engine-p0-p4`, HEAD `2e43e14`, 2026-10-09 (re-baselined after `main` was merged mid-audit). Planning only: no test was added. IDs are referenced from
[MIGRATION_MATRIX.md](MIGRATION_MATRIX.md); evidence for the gaps is in [DETERMINISTIC_FIRST_AUDIT.md](DETERMINISTIC_FIRST_AUDIT.md) §6.

## 1. Baseline (CONFIRMED, 2026-10-09)

`npm test` (Vitest, jsdom): 66 files, 907 passed, 4 skipped, ~7 s. Existing layers:

| Layer | Where | Covers |
|---|---|---|
| Unit | `src/**/*.test.js(x)` | ingestion (incl. real/synthetic PDFs, DOCX, protected, zero-page), extraction, validation, scoring, guards, digest, prompts' pure helpers, `useMemory`, session |
| Contract | `tests/contracts/` (19 ResumeFacts + 15 ScoreResult JSON cases) | shape, evidence, confidence, "zero is a value", null-with-reason |
| Boundary | `src/scoring/noAiBoundary.test.js` | scoring imports no AI/network |
| Edge Function | `supabase/functions/{ai,jobs,verify-cert}/handler.test.js` | auth, limits, errors, SSRF allowlist |
| Whole-codebase rules | `tests/security/` (`noSecretsInClient`, `noFakeData`, `noFakeTrustClaims`) | no provider key in bundle, banned fabricated claims |
| Component | ATS Builder gates 3 and 4 (real upload handler), STAR, Salary, HiringManagerSim, JD, Cover, Skills, Memory, Radar, Readiness, Market, AI Coach | UI with mocked `callLLM` |
| Live network | `tests/integration/auth.test.js` | real Supabase auth (credential-dependent) |
| A11y/layout | `tests/a11y/responsiveLayer.test.js` | responsive layer |
| Browser | none automated. A manual real-browser check of the `.pdf` upload path is recorded in commit `b526802` | |

Not covered today (CONFIRMED by listing test files): ResumeScan JD-match failure path (the render and `jd_analyses` write are covered by `ResumeScan.jdmatch.test.jsx`), App onboarding extraction, VerifyCreds, TrustMatch,
EmployerPortal, Dashboard, Career Roadmap, the `InterviewCoach` wrapper. No test calls a real model, the live `ai` function, a real
database or RLS. A green suite therefore does not prove production behaviour.

## 2. Principles

1. Deterministic parts: same input ⇒ identical output on two runs (compare serialised results, not just scores).
2. Unknown is `null`/"not available" and is never rendered or stored as `0`.
3. Every migrated module is tested **old vs new on the same fixtures** before a flag is flipped (shadow first).
4. AI behaviour is tested only through recorded or mocked replies; quality is measured separately (T-Q1), never inferred from unit tests.
5. A test that passes against the previous behaviour for a fix is not a regression test; each fix needs a test that fails on the old code.

## 3. Required tests

### Unit (U)

| Id | Target | Cases | Backs |
|---|---|---|---|
| T-U1 | Ingestion | every accepted format (pdf, docx, txt), unsupported type, empty, corrupt, protected, scanned (no text layer), huge file; each returns a status, never throws to the UI | PR-10 |
| T-U2 | ResumeFacts determinism | same text twice ⇒ identical `ResumeFacts` incl. `content_hash`; cache hit does not change the result; edited text ⇒ new hash | PR-11 |
| T-U3 | Fact preservation | rewrite/cover-letter output with a new figure, new employer, new job title, changed date ⇒ flagged or neutralised; paraphrase of an existing fact ⇒ allowed; ownership/scope inflation cases documented as known gaps if not detected | PR-05 |
| T-U4 | JD Match / JD Analyzer | AI JSON unparsable ⇒ visible error; keyword coverage reproducible; AI-proposed keyword absent from the JD dropped; `matchScore` null when no resume | PR-04, PR-22 |
| T-U5 | Interview Coach wrapper | renders the HiringManagerSim path; sign-in-required message on 401 | PR-08 |
| T-U6 | Dashboard / Roadmap / Radar / Readiness | no `scanHistory` (the state of every new account) ⇒ explicit empty state, never 0; legacy rows with `status: 'failed'` excluded from every consumer; thresholds 75/87/65 read from one constant | PR-01, PR-02 |
| T-U7 | Dead-code removal | build passes, import graph has no reference to removed exports | PR-07 |

### Contract and score (C)

| Id | Target | Cases |
|---|---|---|
| T-C1 | ScoreResult | existing 15 cases stay green; add: new `score_type` rejected unless versioned; weights change without version bump fails; `score_type` shown to the user matches stored value |
| T-C2 | Keyword coverage score | JD with 0 keywords ⇒ null not 0; duplicates counted once; casing/plural normalisation fixed by tests; version string present |
| T-C3 | Memory progress | formula from counts; empty memory ⇒ null; monotonic with activity |
| T-C4 | ValidationResult / provenance schema (PR-12) | same style as `tests/contracts/`: valid, missing source tag, AI value claiming `verified`, AI overwriting `extracted` |

### Integration (I)

| Id | Target | Cases |
|---|---|---|
| T-I1 | `ai` handler | provider 401/403 ⇒ non-retryable class; truncated/blocked ⇒ 422 not retried; empty ⇒ classified; timeout; 429 with `Retry-After`; temperature set per provider in the request body; no key or content in logs |
| T-I2 | Client `callLLM` | retry counts per error class; no retry on 4xx; session refresh failure ⇒ sign-in error |
| T-I3 | `useMemory` | legacy blob without new fields loads; blob with unknown future fields round-trips; AI patch cannot replace a field tagged `verified`/`extracted` (after PR-12) |
| T-I4 | `verify-cert` | existing 22 stay green; add ownership comparison cases (PR-41): same name, different order, diacritics, initials, mismatch, missing recipient |
| T-I5 | Fallback (PR-52) | primary 5xx ⇒ secondary used once; auth error on primary ⇒ secondary; bad request ⇒ no fallback |

### Browser (B)

None exist as automation. Minimum set, run against `npm run dev` or the built bundle with the AI function mocked at the network layer
(for example Playwright route interception; tool choice UNKNOWN, not in `package.json`):

| Id | Flow | Assert |
|---|---|---|
| T-B1 | Upload a real PDF in ATS Builder; force the parse reply to be invalid JSON | no score is displayed; the error is visible; the deterministic result is still computed |
| T-B2 | Bullet rewrite with a mocked reply containing an invented figure | figure neutralised or flagged |
| T-B3 | Onboarding upload (pdf, docx, scanned) | status message correct; no crash when the model fallback fails |
| T-B4 | JD Match with an unparsable reply | error shown |
| T-B5 | VerifyCreds add Credly URL, fake Credly response | status shown matches rule; after reload the status cannot be altered through the UI |
| T-B6 | Sign-out/sign-in | memory restored; failed restore keeps writes locked |

Real-environment verification (staging or production) stays separate from these: it answers different questions (deployed function,
RLS, bundle). It is recorded manually, as was done in `b526802`.

### Data compatibility (D)

| Id | Scenario |
|---|---|
| T-D1 | Run old and new extraction on the same fixture corpus and archive the diff; no regression on files that worked before; every difference classified (better/worse/neutral) |
| T-D2 | Legacy `user_memory.data.credentials[].status === 'verified'` loads and is displayed per PR-42 rules; nothing is deleted |
| T-D3 | Rows in `resume_scans`, `jd_analyses`, `mock_sessions`, `star_stories` from before each change (null new columns, old column sets, `credibility_score` of two meanings) load and render; run any new SQL on the in-memory replica (`docs/database/replica-test/`) before the real database |
| T-D4 | Trust score invariance: inserting a rule-based `resume_scans` row leaves `recompute_trust_score` result unchanged (already checked by `replica-test/score-metadata.mjs`, 20 checks; must be re-run after any schema change) |

### Security (S)

| Id | Target |
|---|---|
| T-S1 | `status: 'verified'` cannot be produced by a browser-originated write once PR-40 lands (replica RLS test, same style as `replica-test/run.mjs`) |
| T-S2 | Extend `noFakeTrustClaims` with the phrases in `TrustMatch.jsx:191,195`; keep `noSecretsInClient` and `noFakeData` green |
| T-S3 | Prompt-injection fixtures: resume/JD containing "ignore previous instructions", asserting the preamble is present and output guards still apply |
| T-S4 | PII: assert which fields `buildSystemPrompt` and `buildMemoryContext` send (documented list) |

### Quality, not pass/fail (Q)

| Id | Target |
|---|---|
| T-Q1 | Golden CV/JD set (PR-60) with expected facts/scores; run old vs new; report accuracy, 2-run stability, latency, cost, error rate before flipping any flag. Needs a real model run, which no current test does |

## 4. Gate for each migration PR

1. New tests fail on the old behaviour and pass on the new (principle 5).
2. Full `npm test` and `npm run build` green; no new provider key in the bundle.
3. Relevant T-D scenario run with legacy data.
4. Shadow report attached for any user-visible number (PR-13 style).
5. Rollback documented (revert or flag off). Database steps run on the replica first and applied by the owner.
6. Stated limits: what was not run (deployed function, live RLS, real model) is written in the PR.
