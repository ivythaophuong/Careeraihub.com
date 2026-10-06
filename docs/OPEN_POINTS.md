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


## Backlog from the main/hotfix reconciliation (not fixed there on purpose)

Each item was seen while reconciling and left alone to keep the groups small. Order is a suggestion.

- **OP-4 (P1) Password reset:** the "Forgot your password?" button now says reset is not available, because the old text claimed a link was sent when nothing happened. A real flow needs Supabase's recover endpoint, handling of the recovery link when the app opens, and a new-password form.
- **OP-5 (P1) Missing data shown as 0:** `ATSBuilder` stores `atsScore ?? 0` as the scan's credibility score; `Dashboard` and `CareerRoadmap` use `mockSessions[0]?.avgScore ?? 0` as readiness. A missing score should show as "no data yet", never as 0.
- **OP-6 Verify claims in `LandingPage`:** testimonials with star ratings, "500+ beta users", "4.8★/4.9★", pricing, "Readiness Certificate", "blockchain-verifiable credentials", Singpass. Not removed because they cannot be checked from the code; each needs evidence or removal. `HeroSection`, `SearchCard` and `TickerBar` are unreachable code and can be deleted.
- **OP-7 Landing responsive rules from `main` (`.lp ...`):** about 25 rules were not ported (see `src/responsive.css`). Check the landing page at 375 / 768 / 1280 px and port only what is still needed.
- **OP-8 Mobile "All tools" drawer:** no Escape key or focus handling yet (it is now marked as a dialog).
- **OP-9 `useMemory`:** relational rows written while the stored memory is still loading are dropped (only the JSON backup is saved afterwards).
- **OP-10 EmployerPortal sample data:** candidate threads, names and KPIs are sample data shown under a "Preview" banner; replace with real data or remove.
- **OP-11 `star_stories` delete:** see OP-3.
