# Deterministic-First migration audit (P0)

Branch `feat/deterministic-score-engine-p0-p4`, HEAD `2e43e14`, 2026-10-09. Audit only: no code, schema, data or
configuration was changed. `npm test`: 66 files, 907 passed, 4 skipped. Nothing was run against production, the live
database or a real model, so every status below means "read in source/tests/SQL", not "observed running".

**Re-baselined during the audit.** The first pass was made on `integration/ats-builder-p4-score` @ `c0463ec`. While it ran, the
working tree moved to this branch (a merge of `main` that deleted the dead ResumeScan Deep Scan and the ATS Builder Kanban scan,
about 1 800 lines, and a `docs/database/README.md` that now records the `resume_scans` score-metadata SQL as applied). Every finding
below was re-read on `2e43e14`; §10 lists what changed between the two passes.

Statuses: **CONFIRMED** (read in code/test/SQL) · **PARTIALLY CONFIRMED** · **UNKNOWN** · **NOT IMPLEMENTED**.
Evidence is `path:line` on this branch. Sibling files: [AI_ENTRYPOINT_INVENTORY.md](AI_ENTRYPOINT_INVENTORY.md),
[MIGRATION_MATRIX.md](MIGRATION_MATRIX.md) (includes the PR backlog), [REGRESSION_TEST_PLAN.md](REGRESSION_TEST_PLAN.md).

Relation to existing docs: [AI_ARCHITECTURE_CONTRACT.md](AI_ARCHITECTURE_CONTRACT.md) sets the rules and a phase order (P0–P6) and is
not restated here; its §4 call-site table is stale (it lists scan, re-score and `+5/card` rows that no longer exist). `SYSTEM_MAP.md`
was updated for the dead-flow removal; `VERIFICATION_STATUS.md` and `BRANCH_DELTA_AUDIT.md` still describe the `hotfix/server-side-ai`
line and do not mention the ingestion/extraction/validation/scoring layer.

## 1. Executive summary

1. **The deterministic foundation exists but one place uses it.** `ingestion → extraction → validation → scoring` and the data
   contracts are built and well tested (§3). The only product caller is ATS Builder (`ATSBuilder.jsx:85`), and its result is only
   written to the console (`:87`); the state `detResult` is declared (`:78`) and never read.
2. **The AI scan pipeline was deleted, its consumers were not rewired.** Dashboard, Career Roadmap, Readiness Score, Weakness Radar and
   Skills Gap read `memory.scanHistory`/`scanResult`. No live code writes them; they can only be filled from legacy `resume_scans`
   rows (§4.1). For an account without such rows these screens show "no scan". The README states it too: no live code writes `resume_scans`.
3. **The only AI "ATS score" still shown** is the Upload & Parse profile score from the model (§4.1). A hidden deterministic score
   with `score_type` `careeraihub_ats_readiness` exists beside it.
4. **"Verified" is a browser-side claim** stored in a user-writable JSON blob (§4.3). This is the main blocker for the white paper's
   TrustMatch promise and is independent of AI.
5. **Defaulted or model-computed numbers remain** (§4.4).
6. **No provenance exists on stored data** and there is no write rule for it (§5).
7. **Reliability gaps** are mostly known and documented; one regression-relevant item is new (§6).
8. **Many white-paper claims have no implementation in this repo** (§8). They are specification, not state.

## 2. Inventory and status of product entry points

Sidebar `MODULES` has 18 entries (`src/styles/theme.js:19-37`); the white paper says "10 live modules".

| Module (id) | Status | AI | Writes | Tests |
|---|---|---|---|---|
| ATS Scanner (`scan`) → `ResumeScan.jsx` | CONFIRMED: renders only `JDMatchTab`; the Deep Scan was removed | yes (2 sites) | `jd_analyses` | `ResumeScan.jdmatch.test.jsx`: screen renders, a scan writes `jd_analyses` and never `resume_scans`. Parse-failure path untested |
| Resume Builder (`ats`) → `ATSBuilder.jsx` | CONFIRMED: tabs Upload & Parse → Builder → Version History (+ bullet rewrite); deterministic score computed, hidden | yes (2 sites) | `user_memory` only (`parseProfile`, `resumeText`, versions) | yes (4 files) |
| Cover Letter (`cover`) | CONFIRMED | yes (`:33`) | `cover_letters` | yes |
| Interview Coach (`simulate`) | CONFIRMED: `InterviewCoach/` has no code of its own and no test; the logic is `HiringManagerSim` | yes (2) | `mock_sessions` | yes (HiringManagerSim) |
| Salary Prep (`salary`) | CONFIRMED; market tab disabled by flag | yes (1 reachable) | none via `table:` | yes |
| Skills Gap (`skillsgap`) | CONFIRMED | yes | `user_memory` only | yes |
| Career Roadmap (`roadmap`) | CONFIRMED no AI; progress derived from memory | no | none | **none** |
| Verify Creds (`verify`) | CONFIRMED; Credly in the browser, others via `verify-cert` or URL pattern | no | `user_memory.credentials` | **none** |
| TrustMatch (`trustmatch`) | CONFIRMED profile form + feed; no matching algorithm | no | `candidate_trust_profiles` | **none** |
| AI Career Coach (`aichat`) | CONFIRMED | yes | `user_memory` | yes |
| Job Search (`jobs`) | CONFIRMED, Edge Function `jobs` | no | none | yes |
| JD Analyzer (`jd`) | CONFIRMED | yes | `jd_analyses` | yes |
| STAR Builder (`star`) | CONFIRMED | yes | `star_stories` | yes |
| Weakness Radar, Readiness Score, Regional Guide | CONFIRMED no AI; read memory | no | none | yes (3) |
| AI Memory (`memory`) | CONFIRMED | yes | deletes rows | yes |
| Dashboard | CONFIRMED no AI | no | none | **none** |
| Employer Portal (role) | PARTIALLY CONFIRMED: banner says pipeline, inbox, analytics, team and dashboard figures are sample data (`EmployerPortal.jsx:872`) | no | `employers`, `employer_members` | **none** |

Edge Functions: `ai`, `jobs`, `verify-cert` (the only backend code in the repo).

Dead or duplicate code (CONFIRMED):
- `resumeParser.js` `extractResume*` has no caller anywhere in `src` (grep). Only `extractTextFromPdfFile` is used.
- Already removed by `main`: ResumeScan Deep Scan, ATS Builder Kanban scan. Left on purpose per the SYSTEM_MAP: `buildScanRecord` and other
  now-unused exports of `atsBuilderUtils.js`, and unused CSS rules.
- Three AI structured parses of the same text: `ATSBuilder.jsx:93` (`parseResume`), `ResumeScan.jsx:158` (`parseForTemplate`),
  `App.jsx:599` (onboarding profile). No shared cache.
- Two JD matchers with different meaning: `ResumeScan.jsx:214` (keyword lists decided by code at `:243`, `matchScore` by AI) and
  `JDAnalyzer.jsx:40` (`matchScore` entirely by AI, `jdAnalysis.js:37`). Both write `jd_analyses.match_score` with different extra
  columns: ResumeScan writes `keywords, gaps, advice` (`:251`); JDAnalyzer writes `key_requirements, critical_gaps`
  (`JDAnalyzer.jsx:56`). The table schema is **UNKNOWN** (not in repo), so whether both inserts succeed is UNKNOWN.

## 3. The deterministic foundation (what exists)

| Layer | Path | Evidence | Status |
|---|---|---|---|
| Ingestion PDF/DOCX/TXT → text with status | `src/ingestion/` (5 files, 3 test files incl. real documents, edge cases) | `ingestDocument.js` | CONFIRMED; **no product caller** (importers are tests only) |
| ResumeFacts extraction | `src/extraction/` | `resumeFacts.js:25-69` | CONFIRMED; reachable only via `computeDeterministicScore` |
| Contracts and validators | `src/contracts/{resumeFacts,scoreResult,validate}.js`, `tests/contracts/` (19 + 15 cases) | | CONFIRMED |
| Semantic validation | `src/validation/` | | CONFIRMED |
| Score `careeraihub_ats_readiness` v1.0.0 | `src/scoring/resumeScore.js:15-117` | 3 parts, weights 0.4/0.3/0.3 | CONFIRMED |
| No-AI boundary | `src/scoring/noAiBoundary.test.js` | | CONFIRMED |
| Keyword presence by code | `checkKeywords` in `resumeDigest.js` | used at `ResumeScan.jsx:243` | CONFIRMED |
| Invented-figure guard | `factGuard.js`, `numberGuard.js` | importers: `star.js`, `interview.js`, `salary.js`, `ResumeScan.jsx` | CONFIRMED for those four only |
| Final scores computed in code from AI sub-scores | `star.js:59` (`overallScore`), `interview.js:30,130` | | CONFIRMED (sub-scores still AI) |

Properties of the P4 score (CONFIRMED): never `0` for unknown (null + `missing`), unreadable document → null
(`resumeScore.js:99-102`), weights frozen and versioned. It measures only completeness (4 signals), share of bullets
with a number, and date contradictions. It has **no** keyword, JD, format or role-title component, so it is not the
white paper's 30/20/20/15/15 model (white paper §08). Which is intended is a **product decision, UNKNOWN**.

## 4. Source of truth per important score or field

### 4.1 "ATS score": what is produced, shown, stored and read

| Value | Produced by | Where shown/stored | Notes |
|---|---|---|---|
| `profile.atsScore` + `scoreBreakdown` (5 dims) | model, in the parse prompt `ATSBuilder.jsx:93-146`; prompt says the five "should aggregate to the overall atsScore" (`:129`) | shown `:219,323,346,421,456`; kept in `memory.parseProfile` (`:1175`) → `user_memory` | model asked to do the arithmetic. **The only AI ATS score still produced** |
| deterministic score | `computeDeterministicScore` (`ATSBuilder.jsx:85`) | console only (`:87`) | `score_type` `careeraihub_ats_readiness`, v1.0.0 |
| `memory.scanHistory[].score`, `scanResult` | **no live writer.** Loaded from `resume_scans` rows at login (`useMemory.js:62,86`) | read by Dashboard (`:225-227`, filters `status !== 'failed'`), Career Roadmap (`:77`, `?? 0`, no filter), Readiness (`:13-17`), Radar (`:20`), Skills Gap context (`SkillsGap.jsx`, `scanHistory[0].result.summary`) | legacy rows only; whether any exist: UNKNOWN (README says it was not checked) |

Consequence (CONFIRMED from code, user-visible effect not observed): a new account has no source for the ATS step of the Roadmap
(milestones 75 and 87, `CareerRoadmap.jsx:201-202`), the Dashboard ATS tile or the Readiness page, whichever product decision (D1) is taken.

### 4.2 Practice / trust score

- UI label is "Practice score" and the card says it "does not include verified credentials" (`TrustMatch.jsx:450`). Formula in the UI:
  ATS 0.40, interview 0.35, STAR 0.25 (`:280`).
- It is written by the database trigger `recompute_trust_score`, which takes `MAX(credibility_score)` of `resume_scans`
  (`docs/database/README.md`). **The function body is not in the repo** (only its grants are,
  `docs/database/2026-10-05-…sql:19-20`), so the exact formula is UNKNOWN and the weights above are only what the UI states.
  With no live writer of `resume_scans`, new accounts should have no ATS input to that trigger (inference; the trigger was not read).
- The browser cannot write the four score columns on `candidate_trust_profiles` (trigger `lock_trust_columns`,
  `2026-10-05-…sql:33-50`): CONFIRMED in SQL, **not verified against the live database**.
- Known gap (README): `resume_scans`, `mock_sessions`, `star_stories` still accept scores sent by the browser. Those feed the trust
  score that recruiters see, so a user with a token can write a row directly. CONFIRMED by the repo's own documentation; exploitability on
  production UNKNOWN.
- White paper Trust Score (Identity 25 / Credentials 30 / Activity 25 / Engagement 20, thresholds 40/60/80): NOT IMPLEMENTED as
  described. Name collision: the code's `trust_score` column and the white paper's "Trust Score" are different things.
- `VerifyCreds.jsx:314-321` has a third, client-only "trust score" (certifications, capped 45), used only inside that screen.

### 4.3 Verified status (credentials)

- Credly: the browser fetches `credly.com/badges/<uuid>.json` and returns `verified: true` if the response has a `data` object
  (`VerifyCreds.jsx:247-266`). It does not compare `recipientName` with the user.
- Other proxied platforms: `verify-cert` sets `verified = Boolean(fields.name && (fields.recipientName || ld))` (`handler.js:181`).
  Also no comparison with the signed-in user. Server-side, allowlisted and size/time capped (CONFIRMED, 22 tests).
- Everything else: URL pattern only, `verified: false` (`:296-305`).
- The resulting `status: 'verified'` is saved into `memory.credentials` (`:752,761-765`) → `user_memory.data`, a JSON document the
  user's browser writes with its own token (`useMemory.js:190`). RLS for `user_memory` is **UNKNOWN** (not in repo), but ownership
  rules cannot stop the owner editing their own blob. So "verified" is not authoritative.
- OpenCerts / Singpass / blockchain anchoring: only a URL regex for `opencerts.io` (`VerifyCreds.jsx:292`) and marketing copy:
  NOT IMPLEMENTED.
- TrustMatch reads no credential data at all, while its mock chat says "we reviewed your verified profile" (`TrustMatch.jsx:195`) and a
  system line "Verified credentials shared from message one" (`:193`). PARTIALLY CONFIRMED as misleading UI text; the existing
  `noFakeTrustClaims` test targets other phrases.

### 4.4 Numbers that the code or model defaults/invents (CONFIRMED in source)

| Where | Behaviour |
|---|---|
| `App.jsx:599` | `yearsExp` asked from the model; shown in Dashboard (`Dashboard.jsx:344`) |
| `MemoryDashboard.jsx:59-62` | model asked for `overallProgress` "0-100 score based on activity" |
| `CareerRoadmap.jsx:77-78,102` | `?? 0` for unknown scores; "2–4 weeks … 10–20 weeks" is a fixed table by steps done, not derived from data |
| `Dashboard.jsx:226,31` | `?? 0` / `\|\| 0` defaults |
| `SalaryCoach.jsx:82-107` | AI market salary ranges and employer percentiles; currently unreachable (flag off) |
| `ATSBuilder.jsx:564-572` | bullet rewrite prompt asks for "more quantified" output and says "Never use placeholders"; `ATSBuilder` imports no guard (grep) |

Removed since the first pass: the rebuilt-resume fallback `atsScore + doneCards*5` and the failed-scan `score: 0` entry, both inside the
deleted Kanban flow.

### 4.5 Resume text and PII

- Full resume text is stored in `user_memory.data.resumeText` (`App.jsx:122`, `ATSBuilder.jsx:1163`) and in `localStorage`
  `careerai_rt_<userId>` (SYSTEM_MAP). `scanPdfBase64` and `originalFileUrl` are excluded from the backup (`useMemory.js:6-10`,
  CONFIRMED). Retention, deletion on account removal and encryption at rest are UNKNOWN.
- A PDF can be sent to the provider as base64 when no text is available (`JDAnalyzer.jsx:40`, `CoverLetterGen.jsx:33`,
  `HiringManagerSim.jsx:51`, `SalaryCoach.jsx:290`, `App.jsx:363`). How often: UNKNOWN. Provider data-processing terms: UNKNOWN.

## 5. Data contracts and provenance

| Question | Finding |
|---|---|
| ResumeFacts keeps value, normalized_value, source, evidence, confidence, extraction_method, requiresInterpretation | CONFIRMED (`src/contracts/resumeFacts.js`); evidence mandatory when value ≠ null; "no guessing" rule enforced |
| ScoreResult keeps score_type, version, parts, missing | CONFIRMED (`resumeScore.js:15-16,110-116`) |
| `ValidationResult` | PARTIALLY CONFIRMED: shape `{errors, warnings}` used by `resumeScore.js`; no standalone contract file in `src/contracts/` |
| Any of these persisted | **NOT IMPLEMENTED.** No importer writes ResumeFacts or score metadata. The `deterministic_score/score_type/score_version` columns on `resume_scans` are recorded as applied on 2026-10-09 (README), which also says no code writes to them yet and the app does not read them |
| One parse per content hash shared by modules | NOT IMPLEMENTED (`content_hash` exists in ResumeFacts; no cache) |
| AI cannot overwrite a verified/extracted value | NOT IMPLEMENTED at the storage level. `updateMemory` merges any patch (`useMemory.js:146-149`) and upserts the whole blob (`:190`); there is no field-level source tag. Contract test `ai-cannot-overwrite.json` covers the object shape only |
| `extraction_method: "ai"` path | allowed by the contract, no producer exists |

Schema changes that will probably be needed (not to be applied in this phase): store ResumeFacts (or its hash + version) per resume; a
live writer for the already-applied score-metadata columns; a server-side writer for AI scores so the three input tables stop trusting
the browser; a server-owned credential verification table instead of `user_memory.credentials`. Each needs the real schema first
(UNKNOWN: the repo has no complete migration history, only two hand-applied scripts that `docs/database/README.md` records; the README is the only record of what was changed).

## 6. Reliability and regression risk

| Area | Finding | Status |
|---|---|---|
| Corrupt / unsupported / empty / protected files | `ingestDocument` returns a status; tests include real password-protected, zero-page PDF, docx without `document.xml` (commits `d120e27`, `787e3d4`). The product path uses the older `extractTextFromPdfFile` and falls back to the model (`App.jsx:360`) | CONFIRMED; the two parsers' outputs are not compared (UNKNOWN) |
| Image/scanned PDFs | fall back to model OCR via base64 (`App.jsx:363` only now); the result is treated as plain text with no `extraction_method` flag | CONFIRMED |
| `resumeParser.js` | has a test file (`resumeParser.test.js`); `VERIFICATION_STATUS.md` says none (stale) | CONFIRMED |
| Provider failure handling | client: 1 retry on 429/≥500/timeout/network (`ai.jsx:9-10,49-54`). Server: single provider chosen by secrets (`providers.js:25-31`); 422 for truncated/blocked, 502 empty, 429 passthrough | CONFIRMED |
| Misclassified retry | provider 401/403 → HTTP 500 (`handler.js:89`) which the client retries (`ai.jsx:20`); 502 "empty" is retried | CONFIRMED (also contract §7) |
| Fallback provider | none. `AI_FALLBACK` is referenced only in docs; no code reads it | CONFIRMED absent in repo; deployed function UNKNOWN |
| Determinism of AI | Gemini `temperature: 0.1` (`providers.js:45`); OpenAI and Anthropic request bodies set none (`providers.js:73,85`) | CONFIRMED |
| Output validation | `extractJSON` only (`ai.jsx:75-95`); returns `{error:true}` rather than throwing. JD Match (`ResumeScan.jsx:241`, `if (!parsed.error) {…}` with no else) silently ignores a failure; the ATS parse tab sets an error | CONFIRMED |
| Rate limit | 20 req/min/user per function instance; in memory | CONFIRMED |
| Cost / latency / usage metering | none; only `console.error` | CONFIRMED absent |
| Persistence | whole-blob upsert on a 1 s debounce; failures surface as `syncError`; boot-read failure keeps writes locked | CONFIRMED (15 tests) |
| Legacy rows | `normalize` maps only some columns (`useMemory.js:76-95`); old and new `jd_analyses` shapes coexist (§2); `scanHistory` is now legacy-only (§4.1) | CONFIRMED |
| Access control | `ai` rejects the anon key; `verify-cert` needs sign-in; employer read access depends on `verified_at` (SQL in repo). RLS policies for user tables are not in the repo | PARTIALLY CONFIRMED; RLS UNKNOWN |
| Prompt injection | Cover Letter and JD Analyzer wrap resume/JD as untrusted data (`coverLetter.js:29`, `jdAnalysis.js:24`); the other prompts (`ATSBuilder.jsx:93`, `ResumeScan.jsx:158,214`, `SkillsGap.jsx:72`, `App.jsx:599`) interpolate resume text without that instruction | CONFIRMED |
| Untested critical paths | ResumeScan JD-match failure path, App onboarding extraction, VerifyCreds, TrustMatch, EmployerPortal, Dashboard, Career Roadmap, `InterviewCoach` wrapper | CONFIRMED (no test files, or none for that path) |
| Real-model quality | no test calls a model, so AI answer quality is unmeasured | CONFIRMED |

Test-pass caveat: a green suite shows the rules and mocks behave; it does not show that the live `ai` function,
Supabase policies or the deployed bundle match this repo.

## 7. Classification of responsibilities (summary)

Detail per module is in [MIGRATION_MATRIX.md](MIGRATION_MATRIX.md). Pattern found:

- Already hybrid and acceptable: Interview Coach and STAR (model sub-scores, code aggregation and verdict, number guard), Salary
  negotiation math, JD keyword presence.
- Should become deterministic first: every number that is a count, a ratio, a date difference or a threshold (years of experience,
  ATS readiness, JD keyword score, progress percentages).
- Must stay AI (with guards): rewrites, cover letters, coaching, question generation, answer feedback.
- Not an AI question at all: verification state, trust-score inputs, access control.

## 8. White paper vs implementation (specification, not state)

| White paper | Finding |
|---|---|
| 10 live modules | 18 sidebar entries; "live" cannot be established from the repo |
| ATS weights 30/20/20/15/15, live-updating score | Not the implemented P4 score (§3); the AI profile score is a different thing |
| Blockchain credential verification; OpenCerts/Singpass/Credly/Badgr | Only Credly browser fetch, `verify-cert` for 6 platforms, URL regex for others; no chain, no Singpass, no OpenCerts verification: NOT IMPLEMENTED |
| TrustMatch 7-stage pipeline (embeddings, 5-dim match, intent multiplier, 5 gates, ghost timeline, learning loop) | `TrustMatch.jsx` is a profile form, a job list from `job_listings`, local "interested" state and a scripted chat; no matching code found: NOT IMPLEMENTED. `job.fit` is displayed (`:370-373`) but where it is set is UNKNOWN |
| Trust Score 4 dimensions, thresholds 40/60/80 | NOT IMPLEMENTED (§4.2) |
| Readiness plan with dimension scores and "9 days" estimate | Not found; Roadmap uses a fixed week-range table (`CareerRoadmap.jsx:102`) |
| Salary coach unlocks at readiness 75 | No gate found in `SalaryCoach.jsx` (grep for `75`/`unlock`): NOT IMPLEMENTED in that file; other gating code UNKNOWN |
| AES-256, TLS 1.3, PDPA, data export/transfer | Not provable from the repo; export/transfer feature NOT FOUND (delete exists in `MemoryDashboard`) |
| 3 months of memory as switching cost | Memory exists (`user_memory` + 9 tables); value claim is not testable |

## 9. Unknowns that block decisions

1. Real database schema, RLS policies, and the body of `recompute_trust_score` (not in repo).
2. Whether any legacy `resume_scans` rows exist, and so whether Dashboard/Roadmap/Readiness show anything for current users.
3. Whether the deployed `ai` function equals `supabase/functions/ai` (the contract mentions `AI_FALLBACK`).
4. Whether the two `jd_analyses` writers both succeed in production.
5. How often the base64-PDF path is used and the provider's data terms.
6. Product decision: which ATS Readiness definition is canonical (white paper weights vs P4 parts vs AI profile), and whether the
   scan-score consumers (item 2) should be fed by P4 or by a new JD-match score.
7. Product decision: what the user-facing number is called once more than one exists.
8. UI labelling of AI salary estimates in `SalaryCoach` (prompt calls them estimates; the screen text was not read).
9. `job.fit` origin in TrustMatch, and anything the Landing page claims (excluded from `noFakeTrustClaims`).

## 10. What changed between the two passes (so earlier conclusions can be discarded)

| First pass on `c0463ec` | Now on `2e43e14` |
|---|---|
| 26 `callLLM(` sites, 22 reachable | 17 sites, 14 reachable |
| Three AI-produced ATS scores in ATS Builder, plus a `+5 per card` invented fallback and `score: 0` failed-scan entries | Only the parse-tab profile score remains; fallback and failed-scan entries are gone |
| `resume_scans` written by the ATS Builder scan | No live writer |
| ResumeScan had no tests, a dead Deep Scan block | `ResumeScan.jdmatch.test.jsx`; dead block removed |
| Score-metadata SQL "proposed, not applied" | Recorded as applied on 2026-10-09; still unused by the app |
| Backlog item "fix the rebuilt-score fallback" | Obsolete |
