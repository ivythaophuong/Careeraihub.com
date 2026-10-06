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
