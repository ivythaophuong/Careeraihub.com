# CareerAiHub Platform Architecture (DRAFT for approval)

Status: **draft, direction accepted by the product owner on 2026-10-09 (conditional); not an approved baseline v1.0**. Updated 2026-10-09 with live-database evidence (§11). Not approved: platform-wide refactor, database migration, any production change. Nothing in this document was implemented by writing it. Audit-only: no code, schema, data or
production configuration was changed.

Baseline (Phase 0): application code as of `main` @ `30e5840`, read 2026-10-09. Tests on that tree: 66 files, 907 passed, 4 skipped. `main` has
since moved to `dc11e66` (PR #30), which changed documentation only (verified: no file outside `docs/` differs), so the code baseline is
unchanged. PR #30 replaced the first-pass audit documents with the corrected ones that this document references.

## 0. How to read this document

Three sources are kept apart. A statement always carries one of these tags.

| Tag | Meaning |
|---|---|
| **[CODE]** | Read in source, tests, SQL or git history on the baseline. Not observed running. |
| **[DB]** | Read from the live Supabase catalog by the owner on 2026-10-09 ([EVIDENCE_RESULTS_2026-10-09.md](EVIDENCE_RESULTS_2026-10-09.md)). True for that moment; it does not show application behaviour. |
| **[RUNTIME]** | Observed on a running system. **None in this document**; no runtime check was made. The only recorded one is the manual `.pdf` upload check in commit `b526802`. |
| **[APPROVED]** | A decision the product owner stated on 2026-10-09 (D1–D6 below). Direction only: each still needs its own PR and verification. |
| **[TARGET]** | Proposed architecture. Not built, not yet approved. |
| **[NOT IMPLEMENTED]** | Intended by the white paper or this target, and no code was found. |
| **[UNKNOWN]** | Could not be established from the repo. |

Inputs and their authority:

| Source | Used for | Not used for |
|---|---|---|
| `CareerAiHub White Paper 2026.html` | product intent only | proof that anything exists |
| Code, tests, `docs/database/` SQL, git | what exists | what should exist |
| This document | target architecture and decisions | proof of behaviour |

Detail lives in existing documents and is linked rather than copied: [DETERMINISTIC_FIRST_AUDIT.md](../DETERMINISTIC_FIRST_AUDIT.md),
[AI_ENTRYPOINT_INVENTORY.md](../AI_ENTRYPOINT_INVENTORY.md), [MIGRATION_MATRIX.md](../MIGRATION_MATRIX.md),
[REGRESSION_TEST_PLAN.md](../REGRESSION_TEST_PLAN.md), [AI_ARCHITECTURE_CONTRACT.md](../AI_ARCHITECTURE_CONTRACT.md),
[SYSTEM_MAP.md](../SYSTEM_MAP.md), [DATA_LINEAGE.md](../DATA_LINEAGE.md), [database/README.md](../database/README.md).
The gap between target and code is in [ARCHITECTURE_GAP_MATRIX.md](ARCHITECTURE_GAP_MATRIX.md).

## 1. Product and system boundaries

**Product intent (white paper, not evidence).** A career operating system and two-sided talent marketplace: Layer 1 career
intelligence (resume parsing, ATS readiness, builder, JD match), Layer 2 interview and acceleration (interview coach, STAR, salary,
roadmap, market, tracker), Layer 3 verified identity and credentials, Layer 4 talent marketplace (TrustMatch, TrustChat, recruiter
tools), over a shared CareerOS memory.

**What exists in the repo [CODE].** A React 18 SPA with 18 sidebar modules (`src/styles/theme.js:19-37`), three Supabase Edge Functions
(`ai`, `jobs`, `verify-cert`), and Supabase Auth/PostgREST. Layers 1 and 2 have code; Layer 3 is a credential list with partial
verification; Layer 4 is a profile form plus job list, with no matching engine.

| Area | Status |
|---|---|
| Resume ingestion, extraction, validation, P4 score | [CODE] built and tested; one consumer, output hidden |
| Interview coach, STAR, salary negotiation, cover letter, JD analysis, skills gap, memory | [CODE] AI-driven modules with partial deterministic checks |
| Credential verification | [CODE] partial; "verified" is not issuer verification (§8) |
| TrustMatch matching, TrustChat, intent multiplier, ghost prevention | [NOT IMPLEMENTED] |
| Recruiter tools | [CODE] portal exists; several sections are labelled sample data (`EmployerPortal.jsx:872`) |
| Blockchain anchoring, Singpass, OpenCerts verification | [NOT IMPLEMENTED] |
| Data export / transfer | [NOT IMPLEMENTED] (delete exists in `MemoryDashboard`) |

Out of scope until decided: PPTX/XLSX upload, native apps, background job runners (none exist [CODE]).

## 2. System context

Current, as read from code:

```
                          ┌─────────────────────────────┐
 User (candidate/recruiter)│ Browser: React SPA (Vite)   │  pdf.js, mammoth, html2pdf run here
                          │ no router; activeModule +   │
                          │ ?tab=<id>  (App.jsx)        │
                          └──────┬───────────┬──────────┘
        user JWT (session.js)    │           │ user JWT
       ┌─────────────────────────┘           └───────────────────────────────┐
       ▼                                                                     ▼
┌──────────────────────┐                                   ┌─────────────────────────────────┐
│ Supabase Auth +      │                                   │ Edge Functions (Deno)           │
│ PostgREST (custom    │                                   │  ai          → one provider/req │
│ `sb` client)         │                                   │  jobs        → Adzuna           │
│ tables + RLS (RLS    │                                   │  verify-cert → allowlisted sites│
│ policies NOT in repo)│                                   └──────┬──────────────┬───────────┘
│ triggers: trust score│                                          │              │
└──────────────────────┘                          Anthropic | Gemini | OpenAI   Adzuna, cert hosts
                                                   (secrets server-side)
 Browser → credly.com directly for Credly badge JSON  (VerifyCreds.jsx:247)
 Hosting: Docker (node build → nginx:alpine), VPS, Nginx Proxy Manager in front [CODE: Dockerfile, docker-compose.yml, CLAUDE.md]
```

| Fact | Evidence |
|---|---|
| The browser never holds a provider key; enforced by a test | `tests/security/noSecretsInClient.test.js` [CODE] |
| Supabase URL and anon key have hard-coded fallbacks in source (anon key is public by design) | `src/lib/supabase.js:3-4` [CODE] |
| No CI workflow in the repo | no `.github/workflows` [CODE] |
| No error/usage monitoring library | grep for sentry, datadog, posthog found nothing [CODE] |
| nginx sets `nosniff`, `X-Frame-Options`, `Referrer-Policy`; no CSP or HSTS in this file | `nginx.conf:12-14` [CODE]; the proxy in front is [UNKNOWN] |

## 3. Platform architecture (layers)

Target layering **[TARGET]**. The order is a dependency order, not a call order of every request.

**Logical, not physical.** The layers state responsibility and allowed dependencies. They are not a requirement to create five services or
to split the app into microservices. For the current stack (React SPA + Supabase Edge Functions) the near-term way to realise them is
modules and contracts inside the existing code, for example pure helper files with typed inputs and outputs, a shared contracts folder
and one gateway function. A separate service is justified only by a demonstrated technical reason (isolation, scale, trust boundary),
recorded in an ADR.

```
┌──────────────────────────────────────────────────────────────┐
│ 1 Experience layer      screens, explanations, next actions  │
├──────────────────────────────────────────────────────────────┤
│ 2 Application layer     module services, workflows, authz,   │
│                         API contracts                        │
├───────────────────────────────┬──────────────────────────────┤
│ 3A Deterministic engine       │ 3B AI engine                 │
│ ingest, extract, normalise,   │ meaning, rewrite, explain,   │
│ validate, score, rules,       │ coach, personalise           │
│ verification state            │ (gateway: routing, retry)    │
├───────────────────────────────┴──────────────────────────────┤
│ 4 Output & trust contracts   evidence, provenance, schema    │
│                              validation, versioning          │
├──────────────────────────────────────────────────────────────┤
│ 5 Data & integration         DB, file storage, external APIs,│
│                              audit log, jobs                 │
└──────────────────────────────────────────────────────────────┘
```

Where the repo stands per layer:

| Layer | State in code |
|---|---|
| 1 Experience | CONFIRMED; one monolithic `App.jsx` (737 lines) renders modules by state, inline styles plus CSS files |
| 2 Application | PARTIAL; no service layer: components call `callLLM`, `sb.*` and helpers directly. Pure helper files exist for some modules (`star.js`, `interview.js`, `salary.js`, `coverLetter.js`, `jdAnalysis.js`) |
| 3A Deterministic | PARTIAL; `src/ingestion`, `extraction`, `validation`, `scoring` built; consumed by ATS Builder only |
| 3B AI | PARTIAL; single gateway function, no routing/fallback/schema validation (§6) |
| 4 Contracts | PARTIAL; `src/contracts/` for ResumeFacts and ScoreResult; no `ValidationResult` contract file; no provenance on stored data |
| 5 Data | PARTIAL; whole-blob memory plus relational tables; no complete migration history in the repo, RLS policies not in the repo |

**Rule [APPROVED, D1]:** AI may explain and suggest, never change a deterministic score; a deterministic result states its
`score_type` and `score_version`.

## 4. Module contracts

Format per module: input → output, source of truth now, target split (D deterministic / AI / H hybrid). "Today" is [CODE] and
detailed in the audit and `AI_ENTRYPOINT_INVENTORY.md`; "target" is [TARGET] unless an approval is cited.

| Module | Input → output (today) | Source of truth today | Target split |
|---|---|---|---|
| Resume ingestion | file → plain text (pdf.js/mammoth; model OCR fallback) | `resumeParser.js`, `App.jsx` | D: `ingestDocument` with status; AI only for scanned files, flagged |
| Resume facts | text → three separate AI parses | none shared | D: one `ResumeFacts` per content hash; AI for ambiguous items only |
| ATS Readiness | text → AI profile score (parse tab); P4 score hidden | model JSON; P4 console only | **[APPROVED D1]** P4 deterministic as the base of the new version; AI score kept as legacy; no UI exposure until formula, weights and component explanations are agreed |
| Resume builder / rewrite | bullets → model rewrite | model | AI rewrite + D fact/figure check |
| JD matching | resume + JD → model `matchScore` (two different implementations) | model, with code-checked keywords in one | H: code keyword coverage with its own score type; AI for synonyms and gaps |
| Skills gap | scan summary + role → model | model | H: evidenced skills from facts + JD/goal (**[APPROVED D2]**) |
| Interview coach | persona + resume → questions; answer → score | model sub-scores, code aggregate/verdict | H (already) |
| STAR builder | S/T/A/R → section scores + rewrite | model, code aggregate | H (already) |
| Salary coach | situation → script; math in code | code for math; model for text | H; market data only from a sourced dataset |
| Career roadmap | memory → steps, thresholds | memory + hard-coded thresholds | D progress/prerequisites; AI suggestions later (**D2**) |
| Dashboard / readiness / radar | memory → tiles | `scanHistory` (no live writer) | **[APPROVED D2]** sources named in §5; "Chưa đánh giá" when absent, never 0 |
| Credential verification | URL → status | browser/`verify-cert`, saved in user blob | **[APPROVED D3]** four states, server-side, ownership check (§8) |
| TrustMatch | profile + jobs → list | DB trigger score, local state | **[APPROVED D4]** no aggregate "match" score until an engine is verified |
| Memory | updates → whole-blob upsert + rows | `useMemory` | D: save/read/update/delete rules, provenance tags |
| AI gateway | messages → text | `ai` function | D: auth, limits, error classes, validation, logging |

Boundary rules [TARGET]:
1. A module reads shared values (resume facts, score results, verification state) through one contract, not by re-deriving them.
2. A value shown to a user is computed (state how), sourced (name it) or labelled an estimate; otherwise it is not shown
   (already the project rule, `AI_ARCHITECTURE_CONTRACT.md` §1).
3. Unknown is `null`/"not assessed", never `0`.

## 5. Data architecture

> Corrected by live evidence: see §11. In particular the "no migration history" and "evidence model missing" statements below describe `main`, not the database.

**Stores today [CODE]** (`DATA_LINEAGE.md` §1): browser `localStorage` (session, resume text, parsed profile); `user_memory` (one JSON blob
per user, upserted whole); relational tables `resume_scans, applications, star_stories, cover_letters, jd_analyses, mock_sessions,
negotiation_practice, insights, profiles, candidate_trust_profiles, employers, employer_members, job_listings`.

Findings that shape the target (each with its audit reference):
- No row-level source tag; any patch merges into the blob and the AI cannot be stopped from replacing an extracted value (audit §5).
- `resume_scans` has no live writer; readers still exist (audit §4.1).
- Score columns on `candidate_trust_profiles` are locked against the browser by a trigger [CODE: SQL]; the three input tables are not.
- Resume text is stored in the blob and in `localStorage`; retention and deletion policy [UNKNOWN].
- The schema, RLS policies and `recompute_trust_score` body are not in the repo [UNKNOWN]. The README records two hand-applied scripts.

**Target entities [TARGET]**

| Entity | Owner of truth | Provenance required | Notes |
|---|---|---|---|
| Resume document | user upload | content hash, extraction status | raw file storage policy undecided |
| ResumeFacts | deterministic extractor | per fact: source, evidence, extraction_method, confidence | **[APPROVED D5 in principle]**: store server-side only after schema/RLS/retention are audited; model-generated confidence is not evidence of accuracy |
| Score result | scoring engine | `score_type`, `score_version`, parts, missing | historical AI scores stay labelled legacy and are not overwritten (**D1**) |
| Credential | verification service | state (D3), issuer evidence, recipient match | not stored in the user-editable blob |
| Practice / profile metrics | triggers or server functions | formula version | name per D4 |
| Memory fields | one of: user, extracted, verified, AI-inferred | source tag | AI-inferred never replaces verified/extracted |

Provenance classes proposed for every stored claim (a proposal; they need a contract file and tests before any storage use):

| Class | Exact meaning | Does not mean |
|---|---|---|
| `self_reported` | the user entered or confirmed it | that it is true |
| `extracted` | a deterministic extractor read it from a document, with evidence | that the document's content is true |
| `ai_inferred` | a model produced it from other data | that it is correct; never a source for scores or verification |
| `verified` | not a general state. For credentials only the D3 states apply; for any other field, `verified` is not defined until a rule names the authoritative source | that any module may set it |

Before persistence the contract must state, per field: the authoritative source, who may write, allowed state transitions (for example
`ai_inferred` may never overwrite `extracted` or `verified`; a user edit of an `extracted` fact becomes `self_reported`), and the conflict rule
when two sources disagree.

Preconditions before any persistence change [APPROVED, D5 and the owner's conditions]: audited schema, RLS, ownership, deletion and
retention policy; backfill plan if needed; backward-compatibility tests; no migration run before a reviewed design.

## 6. AI architecture

Verified [CODE] (`AI_ENTRYPOINT_INVENTORY.md`):
- All calls go through `callLLM` → Edge Function `ai` with the user token; the server picks provider and model from secrets.
- 17 `callLLM(` expressions: 14 reachable, 2 without caller, 1 behind a disabled flag.
- Client retries once (429, ≥500, timeout, network). Provider 401/403 becomes HTTP 500 and is retried. No second provider (`AI_FALLBACK`
  appears only in docs). Gemini uses temperature 0.1; the OpenAI and Anthropic requests set none.
- Output validation is `extractJSON` only. Two prompts (JD Analyzer, Cover Letter) mark resume/JD text as untrusted data; the others do not.
- No usage, cost or latency metering; rate limit is per function instance.

**Target [TARGET]**

| Concern | Proposed rule |
|---|---|
| Whether to call AI | decided first; if code can answer, no call |
| Gateway | one server-side entry with provider routing, explicit temperature, error classes (contract §7) |
| Fallback | only after the deployed function is read and the error classes are tested; not claimed before |
| Output | per-call schema validation with a visible failure; model never returns a score that code owns |
| Prompts | untrusted-data preamble for any resume/JD text; fact-preservation rules; versioned |
| Observability | provider, model, tokens, latency, error class; no content |
| Cost | per-user and global limits at the provider and in the gateway |

Retry/fallback matrix, unchanged from `AI_ARCHITECTURE_CONTRACT.md` §7, is the proposed behaviour and not current behaviour.

Order of work for the gateway (no single refactor; each step has its own PR and tests):
1. Compare the deployed `ai` function with `supabase/functions/ai` (read-only download).
2. Standardise error classes and the request/response contract.
3. Add per-call schema validation, user-visible errors and logging without content.
4. Only after each error class has a test, design provider fallback. Fallback is not automatically more reliable: output semantics can
   differ between providers, so any fallback needs a consistency check on the output contract.

## 7. Deterministic intelligence

Built [CODE]: ingestion with statuses, ResumeFacts with evidence and a no-guess rule, semantic validation, score `careeraihub_ats_readiness`
v1.0.0 (completeness 0.4, measurable_impact 0.3, chronology_health 0.3), 19 + 15 contract cases, a test that scoring imports no AI.

Properties to preserve [CODE, tested]: same input gives the same facts and score; unknown stays `null`; an unreadable document scores
`null`; weights are frozen and a change requires a version bump.

Open items **[TARGET]**:
- `ValidationResult` as a contract file.
- Parser comparison (`ingestion` vs `extractTextFromPdfFile`) before any switch.
- One facts object per content hash shared by modules.
- A keyword/JD coverage score as a separate `score_type`.
- Any other score (e.g. progress) gets its own versioned contract; no new meaning under an existing name (**D1**).

P4 does not include keyword, JD, format or title components. The white paper's 30/20/20/15/15 weights are **not** adopted
automatically (**D1**): each criterion must be compared and verified first.

## 8. Trust and security

> Partly superseded by live evidence: see §11. RLS policies, trigger bodies and function grants have been read.

Verified [CODE]:
- `ai` rejects the anon key; `verify-cert` needs sign-in, allowlists hosts, re-checks redirects, caps size/time (22 tests).
- Browser cannot write the four score columns of `candidate_trust_profiles` (SQL trigger) and employers need `verified_at` to read
  candidates (SQL). Both are recorded as hand-applied. SQL in the repo does not prove the trigger or policy exists or works on the live
  database, so the **live state is [UNKNOWN]** until the read-only evidence pass ([EVIDENCE_PASS.md](EVIDENCE_PASS.md)).
- Role switching: the recruiter portal is chosen from `user_metadata.role` set at sign-up (`App.jsx:231-237`, `sb.signUp(..., extraMeta)`).
  That is a UI route. It does not by itself prove an authorization flaw: server-side authorization and the live RLS policies decide that, and
  neither was read. Whether Supabase user metadata is user-editable in this project is [UNKNOWN]. Per N3 a self-selected role is not treated
  as a grant of recruiter capability.
- Credential `verified` is set in the browser for Credly and stored in the user-writable blob; neither Credly nor `verify-cert` compares
  the recipient with the user (audit §4.3).
- TrustMatch mock chat and EmployerPortal sample threads use "verified profile" wording although nothing in the data supports it.

**Credential trust model [APPROVED D3]:**

| State | Meaning |
|---|---|
| `self_reported` | the user says so |
| `evidence_provided` | a document or link was supplied |
| `source_checked` | the source/content was checked by a defined procedure |
| `issuer_verified` | confirmed with the issuer or an authorised source **and** the recipient identity is checked against the account |

Rules: no state above `evidence_provided` may come from a browser-sent flag or a URL alone; verification and ownership checks are
server-side; if an issuer cannot confirm ownership, the UI says so. Trust Layer code changes wait for the schema/RLS/`user_memory`
write-permission/`verify-cert` audit. TrustMatch is not described as trustworthy until that audit finishes.

**Marketplace labelling [APPROVED D4]:** no "TrustMatch Score" or "Verified Match". Allowed labels, each only once its data exists:
Profile Completeness, Skill Match (needs a skill-matching implementation), Trust Status (needs an evidenced verification process).
No aggregate fit score until a matching engine exists and is verified. The white paper's 40/60/80 thresholds, intent multiplier and
blockchain are not treated as running features.

Other security items to establish [UNKNOWN or NOT IMPLEMENTED]: RLS policies for every table, retention/erasure of resume PII, provider
data terms for PDFs sent as base64, audit log (none), CSP/HSTS at the proxy, data export.

## 9. Reliability and observability

Verified [CODE]: session refresh and fail-closed memory boot (`useMemory`, 15 tests), `syncError` toast on failed saves, timeouts on AI
and provider calls, 907 passing tests including contract, boundary, edge-function and a11y suites.

Gaps [CODE]: no CI, no browser automation, no staging evidence, no usage/cost/latency logging, `console.error` only on the server, no
real-model evaluation, silent failure in JD Match when the model's JSON is unparsable, per-instance rate limit, many critical paths
untested (VerifyCreds, TrustMatch, EmployerPortal, Dashboard, Roadmap).

**Target [TARGET]:** CI running `npm test` and the build; a small browser suite against a mocked AI layer; golden CV/JD set for old-vs-new
comparison; structured server logs without content; error classes surfaced to the user; a recovery note for each stateful change
(see `REGRESSION_TEST_PLAN.md`).

## 10. Migration roadmap

This section only orders the work; the evidence is in the gap matrix, the PR list in `MIGRATION_MATRIX.md`.

Priority classes (the owner's definition): **P0** integrity/security/data correctness · **P1** broken or disconnected functionality ·
**P2** architecture improvement · **P3** new capability. Provisional until dependencies are confirmed.

| Order | Work | Class | Gate |
|---|---|---|---|
| 0 | PR-00: put the four corrected audit documents on `main` (docs only, separate from this document) | – | approval |
| 1 | Schema/RLS/`user_memory`/`verify-cert` evidence pass (read-only: owner exports policies, trigger bodies) | P0 | owner action |
| 2 | Display-only fixes: "Chưa đánh giá" instead of 0 (PR-02); visible failure in JD Match (PR-04); tests for untested paths (PR-08); resumeParser dead-code verification report (PR-07, no deletion) | P1 | approved scope |
| 3 | Trust Layer redesign per D3 and D4 | P0 | step 1 |
| 4 | Shared facts + provenance contract (no storage); parser shadow comparison | P2 | none |
| 5 | Move one module at a time to deterministic-first (ATS Readiness per D1, JD coverage, progress metrics) | P2 | per-score contract |
| 6 | Persistence of ResumeFacts and score metadata | P2 | step 1, D5 conditions |
| 7 | AI gateway reliability: error classes, schema validation, logging, then fallback | P2 | read deployed function |
| 8 | Matching engine and marketplace labels | P3 | steps 3, 6 |

Every roadmap item is a gate and must state, before work starts:

| Field | Content |
|---|---|
| Allowed scope | files, modules, tables it may touch; everything else is out of scope |
| Required dependencies | earlier steps, decisions, evidence that must exist |
| Evidence to deliver | tests, comparison report, query output, screenshots |
| Stop condition | what finding outside the plan halts the work and returns it for review |
| Rollback | how to undo, and what state or data changes need a separate undo |

Moving ATS Readiness to deterministic-first does not by itself replace every existing AI score, restore `scanHistory`, or write a new score
to the database. Each of those is a separate item with its own gate.

Traceability required for every change: requirement → architecture decision (ADR) → code change → test evidence. Each PR updates this
document if it changes a data contract, module boundary, API or AI orchestration.

## 11. Live-database evidence (added 2026-10-09)

Source: [EVIDENCE_RESULTS_2026-10-09.md](EVIDENCE_RESULTS_2026-10-09.md). All statements here are **[DB]** unless marked otherwise.

**The database is ahead of `main`.** A "Phase 1 foundation" (career profile, targets, versioned evidence, verification requests and
attempts, trusted issuers, consents, plus platform contracts v1.1) was applied to production on 2026-10-05. Its design, tests and contracts
sit on the unmerged branch `feature/phase1-foundation` (commit `5c377ae`) [CODE on that branch]. No code on `main` reads or writes those tables,
and the branch itself says nothing in the app writes to them. The target architecture must be built on that model, not in parallel to it.

What the database already enforces:
- RLS on all 27 public tables; owner-scoped policies on every user table.
- Evidence is immutable by version; the browser can only add claims and withdraw; verification fields are changed only by server functions that
  the browser roles cannot execute; `ELIGIBLE` needs a verified issuer and a verified recipient binding; attempts are append-only.
- Employer data access depends on `employers.verified_at`, which the browser cannot set.

What is still open (finding ids from the results document): user-writable score inputs (F-1), candidate-writable match fields (F-2),
credential status stored in the user-writable blob (F-3), recruiters reading every visible profile (F-4), stale scores after deletion (F-5),
a `jd_analyses` insert using nonexistent columns (F-6), the evidence model unused by the app (F-11), and new accounts capped at a trust score of
60 (F-12).

### Mapping the approved credential states (D3) to the existing model

D3 asked for four states. The database already has a state machine and a separate trust layer. To avoid two parallel models, the proposal is to
treat the D3 states as a **display and policy vocabulary over the existing fields**, not as new columns:

| D3 state | Existing representation | Notes |
|---|---|---|
| `self_reported` | no evidence row, or `UNVERIFIED` with `source_type = user_claim` | user says so |
| `evidence_provided` | `UNVERIFIED` with an artifact: `source_url`, `user_upload` or `raw_credential` | proof supplied, not checked |
| `source_checked` | `VERIFIED` and `trust_status = NOT_ELIGIBLE` (for example `platform_page`, confidence never `HIGH`) | the source or content was checked; the recipient is not tied to the account |
| `issuer_verified` | `VERIFIED` and `trust_status = ELIGIBLE` | issuer trusted, signature valid, `subject_binding` in `email_verified`/`did_proof`, `recipient_binding_verified` true |

This mapping is **a proposal for the owner to confirm**; it is not decided. If confirmed, the app's current `credentials[]` status in
`user_memory` becomes display-only legacy and is never used as a source of verification.

### Consequences for earlier decisions
- **N3 (recruiter role):** server-side authorization exists (`verified_at` + `is_verified_employer_member`). The client-side role selects a screen
  and allows creating an unverified employer; it does not grant data access. The open question is narrower: F-4, whether verified recruiters
  should read all visible profiles without per-employer consent.
- **N4 (issuers):** the model for issuer trust and recipient binding exists (`trusted_issuers`, `subject_binding`). What is missing is a verifier
  service and the list of issuers that can actually confirm ownership.
- **D5 (ResumeFacts persistence):** the new store should follow the same pattern (owner-scoped RLS, immutable versions, server-written derived
  fields), and the retention question for `evidence.raw_credential` (personal data) is already open in the Phase 1 README.
- **Score vocabulary:** contracts v1.1 define `AI_ESTIMATE`, `PRACTICE_SCORE`, `VERIFIED_TRUST`, `MATCH_SCORE`, `READINESS_SCORE` and the rule that
  unknown is `null`. The P4 `score_type` (`careeraihub_ats_readiness`) is not in that list; reconciling the two is a decision for the owner (it
  must not be improvised in code).

## Appendix A: decisions on record and decisions still needed

| Id | Decision | State |
|---|---|---|
| D1 | P4 deterministic as the base of the new ATS Readiness; AI score kept as legacy; no new score on the UI before agreement | **approved as direction** |
| D2 | No restoring `scanHistory` by fake writes or relabelled AI scores; target sources per component; "Chưa đánh giá" for absent data | approved as direction |
| D3 | Four credential states; server-side verification with ownership; audit before Trust Layer changes | approved as direction |
| D4 | No aggregate TrustMatch score or "Verified Match"; labels by available data | approved as direction |
| D5 | ResumeFacts server-side in principle; no persistence before schema/RLS/retention audit | approved in principle |
| D6 | Do not delete `resumeParser.extractResume*` in phase A; remove later in its own PR after verification | approved |
| N1 | Canonical formula, weights and explanation text of ATS Readiness v2. Product owner recommendation: do not fix a new formula in this document; keep P4 with its own version; open the UI only after criteria, weights, explanation and tests are agreed | **open** |
| N2 | Retention, deletion, copies and related systems for resume text and ResumeFacts. Recommendation: no retention period is set yet; prepare a proposal for owner approval | **open** |
| N3 | Recruiter role. Recommendation: a role chosen at sign-up is not evidence of a recruiter grant; sensitive functions only after server-side authorization is verified; whether self-registration as recruiter is allowed is a separate product decision | **narrowed** by evidence: server-side gate exists; remaining question is F-4 (recruiter read scope) |
| N4 | Credential issuers. Recommendation: `issuer_verified` only with an issuer-source verification procedure and recipient-to-account matching; list supported issuers by what can actually be verified | **open**; issuer-trust and binding model already in the database, verifier service and issuer list missing |
| N5 | ADR folder for significant architecture decisions (context, options, consequences, status); not for every small PR | accepted as a proposal; folder started in [adr/](adr/README.md) |
