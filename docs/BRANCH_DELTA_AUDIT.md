# Branch delta audit: `integrate/reconcile` vs `main`

Final delta of the reconciliation of `main` into the hotfix line (production source `d911ed1`, tag
`pre-integration`), grouped by **functional ownership**, not by file diff:

- **A** intentionally newer or better than `main`
- **B** intentionally excluded from `main`
- **C** merged by hand because both branches changed it
- **D** unresolved, or needs a decision

Everything is read from source, tests, the built bundle, git, or a headless-Chrome check of the real
components with sample props. Nothing here was run against the signed-in app, the live database, Docker or
the live proxy; those are listed in D.

Snapshot: HEAD `6d2bc17`, `main` `cc6edbb` (26 commits that are not on this branch, all covered below).
119 files differ from `main`. Tests: 40 files, 590 cases pass. Build passes. No provider key or provider URL
in the bundle.

## Commits on top of `pre-integration`

| Commit | What |
|---|---|
| 1c67182 | Remove fabricated numbers, scores, counters and "live market data" claims; pattern-based `noFakeData` test |
| 47d244e | nginx security headers, merged ignore files, `viewport-fit=cover`; `.env.production` kept out of the Docker context |
| c876175 | `useMemory`, `supabase.js`, `resumeParser` merged |
| 027ccf5 | JD Analyzer, Cover Letter, STAR Builder, Salary negotiation: main's guarded logic in the hotfix UI |
| 0c451b4 | Salary "Market data" tab switched off (`MARKET_DATA_ENABLED = false`) until a verified source exists |
| 18e2d66 | `useDevice`, safe areas, `.grid-2`, `:focus-visible`, aria names; one phone nav |
| 1fe6c59 | MemoryDashboard null handling, "Regional Hiring Guide", ReadinessScore without invented numbers, fake password-reset message removed |
| f255d6e | `main`'s auth and landing tests carried over (landing ones rewritten), this audit |
| 6d2bc17 | Salary Prep tab bar no longer widens the page at 375px; focus ring beats inline `outline: none` |

---

## A. Intentionally newer or better than `main`

`main` does not have these, or has a weaker version. They stay.

| Item | Why it is better | Evidence |
|---|---|---|
| **`verify-cert` Edge Function** (`supabase/functions/verify-cert`) | Only fetches allowlisted certificate sites (exact host match, every redirect re-checked, time and size caps) and requires sign-in. `main` has no function for it; the app already calls it in production. | commit 34b3a4d; `handler.test.js` (22 cases); `VerifyCreds.jsx` posts to `/functions/v1/verify-cert`; the live bundle contains that path |
| Score integrity SQL and notes (`docs/database/`) | Score columns cannot be written from the browser; employers need `verified_at`. | `docs/database/README.md` (applied by hand, 2026-10-05) |
| `session.js`: expiry read from the token's own `exp` | A stale stored `expires_at` could keep an expired token alive. | `session.js` comment, `session.test.js`, `supabase.session.test.js` |
| App shell and modules `main` lacks: sidebar, Dashboard, Skills Gap, Career Roadmap, AI Coach, TrustMatch, Verify Creds, Employer Portal, Interview Coach | Newer product. | `src/features/*` |
| Resume pipeline: `resumeDigest`, `factGuard`, JD Match, ATS Builder | Condenses long CVs with a notice, code (not the model) decides keyword matches, invented figures in rewrites become `[X]`. | `resumeDigest.test.js` (13), `factGuard.test.js` (9) |
| `HiringManagerSim` writes a `mock_sessions` row | The server-side trigger computes `interview_score` from that table; `main` kept the score only in memory. | `sessionRoundTrip.test.js` (write, reload, same score) |
| `WeaknessRadar` reports only where there is evidence | `main` derived scores from `credibilityScore \|\| 50`. | `WeaknessRadar.test.jsx` |
| `salaryLevel.js` | Never assumes the candidate is Senior. | `salaryLevel.test.js` |
| `docker-compose.yml` publishes `8081:80` | `main` binds `127.0.0.1:8081`, which can stop the proxy reaching the container. See D (NPM target is UNKNOWN). | commit be2d818 |
| SEO block in `index.html` | Title, canonical, Open Graph, JSON-LD (this is what the live site serves). | live HTML matches |
| `OriginalUIOverlays` `zIndex` | `main` has the typo `zMount`. | source |
| Account type, company and signup source on registration | Hotfix feature. | `OriginalFeatures.jsx` |
| Beyond both branches: ReadinessScore, MarketIntel naming, password-reset message, pattern-based `noFakeData`, keyboard-focus and safe-area fixes, `tests/` layout, docs | Found while reconciling. | commits 1c67182, 1fe6c59, 18e2d66, 6d2bc17 |

## B. Intentionally excluded from `main`

| Item | Reason | Evidence / where tracked |
|---|---|---|
| **`BottomNav`** (`src/components/BottomNav.jsx`) | This branch already has a phone navigation (glass top bar, 5-tab bottom nav, "More" drawer) inside `AppSidebar`. Adding `main`'s as well would show two bottom bars. What was useful from `main`'s responsive work was ported instead: `useDevice` and `data-device`, safe-area handling for the existing nav, `.grid-2`, focus ring, aria names. | A test fails if anything imports `BottomNav`. In headless Chrome at 375px exactly one bottom nav is visible and "More" opens a single dialog. |
| **`.lp-*` rules of `main`'s `responsive.css`** (44 selector rules) | The landing page was redesigned here (v36) and has its own media queries. Of the 44 rules, 13 have a rule for the same selector in this branch's media queries (names compared, not values); 31 do not. They were written for `main`'s older landing, so porting them blind could change the design. | Rule-by-rule comparison, see comment at the top of `src/responsive.css`. Headless Chrome shows no horizontal overflow on the landing page at 375 / 768 / 1280px. Fine-grained layout is not verified: **OP-7**. |
| **Removal of `pdfjs-dist` from `package.json`** (`main` commit f57281e) | `main` removed it because its code did not import it. This branch's code does: `resumeParser.extractTextFromPdfFile` and `VerifyCreds` use `pdfjs-dist`, `VerifyCreds` uses `jsqr`, `ATSBuilder` and `ResumeScan` use `html2pdf.js`. Removing them breaks the build. `@supabase/supabase-js` is absent here too (custom `sb` client), so both agree on it. | `package.json` and `package-lock.json` are unchanged from the production baseline; `npm ci --dry-run` passes; the build bundles the pdf chunk. |
| **`main`'s `src/noFakeData.test.js`** | It compares exact strings, so deleting one string and keeping its sibling passes. For example it forbids `'75%'` while `main`'s landing still shipped `{ value: 75, suffix: '%' }`. Replaced by `tests/security/noFakeData.test.js`: category rules (random values, fake live counters, wait-then-result, fake scan text, live-market claims, unsourced statistics) plus a reviewed exceptions list. | Fails on the original source (6 of 6 rules, 63 lines), passes now. All 12 strings from `main`'s test are absent here (only CSS `width: 75%` remains, which is not a claim). |
| `main`'s `LandingPage.test.jsx` | It looks for `.hero`, the search card and the hero keyword check, none of which this landing page renders, so its first case passed without checking anything. Replaced by 5 cases for the page that is shown. | `src/features/Landing/LandingPage.test.jsx` |
| `docker-compose.yml` `127.0.0.1:8081:80` (from `main`) | See A. | D: NPM target |
| `.app-container` / `data-device` shell rules | Those classes do not exist in this app. | `src/responsive.css` header comment |
| Salary "Market data" tab as a data source | Switched off (not deleted); a number the model guesses is not market data. | **OP-2** |

## C. Merged by hand because both branches changed it

| File(s) | What was kept from each |
|---|---|
| `src/hooks/useMemory.js` | `main`: debounced ordered saves, flush on tab hide and unmount, no PDF in the backup, 401/403 fails closed. Hotfix: `syncError`, `syncedAt`, in-flight `resumeText`, `isRestoring` not reported as done on failure. Fixed on top: a change made while loading no longer overwrites the stored backup. 31 tests, 17 of which fail on the original hook. |
| `src/lib/supabase.js` | Hotfix: fresh token, plain-language errors, env override, `delete`. `main`: every error carries its HTTP status. |
| `src/lib/resumeParser.js` | Hotfix `extractTextFromPdfFile`; `main`'s 8192-token DOCX budget and case-insensitive extensions. |
| JD Analyzer, Cover Letter, STAR Builder, Salary negotiation tab | `main`'s logic, prompts and guards (facts only from the resume, no invented numbers, no invented score without a resume); hotfix shell, database rows (`jd_analyses`, `cover_letters`, `star_stories`), company field, Download, role context. |
| `JobSearch.jsx` | `main`'s honest version (no fabricated salary or statistics) with one wording change. |
| `MemoryDashboard.jsx`, `MarketIntel.jsx` | `main`'s null handling and disclaimer, but missing data stays missing; renamed "Regional Hiring Guide". |
| `index.html` | Hotfix SEO + `main`'s `viewport-fit=cover`. |
| `.gitignore`, `.dockerignore` | Union of both. `.env.production` is not whitelisted. |
| `nginx.conf` | `main`'s three security headers, placed inside `location /` because nginx does not inherit server-level `add_header` into a location that sets its own. (`nginx -t` NOT RUN.) |
| CSS: `index.css`, `featurePage.css`, `appTheme.css`, `responsive.css` | `main`'s `.grid-2` and focus ring (hotfix accent colour, `!important`), safe areas on the existing phone nav, only the responsive rules that apply. |
| `AppSidebar.jsx`, `App.jsx`, `CommonUI.jsx`, `TemplateSelector.jsx`, `OrbitMark.jsx` | `main`'s accessibility and fluid-width fixes on the hotfix components. |
| `App.jsx`, `EmployerPortal.jsx`, `LandingPage.jsx`, `demoHtml.js`, `ATSBuilder.jsx`, `TrustMatch.jsx` | Fabricated numbers and claims removed (group 1). |
| Tests | Every `main` test file exists here with at least as many cases; `auth.test.js` is `src/lib/supabase.auth.test.js` (its one network-error case expects the friendlier hotfix message). |

## D. Unresolved, or needs a decision

**Environment (blocks the PR and the deploy)**

| Item | Status |
|---|---|
| `docker build` and the production image (headers on `/` and on an SPA path) | **NOT RUN**: no Docker on the development machine. Must produce bundle `index-DnjfOP5R.js` as the simulated context did. |
| `nginx -t` | **NOT RUN** (runs inside the container). |
| Nginx Proxy Manager target (scheme, host, port) | **UNKNOWN.** `31.97.110.154:8081` is not reachable from outside, so `8081:80` in the compose file is not evidence that the proxy forwards correctly. |
| `.env.production`: variable names and whether each `VITE_*` value is public-safe | **UNKNOWN.** Proven: a build without the file is byte-identical to production, and the file is excluded from the Docker context. Not proven: that nothing sensitive is in it (it is tracked in git). |
| Staging | **UNKNOWN.** |
| `verify-cert` deployed in Supabase | **UNKNOWN** (`scripts/smoke-test.sh` only covers `ai` and `jobs`). |
| Signed-in app in a real browser; AI and database with real data | **NOT RUN.** The headless-Chrome result (70/70) covers the real components with sample props. |

**Decisions and verification**

| Item | Status |
|---|---|
| How to land this on `main` | A dry-run merge reports **43 conflicted files**. They conflict as text because the histories diverged, but this branch already contains `main`'s behaviour (section C), so resolving by hand file by file is the risky route. Decide at PR time between a merge commit whose tree is this branch's verified tree (parents: `main` and this branch) and a PR with manual resolution. |
| Source-backed salary data | **OP-2** (contract, sources, acceptance written down). |
| `star_stories` save, score, delete, reload under RLS | **OP-3** (P1, needs a database test). |
| Password reset | **OP-4** (button now says it is unavailable). |
| Missing value shown as 0 in `ATSBuilder`, `Dashboard`, `CareerRoadmap` | **OP-5** (P1). |
| Landing claims that cannot be checked from code (testimonials, ratings, "500+ beta users", pricing, "Readiness Certificate", blockchain-verifiable credentials, Singpass) | **OP-6**, not removed; kept apart from verified claims. |
| Landing `.lp` rules, "All tools" drawer keyboard handling, relational rows written during load, Employer Portal sample data | OP-7 to OP-10. |
| Five icons in the phone "All tools" drawer are a default circle (no icon for Radar, Readiness, Market, Memory, JD Analyzer) | Cosmetic, seen in the browser check, not yet in `OPEN_POINTS`. |

## Evidence summary

- Static scans of non-test source: `Math.random` (display), "plausible metrics", `marketMin`, "Reset link sent",
  `credibilityScore || 50`, "$155,000", "85% of successful": 0 each.
- Bundle versus the live bundle: the strings $155,000, 85% of successful, 3.2×, $18K, "Faster than industry",
  "Reset link sent", "3 Found", "Roadmap to 99%", "Add plausible metrics", `marketMin`, "Real-time salary
  benchmarks", "Live Singapore job market data" are in the live bundle and not in this one.
- Edge Functions and `scripts/` are identical to `main`, plus `verify-cert` (A).
- Browser (headless Chrome 154, 375 / 768 / 1280px): 24 of 24 screens without horizontal overflow and without
  JS errors; one bottom nav; "More" opens and closes; emulated safe areas (nav 60 to 94, top bar 52 to 99);
  keyboard focus ring on six controls; Salary Prep opens on Negotiation and Market data shows no figures.
