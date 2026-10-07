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

## 2. Target pipeline (TARGET)

```
user file
  -> deterministic extraction (text)
  -> ResumeDocument  (text + sections, one canonical copy per content hash)
  -> ResumeFacts     (sections, contact, experiences, education, skills, dates, metrics, keywords, evidence)
  -> ScoreResult     (ATS, JD match, credibility, readiness inputs)  -- code only
  -> AI interpretation (explain / rewrite / suggest / question), receives facts + scores, cannot change them
```

One parse per content hash, shared by every module, so Onboarding, Resume Scan and ATS Builder can never
disagree about the same CV. Today each of them asks the model separately (VERIFIED, see section 4).

### ResumeFacts: every extracted field carries its source and confidence

```js
// A field is { value, source, confidence }. Code sets all three.
//   value:      what was extracted, or null
//   source:     where it came from, e.g. "experience[0].title", "regex:email"
//   confidence: 0..1. A field below the threshold is NOT trusted and is not used for scoring.
//   requiresInterpretation: true when code could not decide (e.g. several concurrent roles, no dates,
//               career break, non-chronological CV). Only then may AI be asked, and its answer is stored
//               with source "ai" and the confidence the validation gives it.
```

Heuristics (for example "current role = first entry of Experience") are allowed only as a source with an
explicit confidence. They must return `value: null, requiresInterpretation: true` rather than guess when
the layout does not fit (consultant, freelancer, founder, career break, concurrent roles).

### ScoreResult

```js
// scoreATS(facts, jd?) -> { score: number|null, parts: [{ id, score|null, evidence[] }], missing[] }
// score is null when a required part cannot be computed. No part is defaulted to 0.
// The AI receives { score, parts, missing, evidence } and writes the explanation. It never returns a score.
```

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

1. Skills Gap market numbers hidden. Done (not deployed).
2. Design `ResumeFacts` / `ScoreResult` (this document, section 2).
3. `resumeRules.js` (extraction with confidence) and `resumeScore.js`, with fixture CVs.
4. ATS Builder and Resume Scan on the deterministic score.
5. JD Analyzer and JD Match requirements/keywords in code. MemoryDashboard progress in code.
6. Content-hash cache, better retry, second provider (needs a decision about keys).

Real market data for Skills Gap and Salary is a separate item (OP-2). The `jobs` Edge Function (Adzuna)
is a candidate source. What it returns for counts and salary is UNKNOWN until it is read and tested.
