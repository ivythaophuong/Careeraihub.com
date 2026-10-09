# Rollout plan: put `main` live (the website currently runs `deploy/s4-on-fix-session`)

Status: **plan, nothing here has been run.** Written 2026-10-09. Evidence marked as in `CLAUDE.md`: only what was verified in source, tests, git history or the owner's pasted output; otherwise UNKNOWN.

## 1. Starting point (verified 2026-10-09)

- Live container `career-ai-hub` runs an image built from branch `deploy/s4-on-fix-session` = commit `d263eb0` (the previous live code) plus 8 commits of S4 and AI fallback. The owner swapped it on the VPS and tested STAR and mock interview on careeraihub.com.
- The previous container is kept stopped as `career-ai-hub-before-s4`; the image `career-ai-hub:before-s4` is the old live image. An older stopped container `career-ai-hub-old` also exists (unknown content, do not remove).
- `main` is 94 non-merge commits ahead of `d263eb0` (`git log d263eb0..origin/main`): ATS Builder deterministic score (hidden in the UI), document ingestion hardening, removal of two dead scan flows, consent flow UI and Employer Portal consent mode **behind `VITE_CONSENT_FLOW` (off unless set to `true`)**, `sb.update` / `sb.rpc`, plus tests and docs.
- `.dockerignore` excludes `.env.*`, and the Dockerfile has no `ARG`, so a build on the VPS cannot turn `VITE_CONSENT_FLOW` on by accident. To turn it on, the Dockerfile must pass it (a change to make at that time, not now).
- Database: no step of this rollout needs a SQL change. The consent SQL (`2026-10-09-consent-only-recruiter-access.sql`) is NOT applied and must not be applied with this rollout.
- Production data: 0 verified employers, 1 visible profile, 0 consents (measured 2026-10-09, before the rollout).

## 2. Steps (one at a time; wait for the owner's output between steps)

| # | Step | Where | Changes the live site? |
|---|---|---|---|
| 1 | Run `main` locally against the real project with `scripts/vite.dev-proxy.config.js` (flag off, the default) | owner's Mac | no |
| 2 | Click through the checklist in section 3 with the test account; report anything unexpected | owner | no |
| 3 | `npm test`, `npm run build`, `docker build` on `main` | assistant | no |
| 4 | On the VPS: tag the running image `career-ai-hub:s4-on-fix-session`; fetch `main`; `docker compose build` | VPS console | no (build only) |
| 5 | Swap: stop `career-ai-hub`, rename it `career-ai-hub-before-main` (check the name is free first), `docker compose up -d`, check `HTTP 200` | VPS console | **yes, a few seconds** |
| 6 | Repeat the checklist on careeraihub.com; look at the bundle for `consent` strings only when the flag is on (it must be off) | owner / assistant | no |
| 7 | Record the result in `docs/VERIFICATION_STATUS.md` | assistant | no |

Rollback at any point after step 5 (about 5 seconds):
`docker stop career-ai-hub; docker rm career-ai-hub; docker rename career-ai-hub-before-main career-ai-hub && docker start career-ai-hub`
(the same pattern was used for S4: the previous container is renamed, not deleted).

## 3. Checklist (test account, careeraihub.com or the local proxy run)

1. Sign up / sign in / reload the page (session refresh keeps working).
2. Resume Scan with a PDF and a DOCX: result shows, no crash. ATS Builder: upload, the deterministic score is **hidden** in the UI (product decision), the AI profile shows.
3. STAR story: refine, save, delete. Mock interview: 2 answers, finish, saved. (Server scoring, already live.)
4. TrustMatch: Discover and Matches tabs load; there is **no** "My sharing" tab and **no** "Share my profile" button (flag off).
5. Employer Portal as a user without an employer: unchanged behaviour (empty / not available).
6. Clear memory in Memory Dashboard: works; the practice score returns to 0.
7. Browser console: no red errors on those pages.

## 4. What this rollout does not do

- Does not turn on the consent flow and does not apply the consent SQL (see section 5).
- Does not change Privacy Policy wording (open item: it says providers do not train on user data; the Gemini free-tier terms say otherwise; which tier the key uses is UNKNOWN).

## 5. Where the consent flow is switched on, and what users see (for the later step)

- Switch: build-time variable `VITE_CONSENT_FLOW=true` (`src/features/TrustMatch/consent.js:15`). Read by `TrustMatch.jsx` and `EmployerPortal.jsx`. It is a build setting, so changing it needs a rebuild of the image, and the Dockerfile needs an `ARG VITE_CONSENT_FLOW` + `ENV` first.
- Candidate (TrustMatch): a tab "My sharing", a button "Share my profile with {employer}", a dialog listing what the employer will see (profile; salary range only if ticked), the expiry (90 days) and "Stop sharing". Wording: `src/features/TrustMatch/consentCopy.js` (placeholder, needs legal review).
- Employer Portal: lists candidates through `employer_view_candidates`, so it shows only candidates who consented; with no consent it shows the empty state.
- Pairing rule (plan Step 4): the flag and `2026-10-09-consent-only-recruiter-access.sql` go live in the same maintenance window, after the wording is approved, never one without the other.
