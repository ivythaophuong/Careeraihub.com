# Data lineage

Same rules as `SYSTEM_MAP.md`: only what source, tests, `docs/database/` and git history show. Else **UNKNOWN**.

## 1. Where a user's data lives

| Store | Key | Written by | Read by | Notes |
|---|---|---|---|---|
| Browser `localStorage` `supabase.auth.token` | session | `App.jsx` login | `App.jsx`, `src/lib/session.js` | refreshed before expiry by `getValidSession` |
| `localStorage` `careerai_rt_<userId>` / `_guest` | resume text | `App.jsx` `setResumeText` | `App.jsx` | fallback if the DB write is late |
| `localStorage` `careerai_profile` | parsed resume profile | `App.jsx` | `App.jsx` | |
| `user_memory` (JSON `data` column, one row per user) | `user_id` | `useMemory.updateMemory` (upsert of the **whole** memory object on every update) | `useMemory` boot | includes resume text, scan results, saved PDF base64 (`scanPdfBase64`) |
| `resume_scans`, `jd_analyses`, `star_stories`, `cover_letters`, `mock_sessions`, `applications`, `negotiation_practice`, `insights` | `user_id` | `updateMemory(..., {table, data})` → `sb.insert` | `useMemory` boot (limits 10–50 rows each, newest first) | relational copy; `user_memory` also keeps a blob |
| `profiles` | `id` | `App.jsx` (debounced upsert) | `App.jsx` | role, industry, level, market, urgency |
| `candidate_trust_profiles`, `employers`, `employer_members`, `job_listings` | | TrustMatch / EmployerPortal | Dashboard, CareerRoadmap, TrustMatch, EmployerPortal | scores set by DB trigger (§4) |

Row-level security is stated in `CLAUDE.md` and `docs/database/README.md`; the policies themselves are **not in the repo**.

## 2. Lineage: resume → ATS Scanner result

| Step | Source / owner | Transformation | Validation | Can the user edit it? | Can AI edit it? |
|---|---|---|---|---|---|
| Upload or paste | user | none | type PDF/DOCX, ≤ 10 MB (`ResumeScan.handleFile`) | yes | no |
| Text extraction | browser (pdfjs / mammoth) | file → plain text | none found beyond parser errors | n/a | no |
| Stored `resumeText` | `App.jsx` | `localStorage` + memory blob | `useMemory` fails closed if `user_memory` cannot be read | yes (re-upload / editor) | no |
| Digest | `resumeDigest.js` | cut to 6000 chars, keep header + compact sections + share of long ones | user shown a notice when cut | no | no |
| Analysis | model via `ai` function | JSON: matchScore, bars, jdKeywords, issues, fixes | `extractJSON`; keywords re-checked by code; figures in fixes checked by `factGuard` | edits applied fixes; Revert restores text | **yes**: it authors the score, verdict, insight and rewrites |
| Persist | `useMemory.updateMemory` | insert `jd_analyses`, upsert blob | save failure sets `syncError` (toast) | delete via Memory Dashboard | no |
| Display | ResumeScan / Dashboard | | | | |

## 3. Lineage: other AI outputs

| Output | Where the AI text is guarded | Evidence |
|---|---|---|
| ATS rewrite fixes | `factGuard.neutralizeInventedFigures` (figures only) | `ResumeScan.jsx` L308 |
| Interview feedback / scores | `numberGuard` in `HiringManagerSim/interview.js` | grep of imports; behaviour: `interview.test.js` (13) |
| STAR, Salary, Cover Letter, ATS Builder | **no `numberGuard`/`factGuard` import found** in these files on this branch | grep of imports |

## 4. Scores

- Per `docs/database/README.md` (SQL applied by hand 2026-10-05): the columns `trust_score`, `ats_score`, `interview_score`, `star_score` cannot be written from the browser; trigger `recompute_trust_score` writes them.
- **Known gap, stated in that README:** `resume_scans`, `mock_sessions`, `star_stories` still accept score values sent by the browser (limited to 0..100). Those are the inputs the trigger uses (how exactly: UNKNOWN, the trigger body is not in the repo).
- The SQL file `docs/database/2026-10-05-lock-scores-and-verify-employers.sql` exists, but the trigger function source is not shown in this review.

## 5. Questions the repo cannot answer yet

- RLS policies and table definitions (no migrations; only the one hand-applied script and its README).
- Whether production matches that script (no way to check from the repo).
- Retention of `scanPdfBase64` inside `user_memory` (a full PDF as base64 in a JSON blob): no expiry code found.
