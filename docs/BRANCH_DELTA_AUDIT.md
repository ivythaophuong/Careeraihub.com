# Branch delta audit: `integrate/reconcile` vs `main`

Final static audit of the reconciliation of `main` into the hotfix line (production source `d911ed1`,
tag `pre-integration`). Everything here was read from source, tests, the built bundle or git. Items that
need a browser, Docker or the live system are listed as NOT RUN at the end.

## Commits on top of `pre-integration`

| Commit | Group | What |
|---|---|---|
| 1c67182 | 1 | Remove fabricated numbers, scores, counters and "live market data" claims; pattern-based `noFakeData` test |
| 47d244e | 2 | nginx security headers (inside `location /`), merged ignore files, `viewport-fit=cover`; `.env.production` kept out of the Docker context |
| c876175 | 3 | `useMemory`, `supabase.js`, `resumeParser` merged (debounced ordered saves, no PDF in the backup, 401/403 fail closed, boot-overwrite fixed) |
| 027ccf5 | 4 | JD Analyzer, Cover Letter, STAR Builder, Salary negotiation: main's guarded logic in the hotfix UI, hotfix DB rows kept |
| 0c451b4 | 4 | Salary "Market data" tab switched off (`MARKET_DATA_ENABLED = false`) until a verified source exists |
| 18e2d66 | 5 | `useDevice`, safe areas, `.grid-2`, `:focus-visible`, aria names; one mobile nav only |
| 1fe6c59 | 6 | MemoryDashboard null handling, MarketIntel renamed "Regional Hiring Guide", ReadinessScore without invented numbers, fake password-reset message removed |

## What `main` has that this branch intentionally does not

| Item | Why |
|---|---|
| `src/components/BottomNav.jsx` | The hotfix mobile navigation is kept; a second bottom bar would duplicate it |
| `.lp ...` landing rules of `responsive.css` | The landing page was redesigned here; port only after a viewport check (OP-7) |
| `package.json` dependency removals (`pdfjs-dist`, `@supabase/supabase-js`) | Code on this branch still imports `pdfjs-dist`, `jsqr`, `html2pdf.js` |
| `docker-compose.yml` `127.0.0.1:8081` | Could stop the proxy reaching the container (commit be2d818); NPM target is UNKNOWN |
| `src/noFakeData.test.js` | Replaced by `tests/security/noFakeData.test.js` (category rules, fails on the original source) |
| `main`'s `LandingPage.test.jsx` | Targeted DOM that this landing page does not render; replaced with tests for the page shown |

Everything else `main` has is present: all 26 commits' behaviour is covered, the Edge Functions and
`scripts/` are byte-identical to `main` (this branch adds `verify-cert`), and every `main` test file exists here
with at least as many cases (`auth.test.js` as `src/lib/supabase.auth.test.js`; its one network-error case now
expects the friendlier message the hotfix shows).

## Evidence

- Static scans of non-test source: `Math.random` (display), "plausible metrics", `marketMin`,
  "Reset link sent", `credibilityScore || 50`, "$155,000", "85% of successful": 0 each.
- Tracked files that look sensitive: `.env.example` (names only) and `.env.production`
  (content not inspected; a build without it is byte-identical to production).
- Bundle: no provider key or provider URL; the strings below are gone compared with the live bundle:
  $155,000, 85% of successful, 3.2×, $18K, Faster than industry, Reset link sent, 3 Found, Roadmap to 99%,
  Add plausible metrics, marketMin, Real-time salary benchmarks, Live Singapore job market data.
- Tests: 40 files, 590 cases pass. Build passes.

## NOT RUN (needs the user's environment)

Browser check at 375 / 768 / 1280 px; `nginx -t`; `docker build`; `curl -I` for the headers after deploy;
`scripts/smoke-test.sh`; database checks (trigger scores, `star_stories` delete under RLS, OP-3);
the NPM proxy target (UNKNOWN); the content of `.env.production` (UNKNOWN).
