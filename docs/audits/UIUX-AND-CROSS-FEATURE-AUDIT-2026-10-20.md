# UI/UX and cross-feature audit (production code at ad82f00)

Written 2026-10-20 for the product owner. Method: the app of `origin/main` (ad82f00, what production serves) was run locally in a real Chromium with the Supabase auth, tables and Edge Functions **faked**, and driven through every screen at desktop (1440x900) and phone (390x844) width, with an empty account and a populated one. Accessibility was measured with axe-core. Data flows and every call-to-action were followed. The public landing page was opened on production. Counts come from read-only queries on 2026-10-20.
Labels: VERIFIED (measured or seen in this run) · FROM SOURCE (read in the code, not run) · UNKNOWN.

## 1. What was and was not tested

| Tested | Not tested |
|---|---|
| 66 screen states (26 screens x empty and populated account at desktop, 24 at phone width): console errors, sideways overflow, axe rules, screenshots | The real database, row level security, the real AI, the real sign-in (CAPTCHA), sign-up and forgot-password, the first-run onboarding after a real sign-up |
| Data flowing between features (resume, practice sessions, STAR stories, trust profile) and back after a whole mock interview | A real microphone, real accents, a real phone, Safari and Firefox |
| Where 43 buttons lead on six screens; a static check that every navigation target names an existing screen (`tests/contracts/navigationTargets.test.js`) | Slow or failing networks, long-running sessions, the light theme beyond the dashboard |

Re-run: `tests/e2e-local/README.md`.

## 2. How it is (what works)

- No console error and no page error on any of the 66 states. No sideways overflow at 390 px. No cluster of tiny tap targets on phone. One consistent sidebar and a bottom bar on phone. The light theme works.
- **Data is linked.** A populated account showed the same practice figure (64) on the Dashboard, the Career Roadmap and the Interview Coach overview; STAR stories (3) on the Dashboard, the overview, the roadmap and the STAR Bank; the stored practice score (61) on TrustMatch. After a whole mock interview (five answers) the grader was called five times, the session was saved once, the account memory was written, and the overview and Dashboard updated **without a reload**. 16 of 17 flow checks passed; the one failure is finding F-2 below.
- Every navigation target in the source names a screen that exists (static contract test, 8 checks, broken target caught when injected).
- Honest labels exist ("AI estimate, not verified evidence", "Rule-based check", empty states with a next step).

## 3. Findings, most serious first

| # | Severity | Finding | Evidence | Suggested change |
|---|---|---|---|---|
| F-1 | **P0 trust** | The landing page states figures production cannot support: "2,714+ Verified Profiles", "50+ Hiring Partners", "95% ATS Match Rate", "4.9 User Rating", "9 Days Avg. to Shortlist", "SGD 4-12k Salary Uplift", "Singapore's verified career platform", and a hero mock with "Top 8% verified profiles" (small label "Example"). | Production on 2026-10-20: 54 accounts, 8 trust profiles (1 visible), 1 employer (0 verified), 3 open jobs, 10 mock sessions, 5 resume scans. | Remove or replace with true, dated figures, or label them clearly as illustrative. Legal review of "verified". Do not claim "verified" before an employer is verified (ADR-013). |
| F-2 | **P1 data link** | A resume **pasted as plain text** was invisible to the Mock Interview, JD Analyzer, Cover Letter and Salary Prep (they said "no resume was provided") while the ATS Scanner saw it. | `pickResumeSource` read only the `{content}` shape; `resumeText` also legitimately holds a string. Reproduced; fixed on branch `fix/resume-pasted-string`. | Merge the fix. |
| F-3 | **P1 accessibility** | The four "Priority actions" on the Dashboard are clickable `div`s without a role or tab stop: 0 of 4 reached by Tab in 60 presses. | Browser run. | Make them buttons or links. |
| F-4 | P1 accessibility | Low colour contrast on every screen (axe "serious": 21 to 48 elements per screen, also in the light theme): muted grey on navy, small amber and pink text. | axe-core on 66 states. | Raise the muted text colour and the smallest text sizes in the theme. |
| F-5 | P1 accessibility | No screen has an `h1` (24 desktop screens measured). Job Search has two selects with no name (axe "critical"). One label-and-name mismatch on every screen. | Browser run. | One `h1` per screen; name the selects. |
| F-6 | P1 layout | On desktop the Live Session (practice) screen has no page padding: the content touches the sidebar and the right edge of the window. | Screenshot, focus mode. | Give the practice screen the same page padding as the other screens (a centred container). |
| F-7 | P2 phone | On a phone the Dashboard shows a "Light / command-K" row under the app bar. The keyboard shortcut means nothing on a phone and the row stacks a second bar. | Phone screenshot. | Hide the desktop top bar below 768 px, keep the theme toggle somewhere else. |
| F-8 | P2 flow | "Start session", "Start drill", "Continue prep" (Dashboard) and "Start session", "Practise" (Roadmap) land on the Interview Coach **Overview**, a statistics page, not on practice. | Link map. | Open the Live Session directly from a "start" button. |
| F-9 | P2 flow | The same feature is reached two ways with different chrome: Roadmap "Add STAR stories" opens the standalone STAR module (no sub-navigation), the overview's opens the STAR Bank part. | Link map. | One route to one screen. |
| F-10 | P2 content | "Study Modules" and "Live Session" are the same screen. The landing page shows a Study Modules mock with progress numbers and "Premium locked" that the app does not have. | Source and screenshots. | Decide the owner's option (remove, library, or full plan). |
| F-11 | P2 wording | Three names for score-like figures: "Trust Score" (Verify Creds, 0/100), "Practice score" (TrustMatch, Roadmap), "Readiness". Different numbers for each. TrustMatch is labelled "Planned" in the sidebar yet looks like a live marketplace; Verify Creds is "In dev". | Screenshots. | One name per figure (ADR-013), and the page should match its badge. |
| F-12 | P2 consistency | Primary buttons come in three styles (flat pink, pink to orange gradient, persona colour to blue gradient). | Screenshots and `Btn` in `CommonUI.jsx`. | One primary style from the theme. |
| F-13 | P2 density | The Dashboard first screen holds about ten blocks, and two say different things about the CV ("Resume uploaded, paste a JD" next to "your CV has not been checked yet"). | Screenshot. | One main message and one main action per screen. |
| F-14 | P3 | The command palette (command-K) has no keyboard navigation (no arrows, no Enter on a result) and no dialog role. | FROM SOURCE (`OriginalFeatures.jsx`). | Add them. |
| F-15 | P3 | The footer floats mid-page on short screens. | Screenshots. | Keep it at the bottom. |
| F-16 | P3 performance | One main script of 1.57 MB (443 KB compressed) is loaded for every visitor. | Production bundle. | Split by screen. |

## 4. Not verified, and what would settle it

- Everything under "Not tested" above. The staging environment described in the session (a separate Supabase project) would let the same scripts run against a real database and real functions.
- Whether real users find the screens clear: no usage research exists. Five short sessions with real users would say more than any audit.
