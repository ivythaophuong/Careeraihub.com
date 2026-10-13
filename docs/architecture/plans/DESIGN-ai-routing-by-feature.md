# Design: which model serves which feature (routing by task, not one chain for everything)

Status: **DESIGN ONLY. Nothing changed in code, secrets, providers or production.** Written 2026-10-13 for the product owner. Needs owner decisions in section 8 and a measured quality check before any switch.
Labels: MEASURED (a run or log) · SOURCE (provider page read 2026-10-13) · INFERRED · UNKNOWN · PROPOSED.
Inputs: `docs/audits/R1-AI-PROXY-MITIGATION-PROPOSAL-2026-10-13.md` (the 17 feature labels), `AI-PROVIDER-DATA-TERMS-2026-10-13.md`, `STAR-VARIANCE-RESULTS-2026-10-12.md`, `supabase/functions/ai/providers.js`.

## 1. Facts that decide routing

| Fact | Evidence |
|---|---|
| Price per 1M tokens in/out: Groq gpt-oss-120b $0.15/$0.60; Gemini 3.8 Flash $0.75/$3.75 until 2026-12-31, then $1.50/$7.50 (thinking billed as output); Claude Haiku 4.5 $1/$5; Claude Sonnet 5.5 $2/$10; OpenRouter `:free` $0 | SOURCE |
| Free quotas: Groq 8K tokens/min and 200K/day for gpt-oss-120b; OpenRouter free 50 requests/day; Gemini free about 20 requests/day (third-party figure, unverified) and it ran out in the STAR measurement | SOURCE, MEASURED |
| Free Gemini content may be used to improve Google products and reviewed by people; Groq: no training, no retention by default; Claude API: no training by default | SOURCE |
| Only Gemini and Claude read PDFs; Groq and OpenRouter cannot | `SUPPORTS_PDF` in `providers.js` |
| A different model gives different scores for the same text: Gemini averaged 4 to 16 points below Groq on the same STAR stories (small sample, different temperature settings, so a hint only) | MEASURED, `STAR-VARIANCE-RESULTS` section 4 |
| Run-to-run spread on one model (Groq, STAR): standard deviation 3.3 on the overall score, up to 25 points on one section | MEASURED |
| Typical sizes measured: STAR review about 670 in / 480 out tokens; ATS parse about 1.6K in / 2K to 4K out including reasoning | MEASURED |
| Quality of any provider on our tasks (extraction accuracy, writing quality, evaluation validity) | **not measured** |
| The live chain today is Gemini (free) then Groq (free); no Anthropic, OpenRouter or OpenAI key | secrets list 2026-10-13 |

## 2. Task classes and what each needs

| Class | What it needs | Features (label) |
|---|---|---|
| A. Extraction to JSON | exact fields, schema-valid JSON, cheap, high volume, low creativity | `ats_parse`, `scan_template_parse`, `onboarding_profile`, `onboarding_pdf_extract` (PDF) |
| B. Scored judgement | **stable scale across calls and models**, JSON, no invented numbers; the number is shown to the user | `score_interview_evaluate` (`score-interview`), STAR review (`score-star`), `scan_jd_match`, `jd_analyze`, `skills_gap` |
| C. Writing the user will send or read | tone, fluency, faithfulness to the CV; quality visible to the user | `cover_letter`, `cover_letter_tone`, `salary_script`, `ats_bullet_rewrite`, `memory_plan` |
| D. Question generation | variety, relevance to the CV, short output; PDF only when no text | `mock_questions` |
| E. Conversational | short answers, latency matters, context history | `ai_coach` |
| F. Not worth an AI call | the contract says code decides | market numbers (`salary_market`, switched off), anything a deterministic function already returns |

## 3. Estimated cost per call (INFERRED from measured sizes or from the code ceilings)

| Feature | Size basis | Groq | Haiku 4.5 | Gemini paid | Sonnet 5.5 |
|---|---|---|---|---|---|
| STAR review | measured 670 in / 560 out | $0.0004 | $0.0035 | not estimated (reasoning varied 80 to 1,300 tokens) | $0.007 |
| ATS parse | measured 1.6K in / 2K out | $0.0014 | $0.011 | $0.013 | $0.022 |
| Mock evaluate | ceiling: about 3K in / 1.8K out | at most $0.0015 | at most $0.012 | at most $0.009 | at most $0.024 |
| Cover letter, salary script | ceiling 2.5K to 3K out, input unmeasured | about $0.002 | about $0.02 | about $0.012 | about $0.035 |
| AI coach reply | ceiling 600 out, history window up to the cap | under $0.001 | under $0.005 | under $0.003 | under $0.01 |

Ceilings are upper bounds from `maxTokens` and the input caps, not averages. Real averages need the usage logs grouped by feature (the 7-day pull is still outstanding). At these sizes **one user doing a full session costs cents or less on any provider**; the cost question is about volume and abuse, not about a single user.

## 4. Proposed routing (PROPOSED, nothing measured for quality)

| Class | Primary | Fallback | Why |
|---|---|---|---|
| A. Extraction, text input | Groq gpt-oss-120b (JSON schema mode) | Claude Haiku 4.5 | cheapest, good terms for personal text; JSON mode exists; extraction is easy to verify by code (the output is checked against the CV text) |
| A. Extraction with a PDF (`onboarding_pdf_extract`) | Claude Haiku 4.5 | Gemini **paid** | only PDF-capable providers; Haiku's terms do not allow training; free Gemini excluded for personal documents |
| B. Scored judgement | **one fixed model per feature, no silent model switch**: start with Groq gpt-oss-120b (the only one measured, spread known) | if it is down: tell the user, or run a second model **and record which model produced the score** | scores from different models are not on the same scale (MEASURED hint); a fallback that changes the scale must be visible in the stored row (`practice_submissions` / ledger carries provider and model) |
| B. With a PDF (`jd_analyze` with PDF) | Claude Haiku 4.5 | none | same reasons as above |
| C. Writing | Claude Haiku 4.5 as the candidate to test, Sonnet 5.5 only for the one or two features where Haiku measurably loses | Groq | writing quality is what the user sees; neither is measured; Haiku is the cost-sensible test |
| D. Questions | Groq | Haiku 4.5 | short output, cheap, text only; PDF path goes to Haiku |
| E. Coach chat | Groq | Haiku 4.5 | short, frequent, latency-sensitive |
| F. | no AI | – | the contract |

OpenRouter free: only for tests with synthetic data (50 requests a day, data handling unconfirmed). Gemini: remove from the first position for personal text; keep only as a PDF-capable fallback and only on a paid plan, or not at all.

## 5. Routing rules that must hold whatever the table says

1. **Routing is a server decision.** The browser's `feature` label is untrusted (`sanitizeFeature` checks shape only). A label can choose a model only inside the same cost class, and an unknown label gets the cheapest acceptable model, never the most expensive. Labels set by the server itself (`score-star`, `score-interview`) are trusted.
2. **A fallback must not change the meaning of a number.** For class B the stored row records provider, model and the scoring prompt version; the UI shows an AI-estimate label (already done) and the trust trigger is not fed by mixed-model scores without a decision (ADR-013).
3. **Personal text never goes to a provider whose terms allow training on it.** Enforced by the route table, not by convention.
4. **Per-provider quota is a routing input.** Spreading features across providers uses each free or paid quota separately and avoids one 429 taking everything down (observed: Gemini 503s moved all traffic to Groq).
5. **Every route is covered by the ledger** (provider, model, tokens, feature, policy version) so cost per feature is measurable (section 6).
6. **Switching a feature's model needs a before/after check** on the same synthetic inputs (the STAR variance tool is the template): same inputs, 2 to 3 candidate models, compare extraction accuracy (class A, checkable by code), score level and spread (class B), and a blind human read of outputs (class C).

## 6. What to measure before choosing (PROPOSED, small, no production change)

1. The 7-day `[usage]` pull grouped by `feature`: mean and 95th percentile of tokens, failed-attempt share, per feature. This replaces the ceilings in section 3.
2. Class A: 20 synthetic CVs with known fields; field-level accuracy and JSON validity for Groq and Haiku (code can score this exactly).
3. Class B: the STAR variance tool on Haiku 4.5 with the same 10 stories x 5 runs, same temperature policy on both sides; compare level offset and spread to Groq's 3.3. For interview answers, build the equivalent set first (none exists).
4. Class C: 10 synthetic cover-letter and salary requests, blind comparison by the owner of Haiku vs Sonnet vs Groq.
Each run uses synthetic data only, never real CVs, and the owner approves the spend (a Claude run needs a paid Anthropic account; the cost of the whole set is a few dollars at the sizes above, to be confirmed with `count_tokens` before running).

## 7. How it would be built (PROPOSED, small)

A route table in `supabase/functions/ai/providers.js` (or a new `_shared/routes.js`): feature → ordered list of `{provider, model, constraints}` plus the class; `callWithFallback` takes the route instead of the global chain; the ledger records the chosen route; the first deploy runs in observe mode (log the route it would have chosen while still using the old chain). Tests: PDF requests never reach a non-PDF provider; unknown label gets the cheapest route; class B fallback records the model; no personal-text route includes a provider flagged as training.

## 8. Decisions needed from the owner

| # | Decision | Recommendation |
|---|---|---|
| R1 | Adopt "route by task class" as the direction | yes |
| R2 | Create an Anthropic account (paid, with a spend limit) to test Haiku 4.5 | yes, for measurement only first |
| R3 | Gemini's role: out of first position for personal text; paid fallback for PDFs or removed | out of first position |
| R4 | Class B model switching policy: one fixed model per feature, with visible fallback | yes |
| R5 | Run the measurement set in section 6 (synthetic data, small spend) | yes, in order 1, 2, 3, 4 |
| R6 | Whether OpenRouter stays only as a test provider | yes |
