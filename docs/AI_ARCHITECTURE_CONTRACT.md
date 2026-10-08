# AI architecture contract

Rule of the project: **deterministic code is the foundation, AI only assists.** Code extracts, counts,
calculates and scores. AI interprets, explains, rewrites, suggests and asks.

Status words used below: **VERIFIED** (read in source or test), **UNKNOWN** (not checked), **TARGET**
(designed, not built). The audit was done by reading the code and prompts. No model was called and no
token cost was measured.

## 1. Rules

AI MUST NOT:
- calculate or re-calculate a score that code can calculate
- count facts that code can count (metrics, sections, bullets, keywords, dates)
- state market numbers (job counts, salary ranges, demand, forecast match rates) without a verified source
- invent candidate figures or claims
- change a number the code has produced

AI MAY:
- explain why a score is what it is, from the facts and score it is given
- summarise, rewrite, suggest, generate interview questions
- flag semantic ambiguity that code could not resolve

Every numeric claim shown to a user has one of three origins, and the UI says which:
1. **computed** by code from the user's own data (show how, where practical)
2. **sourced** from a named external source
3. **estimate**, labelled as an estimate

A number that fits none of these is not shown. Missing data stays missing (`null`), never `0`.

Enforcement: `tests/security/noFakeData.test.js` has the rule `ai-market-numbers` (fields the model used to
invent for Skills Gap). New categories get a rule there when they are found.

## 2. Target architecture (TARGET)

```
USER FILE
  -> DOCUMENT INGESTION   deterministic: text, structure, metadata, extraction status
  -> RESUMEFACTS          canonical representation of what the resume says
        |-- DETERMINISTIC ENGINES   facts, derived facts, scores
        '-- AI / SEMANTIC ENGINE    interpretation only
  -> PROVENANCE           every claim traces back to evidence
  -> PRODUCT UI
```

"Deterministic document extraction" does not mean "deterministic resume understanding". Reading text out of
a PDF or DOCX is one problem; deciding what a bullet means is another. The semantic step may use AI, but its
output is stored with `extraction_method: "ai"`, validated, and never overrides a fact code extracted.

One parse per content hash, shared by every module, so Onboarding, Resume Scan and ATS Builder can never
disagree about the same CV. Today each of them asks the model separately (VERIFIED, section 4).

AI failure must not be product failure: facts and scores come from code, so they are still there when the
provider is down.

### Three kinds of intelligence

| Kind | Examples | Who produces it | May AI change it? |
|---|---|---|---|
| **A. Facts** | name, email, phone, URLs, dates, companies, job titles, education, explicit skills, explicit metrics, explicit certifications, raw evidence | deterministic extraction | No |
| **B. Derived facts** | years of experience, employment duration, career gaps, keyword overlap, formatting, metric density, skill coverage, JD match, completeness, chronology consistency | deterministic algorithms over A | No |
| **C. Interpretation** | why a bullet is weak, what the experience suggests, rewrite, coaching, strategic advice | AI, given A and B | n/a: it is the AI's output, and it cannot restate a number differently |

### Field shape

```js
// Every extracted fact:
{
  value,              // as extracted, or null
  normalized_value,   // e.g. 0.20 for "20%"; null when not normalisable
  source,             // path in the document model, e.g. "experience[2].bullets[1]"
  evidence,           // the exact text span the value came from
  confidence,         // 0..1; below the threshold the fact is not used for scoring
  extraction_method,  // "regex" | "rule" | "structure" | "ai"
  requiresInterpretation // true when code could not decide; only then may AI be asked
}
```

Heuristics (for example "current role = first entry of Experience") are allowed only with an explicit
confidence, and must return `value: null, requiresInterpretation: true` rather than guess when the layout
does not fit (consultant, freelancer, founder, career break, concurrent roles, non-chronological CV).

Semantic normalisation of a metric ("from 6 hours to 2 hours" -> `{type: time_reduction, before: 6h,
after: 2h, improvement: 66.7%}`) can be partly done by code (extract the two quantities, compute the
change). Deciding the metric type from context may use AI; the numbers in it still come from the text.

### Scores

```js
// scoreX(facts, jd?) -> {
//   score: number | null,        // null when a required part cannot be computed. No part defaults to 0.
//   score_type: "careeraihub_ats_readiness",   // never "your actual ATS score": employer ATS differ
//   version: "1.0.0",            // bump on any rule change so a changed score can be explained
//   parts: [{ id, score|null, evidence[] }],
//   missing: []
// }
```
The AI receives `{ score, parts, missing, evidence }` and writes the explanation. It never returns a score.
Parts for the resume score: completeness, formatting, keyword match (needs a target role or JD),
measurable impact, chronology, readability.

### Provenance

Each important claim shown to a user can say where it comes from:
`{ claim, support: [paths], derived_by: "career_duration_engine", confidence }`. This is the base for a
future Trust Layer / verified profile. It is built after ResumeFacts exists, not before.

### Inputs that are not the CV

ResumeFacts is the source of truth about the resume, not the whole context for every feature. Career Path
and similar features also need the target role, market, preferences and job descriptions.

## 3. Already deterministic (VERIFIED)

| What | Where |
|---|---|
| Keyword present or missing in a resume | `checkKeywords` in `src/lib/resumeDigest.js` |
| Section split, condensing long CV and JD | `splitSections`, `digestResume`, `digestJd` in `src/lib/resumeDigest.js` |
| Invented figures in an AI rewrite become `[X]` | `src/lib/factGuard.js`, `src/lib/numberGuard.js` (not used by every module) |
| Negotiation arithmetic | `negotiationMath` in `src/features/SalaryCoach/salary.js` |
| STAR overall score (weighted) and interview verdict | `overallScore` in `star.js`, `verdictFor` in `interview.js` (the section scores and answer scores themselves come from the model) |
| Dashboard, Readiness, Career Roadmap, Weakness Radar, Interview Coach | no model call (grep for `callLLM`) |
| Salary "Market data" tab | switched off by `MARKET_DATA_ENABLED = false`, makes no model call |

## 4. Audit of the 27 `callLLM` call sites

A = replace with code. B = code is the foundation, AI interprets. C = AI is appropriate.

| Where | What the model does today | Class | Status |
|---|---|---|---|
| `src/lib/resumeParser.js` `extractResumeFromPdf/Docx` | resume to JSON | A | No caller found: dead code. Not yet removed |
| `App.jsx` onboarding profile (currentRole, yearsExp, topSkills, headline) | extracts it | B | TARGET: code with confidence, AI only if ambiguous |
| `ATSBuilder.jsx` `parseResume` | parse + `atsScore` + 5 sub-scores + issues | B | TARGET |
| `ATSBuilder.jsx` `SCAN_PROMPT` (2 sites) | `atsScore`, `parameters`, `gaps` | B | TARGET |
| `ATSBuilder.jsx` `buildAnalysisPrompt` | re-scores the rebuilt resume | A | TARGET: same scoring function on the new text |
| `ATSBuilder.jsx` build result fallback | `atsScore + doneCards * 5` when the model gives no score | A | Invented number, not yet removed |
| `ResumeScan.jsx` `parseForTemplate` | same parse again | B | Duplicate of ATS parse |
| `ResumeScan.jsx` JD match | `matchScore`, bars (keywords are already code) | B | TARGET |
| `ResumeScan.jsx` scan | `credibilityScore`, `metricsFound` (x14 in the UI) | B | TARGET: counting is code |
| `JDAnalyzer.jsx` | `matchScore`, requirements, gaps | B | TARGET |
| `STARBuilder.jsx` | section scores, rewrite | B | |
| `HiringManagerSim.jsx` (2 sites) | questions; answer score | C / B | |
| `MemoryDashboard.jsx` | `overallProgress`, status, weekly plan | A | TARGET: from activity counts |
| `SkillsGap.jsx` | skills list, recommendations; used to also invent market numbers | B | **Market numbers removed** (see section 5) |
| `ATSBuilder.jsx` bullet rewrite, rebuild HTML, per-gap suggestion; Cover Letter; Salary script; AI Coach; OCR fallback for image PDFs | writing | C | |

Structural findings (VERIFIED by reading the code):
- The same resume text is sent to the model separately by Onboarding, Resume Scan, ATS Builder parse and
  ATS Builder scan. There is no cache keyed by content.
- `callLLM` retries once (`MAX_RETRIES = 1`) and there is no second provider. The Supabase secret
  `AI_FALLBACK` exists but nothing in this repo reads it, so the deployed `ai` function may not match
  the repo (UNKNOWN: the deployed source was not read).
- JD Analyzer, Cover Letter, Salary and the interview simulator can send a whole PDF as base64 when no
  text is available. How often is UNKNOWN.

## 5. Changes made under this contract

- **Skills Gap (done):** the prompt no longer asks for `matchRate`, `projectedMatchRate`, `activeRoles`,
  `marketDemand` or `marketStats`. The market bar, the "Market data" numbers and the "lift your match rate
  from X% to Y%" sentence are gone; a result saved earlier still renders without them. The card says
  "Market intelligence is temporarily unavailable". Two claims that the AI compares the profile to live job
  postings were reworded, since it has no job data. AI Coach no longer receives the match-rate forecast.
  Tests: `src/features/SkillsGap/SkillsGap.test.jsx` (3 checks fail on the previous code), rule
  `ai-market-numbers`.

## 6. Order of work

| Phase | What |
|---|---|
| Done | Skills Gap market numbers hidden (not deployed) |
| P0 | **Data contract**: ResumeFacts, evidence, provenance, extraction status and versioning as schemas with validators and tests. No parser yet |
| P1 | Document ingestion for the formats the app accepts (PDF, DOCX, TXT: VERIFIED from the upload code). Extraction status per file (ok / partial / no text layer). Scanned PDFs keep the current AI fallback, flagged `extraction_method: "ai"` |
| P2 | Deterministic extraction: contact, dates, experience, education, skills, metrics, links |
| P3 | Validation: schema, contradictions (overlapping dates, end before start), confidence, evidence |
| P4 | Deterministic engines: resume score, skills, metrics, format, chronology, JD match, MemoryDashboard progress |
| P5 | AI layer on top: rewrite, explanation, coaching |
| P6 | Resilience: error classes, retry policy, provider router, circuit breaker, content-hash cache, observability |

Test corpus (built from P1): fixtures by failure mode, not by count: standard, two columns, no contact
section, several jobs at one company, overlapping dates, employment gap, international date formats,
non-English, PDF with a bad text layer, scanned PDF, DOCX, tables, icons, headers/footers, metrics with and
without symbols, skill synonyms, duplicate skills, unknown formatting, malformed file. The key test is
**same input -> same ResumeFacts -> same ScoreResult**, run twice.

Out of scope until the product accepts them: PPTX and XLSX (the upload code accepts PDF, DOCX and TXT only).

## 7. Resilience policy (P6)

Whether a call needs AI is decided first: if code can answer, AI is not called. Errors are classified:

| Error | Retry | Fallback provider |
|---|---|---|
| 429, 503, timeout, network | yes, with backoff and jitter | yes |
| 400 invalid request, malformed prompt | no | no |
| content blocked, reply truncated | no | no |
| provider returns 401/403 (our key is wrong) | no | yes |
| insufficient context | no | no |

Current behaviour (VERIFIED in `src/lib/ai.jsx` and `supabase/functions/ai/handler.js`): the client retries
once, on 429, any 5xx, timeout and network error. The function answers 422 for truncated/blocked replies and
400 for other 4xx, so those are not retried, which already matches the table. Two gaps: a provider 401/403
is reported to the client as 500, so the client retries it pointlessly, and an empty reply is a 502 that is
retried. There is no second provider. Real use of `AI_FALLBACK` is UNKNOWN until the deployed source is read.

Real market data for Skills Gap and Salary is a separate item (OP-2). The `jobs` Edge Function (Adzuna) is a
candidate source; what it returns for counts and salary is UNKNOWN until it is read and tested.
