# Platform flow review and the "check first, sign up after" design (option B)

Status: **proposal for the owner's review, 2026-10-10. Nothing here is implemented.**
Evidence labels: **Verified** (read in source or measured), **Opinion** (the assistant's judgement), **UNKNOWN** (no data in the repository: there is no funnel or analytics data here).

## 1. The flow as it is today (Verified, from `src/App.jsx` and `src/features/Landing/LandingPage.jsx`)

1. **Landing page** (`LandingPage.jsx`): hero with a search card, feature tabs ("Try it free", "1 free use available"), pricing text.
2. A click on a tool sets `showLanding = false`. For a **guest** the next screen is the **3-step onboarding** (`App.jsx:338`, `if (!setupDone)`; the check does not look at whether the user is signed in): (1) target role, (2) industry, level, market, urgency, (3) optional resume upload, which calls the AI to extract a role, years, skills and a headline.
3. The tool opens. Any AI call needs a signed-in user: without one the call fails with 401 and the register modal opens in the middle of the task.
4. Signed-in users: the profile row is read from `profiles`; if it has a role, onboarding is skipped. The first screen is the Dashboard.
5. Recruiters (`meta.role === 'recruiter'`) go to the Employer Portal; the consent flow is off by default.
6. Navigation: 11 sidebar tools (`MODULES` in `src/styles/theme.js`) plus 7 reachable only from inside other tools.

## 2. Findings

| # | Finding | Evidence | Why it matters |
|---|---|---|---|
| F1 | A guest who clicks a tool meets a 3-step form **before seeing any value**, and before being asked to sign up | `App.jsx:334-338` order of checks | The first minute asks for effort and gives nothing back |
| F2 | "Urgency" is collected and saved but **no tool reads it**; the screen says "we calibrate salaries, keywords and urgency to your situation" | grep of `form.urgency`: only `App.jsx` | A promise the product does not keep |
| F3 | Onboarding answers feed the **practice tools** (role: 6 tools, market: 5, level: 4, industry: 4) but **not** the recruiter-facing profile (`candidate_trust_profiles` is written only from TrustMatch's own form) | grep of `form.*`; `TrustMatch.jsx:59` | They add value to coaching, none to the candidate profile employers see |
| F4 | **Pricing and free-use claims have no implementation.** The landing page says "See exactly what you unlock at $19/month", "Free users get 1-2 uses", "1 free use available"; the Terms (section 4) describe monthly billing of $19 and $24.99. The code has no payment, subscription or usage-limit logic; `proModal` is set but never shown | grep for stripe/paddle/subscription/free-use: nothing outside landing text and demo data | Terms and ads describing billing that does not exist are a trust and legal risk. Owner to decide: build it, or relabel as "free during beta" |
| F5 | Two resume tools give two different "ATS" numbers: ATS Scanner shows a **model-made job match**, ATS Builder shows a **rule-based readiness** | `ResumeScan.jsx` (`matchScore`), `ATSBuilder.jsx` (`computeDeterministicScore`) | Users cannot tell which "ATS" number to trust (the deferred Resume Scan decision) |
| F6 | The resume is read **three different ways** (onboarding AI extraction, Resume Scan template parse by AI, ATS Builder AI parse plus rules) | `App.jsx` onboarding, `ResumeScan.jsx` `parseForTemplate`, `ATSBuilder.jsx` `parseResume` | Results can disagree; "one parse per content hash" is a TARGET in `AI_ARCHITECTURE_CONTRACT.md`, not built |
| F7 | A new account's TrustMatch score shows 0 / 0 / 0 because nothing writes `resume_scans` (finding F-12) | measured in the owner's test | The first TrustMatch view is discouraging and looks broken |
| F8 | 18 tools, no single guided path. The Dashboard lists next actions, but the sidebar offers all tools at once | `MODULES`; `Dashboard.jsx` next-action list | Opinion: new users need one next step, not eleven |
| F9 | The AI-quota failures seen in testing (Gemini 429, Groq 429) would hit real users first at the moment they ask for AI help | function logs, 2026-10-09 | Needs a paid tier or a paid fallback before real users (separate item) |

## 3. Recommended journey (Opinion)

One core loop, shown in this order, with everything else behind it:

**Check my CV** (instant, no account) -> **See my ATS Readiness and what the reader found** -> **Create a free account to save it and let AI explain what to fix** -> **Fix** -> **Match it to a real job** -> **Practise the interview for that job** -> **Apply / share with employers (consent)**.

- Ask only what a tool actually uses, **at the moment it is needed**, pre-filled from the CV where the CV can answer.
- Keep the AI behind the sign-up (it costs money and needs an identity). Keep the rule-based score free and instant: it costs nothing to run.
- Name the two resume numbers differently: **ATS Readiness** (the resume on its own, rules) and **Job Match** (the resume against one job, model-assisted until it is replaced).

## 4. Option B: "check first, sign up after"

### 4.1 What the user sees
1. Landing: the main button is **"Check my resume - free, no account"** (the old "Try it free" buttons that lead to the onboarding form are replaced or kept as secondary).
2. A single page: drop a PDF/DOCX or paste text. The file is read **in the browser** (pdfjs / mammoth, as today). No upload, no AI call, nothing saved.
3. Result at once: **ATS Readiness** with its three parts, the evidence, "Sections we recognised", "See the text we read" (all already built in ATS Builder).
4. Below the result, one call to action: **"Create a free account to save this and let AI show what to fix"**. The register modal opens **on the same page**; the CV text stays in memory only for this page session and is carried into the new account **only after the user signs up** (consent by action, stated in one line).
5. After sign-up: **one confirmation screen**, pre-filled: target role (latest job title found in the CV), level (estimated from the dates found), market (ask). Industry and "urgency" are not asked. Then the Dashboard with **one primary card: "Find issues with AI"**.

### 4.2 What gets built (each step shippable alone)
| Step | Work | Notes |
|---|---|---|
| B1 | Extract the score card from `UploadAndParseTab` into a shared component; new route `?tab=check` that uses it for guests | Test: with no account and no network the page still shows a score (no `fetch`) |
| B2 | Landing CTA and routing; the onboarding wall is no longer shown to guests | Guard: a guest who opens an AI tool is asked to sign up, not to fill a form |
| B3 | Carry the CV from the guest page into the account after sign-up | In memory only; if the page is closed the text is gone; no storage without an account |
| B4 | One-screen onboarding pre-filled from the CV; remove "urgency" (or use it); fix the screen copy to match what is really used | Uses deterministic extraction (title, dates), not the AI |
| B5 | Events for the funnel (see 4.3) | Behind the existing analytics consent banner |
| B6 | Landing claims: remove or relabel the unimplemented pricing and "1 free use" lines (F4) | Owner decision first |

### 4.3 How to know it worked (UNKNOWN today: no funnel data exists)
Events: `cta_check_click`, `check_started`, `check_completed` (score band only), `signup_started`, `signup_completed`, `onboarding_completed`, `first_ai_action`, `return_day_7`. Compare, on a 50/50 split of the landing button, the share of visitors who reach `signup_completed` and `first_ai_action`. Decide after enough visits to see a real difference; the assistant cannot give a number of visits needed without a baseline.

### 4.4 Risks and limits
- It may not raise sign-ups: some visitors take the score and leave. That costs almost nothing (the check runs in the browser), but it is not a win by itself. Only the measurement above can say.
- The first score must be right for the CVs people actually have: English and Vietnamese headings and dates are now read, a real English CV's "WORKING EXPERIENCE" heading was missed until 2026-10-10. A wrong first impression is worse than no check. Gate: test the check on a set of real, anonymised CVs (kept outside the repo) before the landing button changes.
- Do not claim "your CV never leaves your device" unless the page is tested to make no network call carrying the text (B1 test).
- Privacy Policy and the cookie banner must describe the guest check before launch.

## 5. Order of work (Opinion)
1. **Now (small):** fix F2 (remove the false "urgency" promise or use it); decide F4 (pricing copy).
2. **Next:** B1-B3 behind a flag, then B4-B5; A/B test on the landing button.
3. **Later, separate decisions:** one resume parse for every tool (F6), Job Match without a model-made number (F5), a writer for the resume score so TrustMatch is not 0 (F7, `score-resume`, security gate in the acceptance plan), AI provider billing (F9).

## 6. Decisions needed from the owner
1. Pricing copy (F4): relabel as "free during beta", or build billing first?
2. Is "check my resume without an account" acceptable for the brand and the Privacy Policy?
3. Which single number should a new user see first: ATS Readiness (rules), as proposed?
4. Keep "urgency"? If yes, what should it change (suggestion: the length of the roadmap)?
5. Who reviews the check on real CVs before the landing button changes?

## 7. Review of 2026-10-10 and what changed in this proposal

An outside review agreed with the direction (check first, sign up after) and asked for three changes, which the assistant checked and accepted:

1. **Pricing and usage promises are P0**, ahead of the new flow. Recommendation kept: if billing is not in the next release, make the landing page, Terms (section 4), pricing text and any modal say what is true in the beta; do not build billing only to keep an advertised price.
2. **A reader quality gate comes before the public check.** See `READER-QUALITY-GATE.md`: a pre-registered gate, a local evaluation tool (built), and a first observation on four public templates that already shows missed experience sections on table and icon layouts. The landing button does not change until the gate passes.
3. **Two decisions were bundled and are now separate**: (a) letting people check a CV before signing up; (b) showing the ATS Readiness number at once. (a) is proposed now; (b) waits for the gate. Correction to the review's premise: the score is already shown in the ATS Builder (decision of 2026-10-10 reversed the earlier decision to hide it); what is new is showing it to visitors without an account.

Also adopted: onboarding values inferred from the CV (role, level) are shown as suggestions to confirm, never stored as facts; "partial" results are labelled (done in the ATS Builder on 2026-10-10); one parser and one score pipeline remain the direction, migrated one flow at a time with the old behaviour kept until the new one is tested; server-side writing of the resume score and the TrustMatch fix stay a separate, security-reviewed item.

Revised order: P0 pricing copy; P0 reader gate; then B2 and B3 (result and sign-up after, with the carry-over tests); then B4 and B5; then the A/B test with a pre-registered metric; later the parser merge, Job Match and the server-side score writer.
