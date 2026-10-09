# System map

Scope: branch `hotfix/server-side-ai`. Everything here was read from source, tests, `docs/database/` or git history.
Anything not verified is marked **UNKNOWN**. "Verified" means read in source; it does not mean the behaviour was run end to end.

## 1. Runtime topology

```
Browser (React 18 SPA, Vite, no router)
  │  src/App.jsx: `activeModule` state + ?tab=<id> in the URL
  │
  ├─ Auth + data ──► Supabase Auth + PostgREST (custom `sb` client, src/lib/supabase.js)
  │                   user JWT, refreshed by src/lib/session.js; row access is enforced by RLS (policies: UNKNOWN, not in repo)
  │
  ├─ AI ───────────► Edge Function `ai`          ──► Anthropic | Gemini | OpenAI   (one provider per request)
  ├─ Job search ───► Edge Function `jobs`        ──► Adzuna API
  └─ Credentials ──► Edge Function `verify-cert` ──► allowlisted certificate sites

Hosting: Docker (node:20 build → nginx:alpine) on a VPS; host port 8081 → container 80; fronted by Nginx Proxy Manager.
```

The browser never holds a provider key (guarded by `tests/security/noSecretsInClient.test.js`). The Supabase URL and public anon key are in the bundle by design.

## 2. Modules (`activeModule` ids rendered by `App.jsx` `renderActiveModule`)

| id | Component | AI call | Writes to DB (via `updateMemory` relational push unless noted) |
|---|---|---|---|
| dashboard | Dashboard | UNKNOWN | reads `candidate_trust_profiles` |
| scan | ResumeScan → **JDMatchTab only** (see §3) | yes | `jd_analyses` |
| ats | ATSBuilder (Upload & Parse → Builder → Version History) | yes | none via `table:` writes (`user_memory` JSON only). The former `resume_scans` writer, a Kanban scan flow, was removed (see §3) |
| cover | CoverLetterGen | yes | `cover_letters` |
| simulate | InterviewCoach (renders HiringManagerSim code path: UNKNOWN which) | yes | `mock_sessions` (from HiringManagerSim.jsx) |
| salary | SalaryCoach | yes | none found via `table:` writes |
| skillsgap | SkillsGap | yes | none found |
| roadmap | CareerRoadmap | UNKNOWN | reads `candidate_trust_profiles` |
| verify | VerifyCreds | no LLM; calls `verify-cert` | UNKNOWN |
| trustmatch | TrustMatch | no | upserts `candidate_trust_profiles`; reads `job_listings` |
| aichat | AICoach | yes | none found |
| jobs | JobSearch | no | none found |
| jd | JDAnalyzer | yes | `jd_analyses` |
| star | STARBuilder | yes | `star_stories` |
| radar, score, market | WeaknessRadar, ReadinessScore, MarketIntel | UNKNOWN | none found |
| memory | MemoryDashboard | yes (1) | deletes the user's rows in several tables |
| (employer role) | EmployerPortal | no | inserts `employers`, `employer_members`; reads `candidate_trust_profiles` |
| privacy, terms | static pages | no | no |
| (landing page) | Landing/LandingPage | no | calls `jobs` for guests |

`profiles` is read and upserted by `App.jsx` (debounced 1 s). The memory blob lives in `user_memory` (see `DATA_LINEAGE.md`).

## 3. Resume Scan (the module most worth auditing)

### Flow (what the screen shows)

```
Upload / paste (ResumeScan → JDMatchTab)
→ PDF text: pdfjs-dist in the browser (src/lib/resumeParser.js: extractTextFromPdfFile)
  DOCX text: mammoth in the browser
→ resumeText saved by App.jsx (localStorage careerai_rt_<userId> + memory.resumeText)
→ prepareJdMatch (src/lib/resumeDigest.js): resume ≤ 6000 chars, JD ≤ 4000 chars, section-aware condensing; user is told when cut
→ callLLM (src/lib/ai.jsx) → Edge Function `ai` → provider
→ extractJSON
→ checkKeywords: code, not the AI, decides matched/missing over the FULL text; AI-proposed terms not in the JD are dropped
→ guardIssues → factGuard.neutralizeInventedFigures: figures in AI rewrites that are not in the resume become [X]
→ UI; updateMemory → insert `jd_analyses` + upsert `user_memory`
```

### Evidence

- `src/features/ResumeScan/ResumeScan.jsx` (`JDMatchTab`, `guardIssues`, `handleResumeUpload`, `scan`; the persistence call is inside `scan`)
- `src/features/ResumeScan/ResumeScan.jdmatch.test.jsx` (the screen renders and a scan writes `jd_analyses`, never `resume_scans`)
- `src/lib/resumeParser.js`, `src/lib/resumeDigest.js`, `src/lib/factGuard.js`, `src/lib/ai.jsx`
- `supabase/functions/ai/handler.js`, `providers.js`
- `src/hooks/useMemory.js`, `src/App.jsx` (L111–122)

### Important finding (updated 2026-10-09)

The screen renders only `<JDMatchTab/>`. It used to render a legacy "Deep Scan" block wrapped in `{false && (...)}` whose `runScan` wrote `resume_scans`; that block was dead code (never rendered, `runScan` had no other caller) and was **removed** in branch `cleanup/remove-dead-scan-flows-main` (the same change, with its own checkpoint, also exists on top of the ATS Builder P4 work as `cleanup/remove-dead-scan-flows`, tags `checkpoint/before-dead-scan-cleanup-2026-10-09` / `checkpoint/after-dead-scan-cleanup-2026-10-09`).

`ATSBuilder.jsx` held a second dead writer: a Kanban scan flow (`handleFile`, `runScanPdf`, `runScanText`, `processScanResult`, card and `phase` state, and the components `UploadPhase`, `LoadingPhase`, `GapCard`, `EditCard`, `DoneCard`, `KanbanColumn`, `AddGapModal`, `ResultsView`, `AtsScannerDemo`). The `phase` state it set was never read by any JSX, and none of those components was instantiated. Removed in the same branch. The live ATS Builder is `UploadAndParseTab` → `BuilderTab` → `VersionHistoryTab`, whose AI profile (`profile.atsScore`) is stored in `user_memory.parseProfile`, not in a relational table.

**Consequence: no live code path writes `resume_scans` today.** The table is still read (`useMemory.js`) and wiped by the data-reset in `MemoryDashboard.jsx`. Whether older rows exist in the real database was NOT checked (UNKNOWN: needs a query on Supabase).

Left in place on purpose, to be decided separately: the now-unused `moveCardPure` export of `atsBuilderUtils.js` (it keeps its own unit tests); the unused `rs-*` / Kanban rules in `resumeScan.css` and `atsBuilder.css`; the `resume_scans` table, its new `deterministic_score` columns and all rows.

### Verification status

| Component | Status | Note |
|---|---|---|
| PDF text extraction (browser) | YES (source) | `resumeParser.js`; a test file for it: NONE found |
| DOCX text extraction | YES (source) | `mammoth` |
| Digest / truncation notice | YES | `resumeDigest.test.js` (13 cases) |
| AI call through server | YES | `ai.test.js`, `ai/handler.test.js` |
| Keyword matching in code | YES | `resumeDigest.test.js` |
| Number guard on rewrites (`factGuard`) | YES | `factGuard.test.js` (9) |
| Semantic inflation ("contributed" → "led") | NO | not detected by any code found |
| Schema validation of AI JSON | NO | only `extractJSON` parse; no field-level schema check found |
| Score computed server-side | NO | match score comes from the model; stored from the browser |
| Cost tracking | NO | |
