# Design: Resume Context (Stages 1 and 2)

Status: **DESIGN ONLY. No code, no SQL, no table, no production change, nothing stored server-side.**
Owner decisions recorded 2026-10-11 ("duyệt"): **Q1 approved** (Stage 1 is the first implementation PR: named call sites and count-only fields, no behaviour change). **Q2 approved as a sequence** (all four in the target architecture; Stage 2 starts with Interview Coach and Resume Scan). **Q3 stays pending** (no document hash in logs). **Q4 (measurement period) and Q6 are open.** Q5 was answered by reading the code. Approval of this design does not approve any code, SQL or deployment; each implementation PR is reviewed separately.
Written 2026-10-11. Language scope: **the platform serves English-language users only** (owner statement, 2026-10-11). Non-English text stays `unsupported_language` where a score exists; no non-English validation branch is opened by this design.

Evidence tags: **[CODE]** read in source on `main` @ `2ff35d4` · **[LOG]** read from a production `[usage]` log line pasted by the owner on 2026-10-11 (one call, one sample) · **[PROPOSAL]** new, not approved · **[UNKNOWN]** not established.
Related: `docs/AI_ENTRYPOINT_INVENTORY.md` (partly stale, see section 2), `docs/architecture/plans/DESIGN-mock-interview-tier0.md`, `docs/audits/INTERVIEW-CONSTRAINTS-PHASE0-AUDIT.md`, ADR-011, ADR-012.

---

## 1. Goal

Every feature that needs the candidate's resume should consume a **purpose-built view of the same underlying evidence**, instead of independently re-reading and re-interpreting the whole resume. This should (a) remove duplicate AI work, (b) keep features consistent with each other, and (c) give the Trust Layer a base where a fact is traceable to the text it came from.

Not a goal: a smaller prompt for its own sake. A small summary that drops critical evidence is not an improvement (section 9).

## 2. Current state [CODE]

**Where the resume lives.** `memory.resumeText` and `memory.resumeData` sit in the browser's memory object, which `useMemory` upserts whole into `user_memory`; the text is also kept in `localStorage` (`docs/DATA_LINEAGE.md`). A PDF upload keeps **no text** (`content: null`); the PDF itself lives only for the session in `memory.scanPdfBase64`.

**How features get it.** `pickResumeSource` (`src/lib/resumeSource.js`) returns structured text, pasted text, or the session PDF as base64, clipped to `MAX_RESUME_CHARS` = 12 000 characters. `digestResume` (`src/lib/resumeDigest.js`) condenses to a budget (6 000 by default; 3 000 in the ATS bullet rewrite). Each feature then builds its own prompt.

**Resume-bearing AI call sites on `main`** (from `grep callLLM(` and `pickResumeSource`, re-read 2026-10-11; the older inventory predates the dead-flow removal and metering):

| Feature | Site | Sends the resume as |
|---|---|---|
| Onboarding extraction fallback | `App.jsx:364` | PDF base64, only when pdf.js text extraction throws |
| Onboarding profile card | `App.jsx:600` | first 4 000 characters (per inventory; not re-read here) |
| Resume Scan: template parse | `ResumeScan.jsx:164` | text (12 000 chars per recent changes) |
| Resume Scan: JD match | `ResumeScan.jsx:220` | digested text + JD |
| ATS Builder: parse | `ATSBuilder.jsx:96` | text, first 5 000 chars (per inventory) |
| ATS Builder: bullet rewrite | `ATSBuilder.jsx:586` | `digestResume(…, 3000)` |
| JD Analyzer | `JDAnalyzer.jsx:40` | text or PDF base64 |
| Cover Letter | `CoverLetterGen.jsx:33` | text or PDF base64 |
| Mock Interview: questions | `HiringManagerSim.jsx:52` | text or PDF base64 |
| Mock Interview: evaluate | `score-interview` | text ≤ 6 000 chars (server cap) |
| Salary Prep | `SalaryCoach.jsx:290` | text or PDF base64 |
| Skills Gap | `SkillsGap.jsx:72` | scan summary, not the resume |
| Study Plan | `StudyPlanModal` (`LandingPage.jsx:3230-3362`), opened from `App.jsx` | **Does not use the resume and does not call a model** [CODE, read 2026-10-11]: its props are only `onClose`, `initialTab`, `onModuleSelect`; the body contains no `callLLM`, `fetch`, `memory` or resume reference (the one `'memory'` match is a tab key). It is a static guide that routes to other modules |

So the same resume text is sent by up to nine independent sites, and three of them (onboarding card, template parse, ATS Builder parse) produce overlapping structured parses of the same text with a model. **Whether those three are all reachable in the current UI, and how often each runs, is [UNKNOWN] until measured** (Stage 1). Where a PDF is the only source, each call can resend the whole file.

**What already exists to build on [CODE].**
- `src/extraction/resumeFacts.js` `extractResumeFacts(text)`: deterministic, no AI; reuses `splitSections` so section detection is shared with the digest.
- `src/contracts/resumeFacts.js`: every fact has `value`, `normalized_value`, `source` (path in the document model), `evidence` (the exact source text, required when `value` is not null), `confidence`, `extraction_method`, `requiresInterpretation`; `schema_version` = `RESUME_FACTS_VERSION` (1.0.0); an `extraction.status`.
- `src/extraction/hash.js` `contentHash`: fast, non-cryptographic identity hash. Per `docs/DATA_LINEAGE.md` nothing consumes it yet.
- `computeDeterministicScore` and `sectionReport` already run on the same text.
- Usage metering (C1, merged): each model call logs `feature`, `input_tokens`, `output_tokens`, `thinking_tokens`, `duration_ms`, `has_pdf`, with a salted user reference and no content.

**Current measurement gap [LOG].** The production line pasted on 2026-10-11 shows `feature: "unknown"` because the deployed web app is the pre-metering build. `featureFromLocation()` (merged, `src/lib/ai.jsx`) derives the label from `?tab=`, so a web deploy will give coarse names such as `tab_simulate`, but **several call sites inside one tab share one label** (for example the two Mock Interview calls). One sample line also showed 1 789 input, 540 output and 1 239 thinking tokens (3 568 total). That is a single call and not a basis for any conclusion.

## 3. Principles

1. **Deterministic first (ADR-011).** Facts are extracted by code; a model may *propose* but never silently becomes the source of a fact.
2. **Unknown stays unknown.** No default, no guess; an unreadable section is reported, not filled.
3. **Evidence travels with the fact.** Anything shown or sent to a model can be traced to the text it came from.
4. **Summarize by default; retrieve source evidence when a task needs it.** Neither "send the whole resume every time" nor "keep only a summary".
5. **A hash identifies a document version. It is not an access control.** Authorization is checked separately.
6. **Measure before claiming.** No cost-saving claim in product copy or docs until Stage 1 numbers exist.

## 4. Three layers [PROPOSAL]

| Layer | What it is | Where it may live in Stages 1–2 |
|---|---|---|
| **Source** | The original text as extracted (PDF/DOCX → text) plus the document version identity | Already in browser memory today; unchanged |
| **Facts** | `ResumeFacts`: structured fields with `source` + `evidence` + `confidence` + `extraction_method` | Computed in the browser once per document version; held in memory for the session; **not stored server-side** |
| **Task context** | A bounded view built by code from the facts and, if needed, source passages, for one feature | Built on demand; never persisted |

**Retrieval rule.** A task-context builder starts from facts and adds **verbatim source evidence** for anything the task must quote or reason about. Example: a question about a difficult decision needs the original bullet describing the decision, not only "has product experience".

## 5. Fact provenance states [PROPOSAL, evaluate before changing the contract]

Four states that must never be treated as interchangeable:

| State | Meaning | Today |
|---|---|---|
| `extracted` | Explicitly present in the source text | Covered: `extraction_method` + `evidence` |
| `normalized` | Standardised by code (dates, skill names) | Covered in part: `normalized_value` |
| `inferred` | Suggested by a model, awaiting confirmation | **Not representable** in the contract today |
| `verified` | Confirmed against an authoritative source | **Not representable**; no verification path exists for resume facts |

This design **does not change** `src/contracts/resumeFacts.js`. Stage 1 includes a compatibility assessment: whether `inferred` and `verified` fit as a new field, as a new `extraction_method` value, or need a version bump (`RESUME_FACTS_VERSION`), and what existing tests and consumers (`validateResumeFacts`, ATS Readiness, `sectionReport`) would break. Any change is a separate, reviewed PR.

A fact that merely appears in a resume is not true, and a fact in storage is not verified. UI and prompts must not imply otherwise.

## 6. Feature contexts [PROPOSAL]

Each feature gets its own context definition, input limit and quality check. Limits below are **placeholders to be set from Stage 1 measurements**, not decisions.

| Feature | Needs | Source passages added when | Limit | Quality check |
|---|---|---|---|---|
| Resume Scan (JD match) | Skills, titles, quantified bullets, section presence | A requirement must be matched against specific wording | from Stage 1 | Matched/missing terms agree with `checkKeywords` (code), no term the resume lacks reported as present |
| ATS Builder (parse, rewrite) | Full wording of the bullets being rewritten | Always for the targeted bullets | from Stage 1 | Rewrites add no figure absent from the bullet (existing `findInventedNumbers`/guards) |
| Interview Coach | Role titles, tenure, skills, 3 to 5 achievement bullets | A question asks about a specific project or decision | from Stage 1 | Questions refer only to facts present in the profile; none invent employers, titles or numbers |
| Study Plan | None today (static guide, no resume access) | n/a | n/a | n/a. It stays in the target architecture as a **navigation surface** to the modules above; if it ever gains a personalised plan, it consumes a task context like any other feature and gets its own row then |

Also outside this list but affected later: Cover Letter, JD Analyzer, Salary Prep (they pass the whole resume today). They are not in scope for Stage 2 unless the owner adds them.

## 7. Stage 1: baseline measurement (no behaviour change)

**Objective:** know, per feature, how much the resume costs today, so Stage 2 is judged against numbers.

1. **Name each call site.** Pass an explicit `feature` option from every call site (the option exists: `callLLM(..., options.feature)`), so labels distinguish, for example, `mock_questions` from `mock_evaluate`. Server-side functions (`score-interview`, `score-star`) set their own feature names in their metering call. This is a small code change in a later PR; not made here.
2. **Record per call:** `feature`, provider, model, `input_tokens`, `output_tokens`, `thinking_tokens`, `duration_ms`, `has_pdf`, outcome, attempt number (all already in the event). **Add** (proposal): the resume-source kind (`structured` / `text` / `pdf` / `none`) and the character count of the resume part of the prompt. Counts only; **no resume text, no answers in logs**.
3. **Count repeated work, without calling every shared read a duplicate.** Two calls that read the same resume for **different purposes** (for example a JD match and an interview question) are legitimate uses of shared evidence, not duplicates. A **duplicate analysis** is defined narrowly: the same *purpose* (same `feature` label and kind of output, for example "structured parse of the resume") repeated for the same document, or two features that each produce an overlapping model parse of the same text (today: onboarding card, template parse, ATS Builder parse). Stage 1 classifies each resume-bearing call site by purpose **by reading the code once** (a table in the Stage 1 report), and then counts calls per purpose. The same document hash does not by itself prove that two tasks are interchangeable.
   **Default for Stage 1: no document hash in logs.** Repeats are counted per user reference, per feature label and per day, which needs no new identifier. Whether a salted hash may be added later to separate document versions is left to the owner (Q3); until approved, it is not implemented. A stable hash could link a person's uses of one document across log lines, so it is treated as personal-data-adjacent.
4. **PDF path.** Count calls with `has_pdf: true` and their input tokens versus text-only calls.
5. **Thinking tokens.** Report them separately from the resume effect; **how to reduce thinking for the current Gemini model is [UNKNOWN]** (the code comment in `geminiGenerationConfig` says it cannot be verified for newer models). Checking the provider's documentation is a Stage 1 task, not a change.
6. **Report.** Use `scripts/usage-report.mjs` on exported logs; cost stays `price_unknown` until `PRICE_TABLE` is filled from provider pricing pages (separate step).

**Representative resumes (for later stages).** English only. Synthetic or consented, never real personal data in the repository. A real-resume folder may exist only outside the repo.

**Exit criteria for Stage 1:** a per-feature (and per-purpose) table of calls, tokens (input, output, thinking), repeat rate by purpose and PDF share from real usage over a period the owner chooses; and a written compatibility assessment of the provenance states (section 5).

## 8. Stage 2: client-side reuse (after Stage 1 review)

1. **One computation per document version.** Compute `ResumeFacts` and `contentHash` once when the resume text changes, keyed by (content hash, `RESUME_FACTS_VERSION`, extractor version). Hold the result in memory for the session and share it between features; recompute when any key part changes.
2. **Context builders.** One small pure function per feature (section 6) that takes facts (+ source) and returns a bounded string and a record of what it included and what it left out.
3. **Replace, don't add.** Where a feature currently runs its own model parse of the same text, use the shared facts instead, **only where the Stage 1 numbers and a quality comparison justify it**. Each replacement is its own small PR with its own regression test.
4. **PDF fallback.** If text extraction fails, return an explicit extraction status. Do not silently resend the full file on every call. If an AI vision fallback is used, it is an explicit, user-visible decision (and likely once, with the result cached for that document version).
5. **No new claim.** In Stage 2 the facts are a **session-local cache**, not a canonical cross-device profile. No copy, tooltip or doc may call it a verified profile.

**Cache invalidation.** A new text version invalidates facts and every task context derived from it; a changed extractor or schema version does the same.

## 9. Evaluation [PROPOSAL]

Measured separately so the effect of each change is clear.

| Measure | How |
|---|---|
| Repeated same-purpose resume analyses removed | Calls per purpose per user per day, before/after (Stage 1 vs Stage 2); shared-evidence reads for different purposes are not counted as duplicates |
| Input tokens and thinking tokens per feature | `[usage]` events, reported separately |
| Cost per completed task | After `PRICE_TABLE` is filled; until then tokens only |
| Fact precision and recall | On a reviewed English sample: extracted facts vs a human reading |
| Unsupported claims | Facts or statements in outputs with no evidence in the source, compared with the current flow |
| Omitted relevant evidence | Cases where the task needed a passage the context builder left out |
| Task quality | Reviewer comparison of old vs new outputs on the same inputs; user acceptance where available |
| Share of tasks that genuinely need full source | Counted from the retrieval rule |

A change ships only if unsupported claims do not rise and omitted evidence is acceptable, **even if tokens fall**.

## 10. Risks and open items

1. **Versioning:** text hash alone is not enough; include extractor/schema versions (section 8.1).
2. **Trust of browser-generated facts:** useful for reuse, but a browser-computed fact is not a trusted server fact. Any later server-side profile needs ownership checks, write permissions, deletion and retention decided first.
3. **PDF fallback cost:** silent repeated uploads are the failure to avoid.
4. **Evidence preservation:** if a summary omits a limitation or qualification, the system must be able to retrieve the original passage.
5. **Provider caching:** prompt caching differs by provider and the fallback chain spans several; treated as a later optimisation, not a foundation. **Availability for the models in use is [UNKNOWN].**
6. **Parsing quality:** the reader still has known gaps on table/icon layouts (see the reader quality gate). Facts inherit those gaps; Stage 2 must not hide them.
7. **Study Plan** has no resume use today (section 2); no work is needed for it in Stage 1 or 2.

## 11. Explicit exclusions

No new table, no SQL, no change to `user_memory`, no server-side canonical profile, no production change, no deploy, no change to `RESUME_FACTS_VERSION` or the contract, no cost-saving claim before Stage 1 numbers, no non-English validation branch, no landing copy change (the line "EN · VI resume headings read" is a later landing edit).

## 12. Decisions needed from the owner

| # | Question | Assistant's suggestion |
|---|---|---|
| Q1 | Approve Stage 1 as the first implementation PR (named call sites + extra count-only fields, no behaviour change)? | Yes |
| Q2 | Which resume-bearing features are in Stage 2 scope? Target architecture covers Resume Scan, ATS Builder, Interview Coach (Study Plan is only a navigation surface today). Cover Letter, JD Analyzer and Salary Prep also pass the whole resume. | Keep all in the target; **start Stage 2 with Interview Coach and Resume Scan**, add others one at a time after measurement. This is a sequence, not a reduction of the target |
| Q3 | May a salted, non-reversible hash of the resume be added to usage log lines later, to separate document versions? | **Pending. Not implemented by default.** Stage 1 counts repeats per user reference, feature and day without it. Approve only after considering that a stable hash can link uses of one document |
| Q4 | What period of real usage is enough for Stage 1 numbers? | Owner decides; the volume is small, so the sample may be thin and that should be stated in the report |
| Q5 | ~~Is Study Plan model-backed?~~ **Answered by reading the code:** no model call and no resume access today (section 2) | Nothing to decide for Stage 1 or 2. If a personalised plan is wanted later, it is a new feature with its own design |
| Q6 | Provenance: evaluate adding `inferred` / `verified` states in Stage 1, or leave until a verification path exists? | Evaluate only; no contract change yet |

## 13. Order of work

1. Review of this design. 2. Read-only verification of the resume-bearing call sites and the Study Plan flow (done for Study Plan; the call-site table is to be completed with purposes in the Stage 1 report). 3. Owner decisions on measurement (Q1, Q3, Q4). 4. Stage 1 PR (measurement). 5. Stage 1 report. 6. Stage 2 per feature, one small PR each, each with regression and quality evidence. 7. Only then, a separate proposal for any server-side profile (database, privacy, retention).
