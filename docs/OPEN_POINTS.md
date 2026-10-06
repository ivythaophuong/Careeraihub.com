# Open Points — CareerAiHub

## OP-1: Post-onboarding LLM insight (Dashboard)

**What's missing:**
After the user completes onboarding (role + market + urgency + resume upload), the app extracts a profile from the resume but never synthesizes it with the user's goals.

**What should happen:**
A single LLM call after "Get started" that receives:
- `resumeText` (uploaded CV)
- `form.role` (target role, e.g. "Senior PM")
- `form.market` (e.g. "Singapore")
- `form.industry` (e.g. "Fintech")
- `form.urgency` (e.g. "1 month")

And returns a personalized dashboard insight, e.g.:
> "You have 4 years PM experience but are missing SQL and data skills expected for Senior PM roles in Singapore fintech. Given your 1-month timeline, prioritize the ATS scan against a real JD, then build 3 STAR stories around product metrics."

**Where to show it:**
- `ReadinessArc` component — the `aiInsight` prop is already wired, currently just a placeholder string
- Could also populate `actionItems` with LLM-prioritized steps instead of hardcoded threshold logic

**Implementation notes:**
- Call happens in `App.jsx` "Get started" handler alongside `resumeProfile` extraction (one combined LLM call or second parallel call)
- Response stored in `resumeProfile.insight` or separate state `dashboardInsight`
- Persist to `localStorage` (same pattern as `resumeProfile`)
- If call fails, fall back to current hardcoded insight strings — no regression

## OP-2: Source-backed salary market data (Salary Coach "Market data" tab)

**Status:** the tab is switched off (`MARKET_DATA_ENABLED = false` in `src/features/SalaryCoach/salaryLevel.js`) and shows "temporarily unavailable". The old version asked the model to guess salary ranges, which is not market data even when labelled as an estimate.

**What should happen:** a server-side function returns verified data and the model only explains it.

```
verified data -> server-side calculation -> AI explanation
```

Never: job description -> model -> "marketMin = 75,000".

**Contract (`SalaryMarketData`):** role, market, currency, period, source, sourceType, sampleSize, methodology, p25, median, p75, retrievedAt. Hide the result when the sample is too small.

**Candidate sources, easiest first:** the Adzuna salary statistics for the markets already used by the `jobs` function (advertised pay, not actual pay: say so and show the number of ads); official wage statistics (for Singapore, the Ministry of Manpower occupational wage tables; BLS in the US; ONS in the UK). Sites without a public API (Glassdoor, Levels.fyi, Payscale, LinkedIn) should not be scraped.

**Acceptance:** every figure shows source, period and sample size; no figure is produced by the model; a test fails if a model prompt asks for market figures.

## OP-3 (P1, verification): `star_stories` save, score, delete and reload

Needs a database-level integration test, not a UI change. Expected flow:

1. user saves a STAR story: a `star_stories` row exists;
2. the trigger-calculated score exists;
3. user deletes the story: the row is deleted (**row-level security for DELETE on `star_stories` is UNKNOWN**; PostgREST returns success with 0 rows when a policy blocks it);
4. the score is removed or no longer visible;
5. after a reload the story does not reappear.

Until this is proven, do not work around it in the UI.

