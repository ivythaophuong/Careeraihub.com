# Verification status

One-page control board. ✅ verified in source or tests · ⚠️ partial · 🔴 gap or not proven · ❔ unknown.
"Verified" = read in code on branch `hotfix/server-side-ai`; nothing here was run against production.

| Area | Status | Evidence | Risk |
|---|---|---|---|
| AI provider key kept off the browser | ✅ | `ai/handler.js`, `tests/security/noSecretsInClient.test.js`; commit 60a2ef6 | Low |
| Old provider keys were exposed in the served bundle | ⚠️ rotation not provable from repo | `docs/DEPLOY_AND_ROTATE_KEYS.md` | High until the checklist is confirmed done |
| `ai` rejects anonymous / anon-key callers | ✅ | `authenticate()` in `ai/handler.js`; `handler.test.js` | Low |
| AI rate limit | ⚠️ per function instance only | `createRateLimiter`, README of `ai` | Medium |
| Provider failover | 🔴 none: one provider per request | `handler.js` single `callProvider` | Medium |
| Client AI retry | ✅ 1 retry on 429/5xx/timeout | `ai.jsx`, `ai.test.js` | Low |
| PDF/DOCX extraction | ✅ source / 🔴 no test file for `resumeParser.js` | `resumeParser.js` | Low–Medium |
| Resume digest and truncation notice | ✅ | `resumeDigest.test.js` | Low |
| Keyword match decided by code | ✅ | `checkKeywords` + tests | Low |
| Invented numbers in AI rewrites | ⚠️ only where the guard is imported (ATS fixes, interview) | `factGuard.js`, `numberGuard.js` | High elsewhere (STAR, Salary, Cover Letter, ATS Builder: no import found) |
| Semantic inflation (ownership, scope) | 🔴 | stated in `numberGuard`/`factGuard` header comments | High |
| AI JSON schema validation | 🔴 only `extractJSON` | `ai.jsx` | Medium |
| Silent failure when AI JSON is unparsable in JD Match | 🔴 no error shown (`if (!parsed.error) {…}` with no else) | `ResumeScan.jsx` ~L482 | Medium |
| Score integrity (trust/ats/interview/star columns) | ✅ locked by DB trigger/policy per docs | `docs/database/README.md` | Low |
| Score integrity on input tables | 🔴 browser-trusted | same README, "Known gap" | High |
| Employer access to candidates | ⚠️ verified employers only, per hand-applied SQL | `docs/database/…sql`; RLS itself ❔ | Medium |
| Employer sample data | ⚠️ hard-coded threads in `EmployerPortal.jsx` (L22), disclosed by a "Preview … sample data" banner (~L893) | source | High if shown to real users |
| `verify-cert` SSRF protection | ✅ host allowlist, redirect re-check, size/time caps | `verify-cert/handler.js`, `handler.test.js` (22) | Low |
| Database reproducibility | 🔴 no migrations; one script applied by hand | `docs/database/README.md` | High |
| RLS policies in repo | 🔴 not in repo | | High |
| Observability | 🔴 only `console.error` on server faults | `ai/handler.js` | High |
| AI cost tracking | 🔴 | | High |
| AI quality evaluation (golden data, real model) | 🔴 | tests use mocks / fixed strings | High |
| Persistence of failed saves | ✅ shown to user | `useMemory.syncError`, `App.jsx` toast, `useMemory.test.js` (15) | Low |
| Boot read failure cannot wipe memory | ✅ `critical` fetch keeps writes locked | `useMemory.js` | Low |
| Session refresh | ✅ | `session.js`, `session.test.js`, `supabase.session.test.js` | Low |
| Real-network test | ⚠️ `tests/integration/auth.test.js` calls live Supabase | file header | Low (flaky/credential-dependent) |
| Docs match code | 🔴 `docs/archive/BACKEND_IMPLEMENTATION.md` describes an Express API that does not exist; older README described keys in the JSX | files | Low |
| Deployment | ⚠️ Docker + compose present; VPS/NPM state ❔ | `Dockerfile`, `docker-compose.yml` | Medium |
