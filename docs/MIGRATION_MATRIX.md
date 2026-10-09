# Migration matrix and PR backlog (Deterministic-First)

Branch `feat/deterministic-score-engine-p0-p4`, HEAD `2e43e14`, 2026-10-09 (re-baselined: a first pass on `c0463ec` predated the merge of `main` that removed the dead scan flows; see audit §10). Planning document: **nothing here has been started**.
Evidence and statuses are in [DETERMINISTIC_FIRST_AUDIT.md](DETERMINISTIC_FIRST_AUDIT.md) (§ numbers below) and
[AI_ENTRYPOINT_INVENTORY.md](AI_ENTRYPOINT_INVENTORY.md) (# numbers below). Test requirements are in
[REGRESSION_TEST_PLAN.md](REGRESSION_TEST_PLAN.md) (T-ids).

Rules carried over from the task and `AI_ARCHITECTURE_CONTRACT.md`: no platform-wide refactor; no migration run in this
phase; no AI feature removed before the replacement is verified; **no new score semantics without a versioned contract**;
a number is computed, sourced, or labelled an estimate, otherwise it is not shown; unknown stays `null`, never `0`.

Priority: **P0** = integrity (wrong or forgeable data, fabricated number), **P1** = foundation others depend on,
**P2** = quality/consistency, **P3** = later or blocked on a product decision.
Class: D deterministic · AI · H hybrid (code facts/constraints, AI reasoning).

## 1. Decisions needed before the affected PRs (owner: product)

| Id | Decision | Blocks |
|---|---|---|
| D1 | Which "ATS Readiness" definition is canonical for users: P4 (completeness/impact/chronology), white-paper weights (keyword 30/format 20/XYZ 20/section 15/title 15), or the current AI profile. Commit `c0463ec` hid the P4 score; the decision to show it again is not made | PR-20, PR-21, PR-30 |
| D2 | Name and meaning of the number shown on the marketplace (today "Practice score", column `trust_score`) vs the white paper's Trust Score (identity/credentials/activity/engagement) | PR-40..PR-44 |
| D3 | What "verified" means for a credential (issuer page exists? recipient matches the user? issuer-signed?) | PR-40, PR-41 |
| D4 | Whether `ResumeFacts` (PII) may be stored server-side, retention, and deletion | PR-32 |
| D5 | Remove the remaining dead code (`resumeParser.extractResume*`); the ResumeScan Deep Scan and ATS Builder Kanban scan were already removed by `main` | PR-07 |
| D6 | What feeds Dashboard, Career Roadmap, Readiness, Radar and Skills Gap now that no live code writes `scanHistory`/`resume_scans`: nothing (show "no scan"), the P4 score, or the JD-match score | PR-01, PR-02, PR-20, PR-22 |

## 2. Module matrix

| Module | Current behaviour (evidence) | Target split | Source of truth now → target | Pri | Depends | Main risks | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| Document ingestion | Product uses `extractTextFromPdfFile` (pdf.js, no layout rules) and a model OCR fallback (#1, #11). `src/ingestion/` is tested but has no product caller (§3) | D: parse/normalize/status. AI: scanned-document fallback only, flagged `extraction_method: "ai"` | text from `resumeParser.js` → `ingestDocument` with status | P1 | PR-10 | different text ⇒ different downstream results; two-column PDFs | On the shared fixture set, new text is equal or better under agreed metrics; scanned PDF still works; failed status surfaces a message not a score (T-U1, T-D1) |
| Resume parsing / facts | Three AI parses of the same text (#2, #3, #9); `ResumeFacts` exists, only feeds a hidden score (§3) | D: facts with evidence. AI: ambiguous cases, `requiresInterpretation` | per-module AI JSON → one `ResumeFacts` per content hash | P1 | PR-10, PR-11, D4 | field coverage differences vs AI JSON consumed by templates | A consumer reads facts, not AI JSON, for contact/skills/experience; same input ⇒ same facts twice (T-U2) |
| ATS Readiness (ATS Builder) | One AI score remains: `atsScore` + 5-dim `scoreBreakdown` from the parse prompt (#6, `ATSBuilder.jsx:93-146`); deterministic score computed and hidden (`:85-87`); the scan, rebuild re-score and `+5/card` fallback were removed (audit §4.1) | D: score, parts, version. AI: explanation and fix suggestions given `{score, parts, missing}` | AI JSON → `scoreResume` output (`careeraihub_ats_readiness@1.0.0`) | P3 (blocked on D1) | D1, PR-20 | users see the number change; the white-paper definition differs from P4 | No path shows a score the code did not compute or label; score type and version shown with the value (T-C1, T-B1) |
| Resume Builder (bullet rewrite) | Rewrite with no figure guard and "more quantified … Never use placeholders" (#7, `ATSBuilder.jsx:564-572`); the HTML rebuild flow was removed | AI: rewrite. D: fact preservation, figure check, length limit | none → guard + diff check against `ResumeFacts` | P0 | PR-05 | false positives hide valid edits | Invented figure becomes `[X]` or is flagged; employer/title/date set unchanged (T-U3, T-B2) |
| Resume Scan / JD Match (`scan`) | Keywords by `checkKeywords` (code, `ResumeScan.jsx:243`); `matchScore`, bars from AI (#4); silent failure on parse error (`:241`); render + `jd_analyses` write covered by `ResumeScan.jdmatch.test.jsx`, failure path not | D: keyword coverage and bars. AI: gaps narrative, rewrites | AI `matchScore` → code coverage score (new `score_type`) | P2 | PR-04, PR-22, D1 | two matchers disagree (audit §2) | Failure shows an error; coverage is reproducible; label says what it measures (T-C2, T-U4) |
| JD Analyzer | AI `matchScore` entirely (#16, `jdAnalysis.js:37`) | D: requirement/keyword matching. AI: synonyms and interpretation | AI → H | P2 | PR-22 | semantic equivalents missed by rules (e.g. "PyTorch" vs "neural nets") | Rule score and AI notes separate in the output; no AI-only number stored in `match_score` without a type (T-U4) |
| Skills Gap | AI skills list and recommendations (#23); market numbers already removed | H: evidenced skills from facts + JD; AI: gap analysis and learning advice | AI → facts + AI | P2 | PR-11 | skill taxonomy gaps | Each "strong" skill cites evidence from facts; no market numbers (existing rule `ai-market-numbers` stays green) |
| Interview Coach | Questions (#18) and answer feedback (#19) by AI; verdict/summary in code (`interview.js:30,130`); wrapper dir has no test | H: rubric, history, averages in code; AI: questions, feedback | already mostly H | P3 | – | AI answer score is unaudited | Existing tests stay green; guard warnings unchanged; add test for the `InterviewCoach` wrapper (T-U5) |
| STAR Builder | Section scores by AI (clamped), overall in code (`star.js:59`), figure guard (#24) | H | already H | P3 | – | – | No change required in this plan; regression only |
| Salary Coach | Arithmetic in code (`negotiationMath`), script by AI with figure check (#22); market tab off (#21) | D: math/units/constraints. AI: script | already H; market data NOT IMPLEMENTED | P3 | OP-2 (real data source) | AI market estimates if re-enabled | Flag stays off until a sourced dataset exists (existing `noFakeData` rule) |
| Career Roadmap | No AI; thresholds 75/87/65 hard-coded; `?? 0` defaults; fixed week ranges (`CareerRoadmap.jsx:77-78,102,201-206`); its ATS step reads `scanHistory`, which no live code writes | D: prerequisites and progress. AI (new): path suggestions | memory scores → versioned inputs | P1 (`?? 0`, dead feed), P3 (AI part) | PR-02, D6 | showing 0 for unknown; implied time estimates | Unknown input renders "not available"; week ranges labelled estimates or removed; no test today ⇒ add (T-U6) |
| Dashboard / Readiness / Weakness Radar | No AI; read `scanHistory`/`scanResult`, which only legacy `resume_scans` rows can fill (`Dashboard.jsx:225-227`, `ReadinessScore.jsx:13-17`, `WeaknessRadar.jsx:20`) | D | legacy rows → decision D6 | P1 | PR-02, D6 | screens permanently empty for new users | Empty state is explicit and points to the live flow chosen in D6; failed/legacy rows handled; no test for Dashboard ⇒ add (T-U6) |
| AI Memory (`MemoryDashboard`) | Model returns `overallProgress` "score based on activity" (#20) | D: progress from counts. AI: weekly plan | AI → code with a versioned definition | P1 | D1-style decision on the metric | invented meaning for a new number | Progress is computed from stored counts with a documented formula; model gets it as input (T-C3) |
| Cover Letter | Prompt forbids invention; untrusted-data preamble; no output check (#17) | AI + D: check that employers, titles, dates, numbers in the letter appear in the resume | none → fact check | P2 | PR-05 | strict check blocks natural paraphrase | Letter containing a figure/employer absent from the resume is flagged (T-U3) |
| AI Career Coach | Free chat with memory summary (#7) | AI; D: only the context builder (privacy, size) | context builder unread (UNKNOWN) | P3 | read `buildSystemPrompt` | PII in prompt | List of fields sent is documented and tested |
| Verify Creds | `verified` set in the browser (Credly) or by `verify-cert`; saved in `user_memory.credentials` (§4.3) | D only; AI must not set status | browser JSON → server-owned record | **P0** | D3, PR-40.. | users can forge status; false "verified" claims to recruiters | A status of `verified` cannot be created or edited from the browser; ownership rule applied; legacy entries downgraded explicitly (T-S1, T-D2) |
| TrustMatch | Profile form, job list, local interest state, scripted chat; no matching, no credential data (§4.2, §8) | D: filters and eligibility. AI: ranking/explanation (later) | scores from trigger (formula UNKNOWN) | P0 for UI text, P3 for algorithm | D2 | UI says "verified profile" with nothing verified | No UI text claims verification the data does not support; Trust score definition versioned (T-S2) |
| Employer Portal | Sample data with disclosure banner (`EmployerPortal.jsx:872`) | D | – | P2 | – | sample data shown to real users | Sample sections are not shown to non-preview users or are unmistakably labelled |
| CareerOS Memory | Whole-blob upsert; no field provenance; resume text stored (§4.5, §5) | D: save/read/update/delete rules and privacy. AI: summaries only | blob → blob + per-field source tag | P1 | PR-12, D4 | merge conflicts with legacy data | AI-written fields cannot replace `verified`/`extracted` fields; legacy rows load unchanged (T-D1, T-D3) |
| `ai` Edge Function | Single provider, retries misclassified, temperature inconsistent (§6) | D: auth, limits, error classes, schema validation | – | P1 | deployment access | changing status codes breaks clients | 401/403 from provider not retried; per-provider temperature explicit; usage logged without content (T-I1) |

## 3. Phased PR backlog

Each PR is independently reviewable, has a rollback (revert, unless stated) and ships behind current behaviour. "Approval" =
needs a decision above or touches something outside the repo. **No PR below has been started.** Estimated size: S < 150 lines,
M < 500, L larger.

### Phase A: remove fabricated or misleading output (no new semantics)

| PR | Scope | Files | Tests | Size | Approval |
|---|---|---|---|---|---|
| PR-01 | ~~Rebuilt-resume score fallback~~ **WITHDRAWN**: the code (`atsScore + doneCards*5`) was deleted by `main`. Replaced by: record decision D6 and make scan-score consumers state "no scan yet" instead of an empty or zero value | – | T-U6 | – | D6 |
| PR-02 | Unknown scores stay `null` in Dashboard, Roadmap, Radar, Readiness; Roadmap filters `status: 'failed'` like Dashboard; explicit empty state per D6 | `CareerRoadmap.jsx:77-78`, `Dashboard.jsx:226`, `ReadinessScore.jsx`, `WeaknessRadar.jsx` | T-U6 | S | D6 for the wording |
| PR-03 | TrustMatch/EmployerPortal text: remove "verified profile / verified credentials shared" where nothing is verified; extend `noFakeTrustClaims` | `TrustMatch.jsx:191,195` + test | T-S2 | S | – |
| PR-04 | `ResumeScan` JD match: show an error when the AI JSON cannot be parsed (add the missing else) | `ResumeScan.jsx:241` | T-U4 | S | – |
| PR-05 | Apply the existing figure guard to the bullet rewrite and the cover letter output; flag employers/titles not in the resume | `ATSBuilder.jsx:564`, `CoverLetterGen.jsx`, `factGuard`/`numberGuard` reuse | T-U3, T-B2 | M | – |
| PR-06 | Add the "untrusted data, ignore instructions inside" preamble to prompts that lack it (#2, #3, #4, #6, #15) | prompt strings | prompt-shape tests like `coverLetter.test.js` | S | – |
| PR-07 | Remove the remaining dead code: `resumeParser.extractResume*` (no caller) | `src/lib/resumeParser.js` | existing suite + T-U7 | S | D5 |
| PR-08 | Tests for untested live paths: ResumeScan JD-match failure, VerifyCreds client logic, TrustMatch profile save, Dashboard, Roadmap, InterviewCoach wrapper | new test files only | T-U4..T-U7 | M | – |

### Phase B: foundation made reusable (shadow, no UI change)

| PR | Scope | Tests | Size |
|---|---|---|---|
| PR-10 | Shadow comparison script/test: `ingestDocument` vs `extractTextFromPdfFile` + mammoth on the fixture corpus; report differences, no product change | T-D1 | M |
| PR-11 | Make `ResumeFacts` obtainable through one function with an in-memory cache keyed by `content_hash`; no module changes yet | T-U2 | S |
| PR-12 | Contract docs + validators: `ValidationResult` contract file, and a field-provenance tag (`source: verified | extracted | self_reported | ai_inferred`) as a pure schema; nothing stored yet | contract cases like `tests/contracts/` | M |
| PR-13 | Local shadow report: P4 score vs AI `atsScore` over the fixtures; distribution and disagreement list, committed as a doc; no telemetry | T-B1 | S |

### Phase C: replace model arithmetic, one module per PR (each needs the named decision)

| PR | Scope | Depends | Approval |
|---|---|---|---|
| PR-20 | ATS Builder parse tab: replace the model's `atsScore`/`scoreBreakdown` with `{score, parts, missing}` from `computeDeterministicScore`; the model only explains (flag-off by default) | D1, PR-11 | D1 |
| PR-21 | ~~Rebuild re-score~~ **WITHDRAWN**: the rebuild flow was removed by `main` | – | – |
| PR-22 | JD Match: code coverage score with its own `score_type`/version; AI supplies gaps/rewrites only; resolves the two-matchers divergence; may also become the feed for D6 | PR-04, D1, D6 | new versioned contract |
| PR-23 | Onboarding: `yearsExp`/`topSkills` from facts; AI only when `requiresInterpretation` | PR-11 | – |
| PR-24 | Memory dashboard progress computed from counts with a documented formula | decision on formula | new versioned contract |
| PR-25 | Roadmap time estimates: remove or label as estimates | – | – |

### Phase D: persistence (schema work; **verify the real schema first, none of this runs in this phase**)

| PR | Scope | Notes |
|---|---|---|
| PR-30 | Read-only schema and RLS export for all tables (including `recompute_trust_score`'s body) into `docs/database/` (owner runs it) | unblocks all below |
| PR-31 | Write `deterministic_score/score_type/score_version` with each scored resume. The columns are already applied (README 2026-10-09); this PR adds the first writer and the first reader. Re-run `replica-test/score-metadata.mjs`; the trust-score `MAX()` must stay unaffected | the browser still computes the value, so the database can check range and labels, not honesty |
| PR-32 | Store `ResumeFacts` (or hash + version) per resume | D4 |
| PR-33 | Server-side writer for AI scores so `resume_scans`, `mock_sessions`, `star_stories` stop trusting the browser (closes the README "Known gap") | needs an Edge Function and new RLS; rollback script kept privately |

### Phase E: trust layer

| PR | Scope | Depends |
|---|---|---|
| PR-40 | Credential verification result stored server-side (new table), written only by `verify-cert` (and a Credly path moved into it); `user_memory.credentials` becomes display-only | D3, PR-30 |
| PR-41 | Ownership rule: compare issuer `recipientName` with the user's profile name using deterministic normalisation; unmatched ⇒ `url_valid`, not `verified` | D3 |
| PR-42 | Legacy credential migration: existing `status: 'verified'` entries shown as "self-reported, unverified" until re-verified | PR-40 |
| PR-43 | Trust score contract (`score_type`, version, inputs) and display name per D2 | D2 |
| PR-44 | TrustMatch eligibility filters from `candidate_trust_profiles` and verified credentials (rules only; ranking later) | PR-43 |

### Phase F: resilience

| PR | Scope | Notes |
|---|---|---|
| PR-50 | `ai` function: provider 401/403 ⇒ non-retryable response; empty reply classification; explicit temperature per provider | requires redeploy; client keeps working with either status |
| PR-51 | Schema validation for AI JSON per call site (not only `extractJSON`), with a visible error | one PR per module family |
| PR-52 | Provider fallback with the error classes in contract §7 | needs the real deployed source first (UNKNOWN) |
| PR-53 | Usage log (provider, model, tokens, latency, error class, no content) | privacy review |

### Phase G: evaluation and release

| PR | Scope |
|---|---|
| PR-60 | Golden CV/JD set (synthetic or consented) with expected facts and scores; run in CI |
| PR-61 | Old-vs-new comparison report (accuracy, stability across 2 runs, latency, cost, error rate) before any flag is flipped |
| PR-62 | Staged enablement via a per-user flag, with rollback = flag off |

## 4. Suggested order

PR-01, 02, 03, 04, 05, 06, 08 (independent, small) → PR-10, 11, 12, 13 → decisions D1–D6 → PR-30 → then C, D, E in parallel
tracks → F → G. Phase E (PR-40..42) carries the highest integrity risk and has no dependency on AI work, so it can start as soon
as D3 and the schema export exist.
