# Verification status

One-page control board. ✅ verified in source or tests · ⚠️ partial · 🔴 gap or not proven · ❔ unknown.
"Verified" = read in code. Rows marked † were re-read against `origin/main` at `09cccab` on 2026-10-14; the other rows were not re-read then and still describe branch `hotfix/server-side-ai`. Nothing here was run against production.

| Area | Status | Evidence | Risk |
|---|---|---|---|
| AI provider key kept off the browser | ✅ | `ai/handler.js`, `tests/security/noSecretsInClient.test.js`; commit 60a2ef6 | Low |
| Old provider keys were exposed in the served bundle | ⚠️ rotation not provable from repo | `docs/DEPLOY_AND_ROTATE_KEYS.md` | High until the checklist is confirmed done |
| `ai` rejects anonymous / anon-key callers | ✅ | `authenticate()` in `ai/handler.js`; `handler.test.js` | Low |
| AI rate limit | ⚠️ per function instance only | `createRateLimiter`, README of `ai` | Medium |
| Provider failover † | ✅ `callWithFallback` tries `AI_PROVIDER`, then `AI_FALLBACKS` or every keyed provider; 90 s total budget; not for score features. Which keys exist in production: ❔ | `supabase/functions/ai/providers.js`, `fallback.test.js` | Medium (an unkeyed or free-tier provider in the chain receives the text: check `AI_FALLBACKS`) |
| A score feature does not fall back to another model † | ✅ `NO_SILENT_FALLBACK`: `score_star_review`, `score_interview_evaluate`, `scan_jd_match`, `jd_analyze`, `memory_plan` (MEASURED 2026-10-14: the same answer scored 12, 22 and 32 from three models) | `providers.js`, `fallback.test.js` | Low |
| Output limit leaves room for a thinking model † | ✅ OpenAI and Anthropic requests carry twice the feature's limit (4096 to 16000); the provider bills tokens used | `withThinkingRoom` in `providers.js`, `fallback.test.js` | Low |
| Blanks and exporting † | ✅ any short [bracketed] blank is recognised (`findBlanks`), noted on the card, and exporting asks once | `factGuard.js`, `exportGuard.js`, their tests | Low |
| Client AI retry | ✅ 1 retry on 429/5xx/timeout | `ai.jsx`, `ai.test.js` | Low |
| PDF/DOCX extraction | ✅ source / 🔴 no test file for `resumeParser.js` | `resumeParser.js` | Low–Medium |
| Resume digest and truncation notice | ✅ | `resumeDigest.test.js` | Low |
| Keyword match decided by code | ✅ | `checkKeywords` + tests | Low |
| Invented numbers in AI rewrites † | ⚠️ checked in every AI text module: `factGuard` (ATS Builder fixes, Resume Scan), `numberGuard` (Cover Letter, STAR, Salary, interview). What each module shows on a hit: ❔ not re-read | `factGuard.js`, `numberGuard.js`, `findUnsupportedNumbers` call sites | Medium |
| Resume reader on common layouts | ⚠️ synthetic layouts only | `experience.test.js`, `dates.test.js`, `readerParity.test.js`: glyph and plain bullets, wrapped bullets, `Title, Company` / `Company, Title` / `Title \| Company` headers, dates with a dash or `to`/`until`. **Not handled:** two-column and sidebar resumes (name is missed: `it.fails` in `nameDetection.test.js`), tables, icon headers. Word/Google Docs PDFs untested. Checked on 3 real CV-like files in one person's Downloads (structure only, before/after): bullets per job fell where wrapped lines are now merged (e.g. 20 → 12), one header line per job boundary moved out of the previous job, scores rose 5-6 points; 2 of 3 still miss the name and 1 of 3 finds no jobs (not changed by this work). 13 of 124 PDF/DOCX files gave no text. | Medium: 3 files is not a quality gate; real resumes differ from the synthetic layouts |
| Semantic inflation (ownership, scope, duties, links, places, skills) † | ⚠️ warning only, never blocking: issues panel, Fix page, Builder draft and Resume Scan (not STAR, Cover Letter, Interview, Salary). Rules: role level, scope words, new names, result claims, new content words, invented LinkedIn handle / place, new skills; with the model's `evidence` / `unsupported` (not in Resume Scan): quote not in the resume, declared additions, undeclared additions. The button reads "… — I confirm this is true" (one click) | `claimGuard.js` + `claimGuard.test.js`, `BuilderIssuesPanel.test.jsx`, `ResumeScan.claims.test.jsx` | High elsewhere; in the screens that have it the check is by words and form and misses some claims |
| AI JSON schema validation | 🔴 only `extractJSON` | `ai.jsx` | Medium |
| Silent failure when AI JSON is unparsable in JD Match † | 🔴 no error shown (`if (!parsed.error) {…}` with no else) | `ResumeScan.jsx` L253 | Medium |
| Score integrity (trust/ats/interview/star columns) | ✅ locked by DB trigger/policy per docs | `docs/database/README.md` | Low |
| Score integrity on input tables | 🔴 browser-trusted | same README, "Known gap" | High |
| Employer access to candidates | ⚠️ verified employers only, per hand-applied SQL | `docs/database/…sql`; RLS itself ❔ | Medium |
| Employer sample data | ⚠️ hard-coded threads in `EmployerPortal.jsx` (L22), disclosed by a "Preview … sample data" banner (~L893) | source | High if shown to real users |
| `verify-cert` SSRF protection | ✅ host allowlist, redirect re-check, size/time caps | `verify-cert/handler.js`, `handler.test.js` (22) | Low |
| Database reproducibility | 🔴 no migrations; one script applied by hand | `docs/database/README.md` | High |
| RLS policies in repo | 🔴 not in repo | | High |
| Observability † | ⚠️ one `[usage]` JSON line per provider attempt with `correlation_id`, `provider`, `fallback`, `outcome`; error responses carry `requestId`; `scripts/usage-report.mjs`. No alert, runbook or SLO found in the repo (❔ outside it) | `ai/handler.js`, `_shared/usage.js`, `ai/README.md` | Medium–High |
| AI cost tracking † | ⚠️ tokens and time are logged per attempt; cost needs `PRICE_TABLE`, which is empty on purpose, so `cost_status` is `price_unknown` | `_shared/usage.js`, `ai/README.md` | Medium |
| AI quality evaluation (golden data, real model) | 🔴 not in the repo: tests use mocks / fixed strings. One-off measurements with real models (read by hand and counted by the product's guards, invented data only) were made on 2026-10-14 outside the repo, with scripts that are not in it | tests | High |
| Persistence of failed saves | ✅ shown to user | `useMemory.syncError`, `App.jsx` toast, `useMemory.test.js` (15) | Low |
| Boot read failure cannot wipe memory | ✅ `critical` fetch keeps writes locked | `useMemory.js` | Low |
| Session refresh | ✅ | `session.js`, `session.test.js`, `supabase.session.test.js` | Low |
| Real-network test † | ✅ `tests/integration/auth.test.js` signs real accounts up on the production project, so its network tests run only with `RUN_LIVE_TESTS=1`; `tests/security/liveTestsAreOptIn.test.js` fails if a file there touches the network without that opt-in. Accounts created before 2026-10-14 are not removed | `tests/integration/auth.test.js`, `tests/security/liveTestsAreOptIn.test.js`, `tests/README.md` | Low |
| Docs match code | 🔴 `docs/archive/BACKEND_IMPLEMENTATION.md` describes an Express API that does not exist; older README described keys in the JSX | files | Low |
| Deployment | ⚠️ Docker + compose present; VPS/NPM state ❔ | `Dockerfile`, `docker-compose.yml` | Medium |
