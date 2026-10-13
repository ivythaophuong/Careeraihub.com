# Design: code first, then the right model for what is left (routing by feature)

Status: **DESIGN ONLY. Nothing changed in product code, secrets, providers or production.** Rewritten 2026-10-13 after the owner's correction: extraction is done by code, AI only interprets and explains (`docs/AI_ARCHITECTURE_CONTRACT.md` section 1, ADR-007, ADR-011). The first version of this file put extraction on an AI model; that was wrong against the contract.
Labels: MEASURED (a run or log) · SOURCE (provider page read 2026-10-13) · VERIFIED (read in source today) · INFERRED · UNKNOWN · PROPOSED.
Inputs: the R1 proposal (impact table), `AI-PROVIDER-DATA-TERMS-2026-10-13.md`, `STAR-VARIANCE-RESULTS-2026-10-12.md`, `MIGRATION_MATRIX.md`, `supabase/functions/ai/providers.js`.

## 1. The rule, in four tiers

| Tier | Who answers | Examples |
|---|---|---|
| 0 | **Code.** If code can answer, no model is called. | reading text from PDF and DOCX (pdf.js, mammoth: VERIFIED in `App.jsx`), the ATS Readiness score (`computeDeterministicScore`), keyword coverage (`checkKeywords`), facts from a resume (`src/extraction/resumeFacts.js`), negotiation arithmetic |
| 1 | **A model explains** a result that code produced. Short, cheap. | why a score is what it is, what to fix, what a gap means |
| 2 | **A model generates** text the user will use. | interview questions, cover letter, negotiation script, coaching chat, plans |
| 3 | **A model reads what code cannot read.** | a scanned or damaged PDF (OCR), only after the code path failed |

Everything below follows from this. Choosing a cheaper provider for a Tier 0 job would be the wrong optimisation: moving a job from a model to code removes its cost, its variance and its privacy exposure.

## 2. Every AI call site, and how far it can move to code today

21 call sites, mechanically confirmed by `tests/security/aiCallSites.test.js` (17 browser labels, 2 server labels, 2 unlabelled calls in unused code). "Code today" says what already exists in the repo; whether the code path is as accurate as the model on real CVs is **UNKNOWN until measured** (section 6).

| # | Label (where) | What the model does today | Target tier | Code that exists | Notes |
|---|---|---|---|---|---|
| 1 | `ats_parse` (ATS Builder) | reads the CV and returns all fields (ceiling 4000 out; observed 1.6K in, 2K to 4K out) | **0** for the fields, 1 for the explanation | `extraction/resumeFacts.js` (contact, dates, education, experience, skills, metrics); ATS score already code | the prompt already says the model must not output a score; extraction is the part still on a model. MIGRATION_MATRIX PR-20 |
| 2 | `scan_template_parse` (Resume Scan) | parses the CV again (ceiling 4500 out, 12K chars in: the largest ceiling) | **0**, share one extraction with #1 | same as #1 | duplicate parse of the same text (AI contract section 4) |
| 3 | `onboarding_profile` (App) | role, years, top skills, headline (800 out) | **0**, model only if code returns `requiresInterpretation` | `resumeFacts`, dates | PR-23 |
| 4 | `onboarding_pdf_extract` (App) | reads a PDF when pdf.js failed (3000 out, PDF) | **3** | text extraction itself is code | legitimate model use (scanned file); must be labelled `extraction_method: ai` |
| 5 | `scan_jd_match` (Resume Scan) | match score, bars, narrative (2500 out) | **0** for coverage and score, 1 for gaps and rewrite hints | `checkKeywords` already code | the model's `matchScore` is the part to replace (PR-22) |
| 6 | `jd_analyze` (JD Analyzer) | match score, requirements, gaps (2500 out, PDF possible) | **0** requirement matching, **1** synonyms and notes | partial (`jdAnalysis.js`) | the score is entirely model-made today |
| 7 | `skills_gap` (Skills Gap) | skills list and advice (1500 out) | **0** evidenced skills, **1** advice | `extraction/skills.js` | market numbers already removed |
| 8 | `score_interview_evaluate` (`score-interview`) | **sets the 0 to 100 answer score**, code clamps it (1800 out) | target: **0** structure score + **1** text feedback | `_shared/structure/` exists but `ENABLED_LANGUAGES` is empty (gated) | ADR-013; until the gate opens this is an interim Tier 1-style call that produces a number. A model switch changes the scale (section 4) |
| 9 | `score_star_review` (`score-star`) | section scores, code computes the total (2500 out) | same as #8 | same | measured spread on Groq: sd 3.3 overall, up to 25 on a section |
| 10 | `mock_questions` (Mock Interview) | writes 5 questions (2500 out, PDF possible) | **2** | none | PDF only as fallback when no text |
| 11 | `cover_letter` | writes the letter (2500 out, PDF possible) | **2** + code fact check | `factGuard`/`numberGuard` (not applied to every output) | PR-05 |
| 12 | `cover_letter_tone` | rewrites tone (1500 out) | **2** | same | |
| 13 | `salary_script` | writes the script (3000 out, PDF possible) | **2**, math stays code | `negotiationMath` | |
| 14 | `ats_bullet_rewrite` | rewrites bullets (4000 out) | **2** + figure guard | `factGuard` | |
| 15 | `memory_plan` (AI Memory) | **sets `overallProgress`** and writes a weekly plan (1500 out) | **0** progress from activity counts, **2** plan text | counts exist (ADR-013 Q-E) | contract class A; PR-24 |
| 16 | `ai_coach` (AI Career Coach) | chat reply (600 out, bounded history) | **2** | none | |
| 17 | `salary_market` (Salary Coach) | market numbers | **none**: unreachable | n/a | **VERIFIED**: `MARKET_DATA_ENABLED = false`, and the component holding the call (`MarketDataTab`) is mounted only when it is true. If re-enabled it needs a sourced dataset, never model numbers |
| 18 | `mock_evaluate_legacy` | old path when `VITE_SERVER_SCORING=false` | none | n/a | save is blocked by S4, so it fails closed; candidate for removal |
| 19 | `star_review_legacy` | old STAR path | none | n/a | same |
| 20, 21 | `resumeParser.extractResumeFromPdf/Docx` | unlabelled `callLLM` | none | n/a | no caller anywhere (VERIFIED); dead code, D6 says remove in its own PR |

Of the 21: **7 move mostly to code** (#1, 2, 3, 5, 6, 7, 15 for its progress number); **2 produce a model-made number today and should become code plus explanatory text once the structure score is gated** (#8, 9); **1 is a legitimate Tier 3** (#4); **6 are legitimately Tier 2** (#10 to 14, 16, plus the text part of #15); **5 should not exist as live calls** (#17 to 21). 7 + 2 + 1 + 6 + 5 = 21.

## 3. What this changes for cost and privacy

- The biggest model outputs today are extraction: `ats_parse` (up to 4000 tokens) and `scan_template_parse` (up to 4500). Moving them to code removes most of the AI spend per CV and the variance of parsing, and it removes a full resume from going to a provider for parsing at all.
- What remains is smaller: Tier 1 explanations take a few hundred tokens of code output as input, and Tier 2 is short generation. The cost per session at any provider is then cents or less.
- Personal text still reaches a provider for Tier 1 to 3; the data terms in `AI-PROVIDER-DATA-TERMS-2026-10-13.md` apply (free Gemini excluded for personal text; PDFs only to a provider that reads them and does not train on them).

## 4. Routing for what stays on a model (PROPOSED; quality unmeasured)

| Tier | Primary | Fallback | Reason |
|---|---|---|---|
| 1 explain | Groq gpt-oss-120b | Claude Haiku 4.5 | cheapest, no training or retention by default; the input is already structured, so small models do well (to be checked) |
| 2 generate (questions, coach) | Groq | Claude Haiku 4.5 | short output, text only |
| 2 generate (letters, scripts, bullets) | Claude Haiku 4.5 to test; Sonnet 5.5 only if Haiku measurably loses | Groq | the user reads this text; writing quality is the product |
| 3 PDF OCR | Claude Haiku 4.5 | Gemini **paid** | only providers that read PDFs; no free Gemini for personal documents |
| Any call that produces a score (#8, #9, #5, #6 while still on a model) | **one fixed model per feature**; Groq is the only one measured | none silent: a second model's number is recorded with its model and is not mixed into one scale | a different model scores the same text differently (MEASURED hint: Gemini 4 to 16 points below Groq on STAR, different temperature settings, small sample) |

Rules that hold whatever the table says: routing is decided on the server; the browser's `feature` label is untrusted, so an unknown label gets the cheapest acceptable route; personal text never goes to a provider whose terms allow training; every route is recorded in the ledger (provider, model, tokens, feature); per-provider quotas are a routing input (the Gemini 503s moved all traffic to Groq in the logs).

## 5. Cost per call, for reference (INFERRED; from measured sizes and the prices read 2026-10-13)

| Call | Groq | Haiku 4.5 | Gemini paid | Sonnet 5.5 |
|---|---|---|---|---|
| ATS parse today (1.6K in, 2K out) | $0.0014 | $0.011 | $0.013 | $0.022 |
| STAR review (670 in, 560 out) | $0.0004 | $0.0035 | not estimated | $0.007 |
| Tier 1 explanation of a code result (about 1K in, 500 out) | $0.0004 | $0.0035 | $0.003 | $0.007 |

Gemini's price doubles on 2027-01-01. Per-call figures are small; the exposure is volume and abuse (R1), not one user.

## 6. What to do and measure first (PROPOSED, synthetic data only)

1. **Accuracy of the code extraction against the model on the same CVs** (20 synthetic CVs with known fields; field-level accuracy, exact for code). This decides whether #1, #2, #3 can move, and for which CV layouts the code returns `requiresInterpretation` and a model is still needed. The shadow comparison PR-10/PR-13 in `MIGRATION_MATRIX` is the same idea.
2. The 7-day `[usage]` pull grouped by feature, to replace the ceilings with real averages.
3. Scores that stay on a model (#8, #9): run the STAR variance tool on Haiku 4.5 and on Groq with identical temperature policy.
4. Writing: blind read by the owner, Haiku vs Sonnet vs Groq, on 10 synthetic requests.
Then, and only then, a route table (section 7) and the changes to code.

### 6.1 Result of step 1, code side only (MEASURED 2026-10-13, `tests/audit/extractionAccuracy.test.js`)

12 synthetic resumes written by one author (no real data), 197 scored fields, the code extractor only; **no model was run**, so there is no comparison with a model yet.

| Result | Fields | Share |
|---|---|---|
| Correct | 167 | 85% |
| Not found (null, and flagged as needing interpretation) | 22 | 11% |
| Wrong value | 8 | 4% |
| of which wrong with confidence 0.7 or higher | 2 | 1% |

By field: email 12/12; start and end dates 18/19; skills 42/45; job titles 15/19; companies 14/19; education institution and year 7/12; phone 2/3. Honesty rule held in all 12 cases (a missing field was always reported as null with `requiresInterpretation` or confidence 0; the test asserts it).

What failed, by cause (so the gaps are specific, not a verdict):
1. **Education not found at all in 4 of 12 cases**: `B.Tech`, `BFA`, `BBA` degree lines (c04, c09, c11, c12) while `BSc` and `BA` lines were found. Likely a degree vocabulary gap (INFERRED, not yet traced in the code).
2. **Company-first layout with a dash** (`Company — Title`, c02): title and company swapped or merged, one of them with confidence 0.7.
3. **Two roles under one employer heading** (c03): company and one title not found.
4. **Phone `+44 7700 900123` came back as `+4477009001`** (c02) with confidence 0.9: a truncated number, a real bug candidate.
5. **Structure lost into one paragraph** (c10): almost everything null, honestly. This is the case where a model (Tier 1 or 3) is genuinely needed or the text should be re-flowed.
6. **Metrics**: `2M rows per day` was not counted (c04); one resume produced 2 experience entries instead of 1 (c09).

Reading: on conventional single-column layouts the code is already accurate for contact, dates and skills, and when it fails it mostly says so. It is **not yet** safe to replace the model for education, company/title in unusual layouts, or phone numbers; those are specific fixes. The 4% wrong values, 1% with high confidence, are the ones that would reach users unflagged, so they are the first thing to fix, not an acceptable error rate (no threshold has been approved). Limits: 12 cases, one author, expectations written by me (a few may be stricter than the extractor's design), English only, no real PDFs. The same cases have not been run through a model, so "better or worse than the model" is still UNKNOWN.

### 6.2 Second corpus, written after tuning on the first (MEASURED 2026-10-13)

Corpus A above was used to find and fix bugs, so its numbers (now 185 of 197 correct, 94%, none wrong with confidence 0.7 or higher) are a regression result, not a fair estimate. Corpus B (`tests/fixtures/extraction-accuracy/casesB.js`) has 12 other synthetic resumes with different layouts and wording (ALL CAPS and alternative headings, pipe and tab separators, `to date` and `Current`, a career break, a two-column text, categorised skills, wrapped bullets, accented and hyphenated names, Inc./Ltd. names, slashes and parentheses in titles, two degrees). It was written after the extractor was tuned and **was not used to change it**. One expectation of mine was wrong and was corrected before the numbers below (a US number written without a country code is `4155550132`, not `+4155550132`).

| Corpus | Fields | Correct | Not found | Wrong | Wrong with confidence 0.7 or higher |
|---|---|---|---|---|---|
| A (tuned on) | 197 | 185 (94%) | 10 | 2 | 0 |
| **B (not tuned on)** | 194 | **163 (84%)** | 14 | 17 | **8 (4%)** |

The gap between 94% and 84% is the measure of how much the first fixes were fitted to their own examples. In B: names and emails 12/12; skills 38/41; education 11/13; job titles 12/19; companies 12/19.

Failures in B, by cause (each a separate, specific fix; none applied yet):
1. **`Title | Company | dates` with pipes** (b01, b02): the whole `Title | Company` becomes the title, the company is missing or becomes `to date`; `to date` is not read as an end date.
2. **Tab-separated table rows** (b06): the header row `Role Employer Dates` is taken as the company and the real company is glued to the title.
3. **A career-break line with its own date** (b08): the next job's title line is absorbed into the break entry, which gives the next job the wrong dates and company (several fields wrong, confidence up to 0.95).
4. **Phone `+33 6 55 55 01 02`** (b02): groups of one digit are not matched, so the number is cut to `55550102` (confidence 0.75).
5. **`BE Information Engineering`** (b11): the case-sensitive `BE` was left out on purpose (it collides with the verb), so the whole education entry is dropped.
6. **`800ms to 250ms`** (b11): milliseconds are not counted as a figure.
7. **Two-column text read line by line** (b05): everything under Experience and Education is null and flagged; honest, but the resume yields almost nothing. It needs the columns re-flowed, or a model.

Reading: the extractor is accurate on conventional layouts and honest when it cannot read one (nulls with `requiresInterpretation`), but **8 of 194 fields (4%) were wrong with high confidence on layouts it had not seen**. That is the number that matters before any extraction moves from a model to code: a wrong value with high confidence reaches users unflagged. Corpus B is now a regression set; a third, fresh corpus is needed to measure again after fixing these. Still UNKNOWN: how a model does on the same 24 resumes.

## 7. How it would be built (PROPOSED, small, each step reviewed)

1. Move extraction to code behind a flag, shadow mode first: run both, log field differences (counts only), show the user the old result until the owner approves the switch.
2. A route table (`feature → tier → ordered providers, constraints`) in the server; `callWithFallback` takes the route; the ledger records it; observe mode first.
3. Remove dead calls (#18 to 21) in their own PR (D6).
4. `tests/security/aiCallSites.test.js` (added with this document) fails when a new AI call appears without being added to the design.

## 8. Decisions for the owner

| # | Decision | Recommendation |
|---|---|---|
| R1 | Adopt the four tiers as the routing rule (code first) | yes |
| R2 | Put extraction migration (#1, 2, 3) ahead of provider changes | yes: it removes the largest cost, variance and privacy exposure |
| R3 | Approve the accuracy comparison in section 6, item 1, with synthetic CVs | yes |
| R4 | Create an Anthropic account with a hard spend limit for measurement only | yes, small |
| R5 | Gemini out of first position for personal text; paid fallback for PDFs or removed | out of first position |
| R6 | Score features keep one fixed model each, fallback visible | yes |
| R7 | Remove the dead calls (#18 to 21) | yes, separate PR |
