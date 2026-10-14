# Failure matrix

From `ai.jsx`, `ai/handler.js`, `providers.js`, `verify-cert/handler.js`, `useMemory.js`, `App.jsx`. **UNKNOWN** = not found in source. Rows marked † were re-read against `origin/main` at `09cccab` on 2026-10-14; rows without † were not re-checked then.

"Logged": the provider chain writes `console.error` / `console.log` lines (provider and model names, error kinds, never keys or content) and one `[usage]` JSON line per provider attempt (`correlation_id`, `provider`, `model`, `fallback`, `outcome`, `error_kind`, `http_status`, tokens; counts and metadata only, see `supabase/functions/ai/README.md`). Error responses from `ai` carry `requestId` (the same value as `correlation_id`). No alerts, runbook, SLO or metrics dashboard were found in the repo; whether any exist outside it is **UNKNOWN**.

## AI call path (browser → `ai` → provider)

| Failure | Detected by | User sees | Retry | Fallback | Logged |
|---|---|---|---|---|---|
| Not signed in / expired session | `ai.jsx` (no session) or function 401 | "Please sign in…" / "Your session expired. Please sign in again." | no | no | no |
| Anon key used as a token | `authenticate()` → 401 | same | no | no | no |
| Over 20 requests/min per user per instance | limiter → 429 + `Retry-After` | "Too many requests. Please wait a moment…" | 1 client retry (429 is retryable) | no | no |
| Body > 12 MB | 413 | "Request is too large." | no | no | no |
| Invalid body, prompt > 200k chars, bad base64 | `validate()` → 400 | the validation message | no | no | no |
| No provider key configured | `pickProvider` null → 500 | "AI service is not configured." (+ `diag` flags, signed-in callers only) | no | no | yes (flags, never values) |
| Provider rejects our key (401/403) † | `shouldFallBack` | if every provider fails: "AI service is misconfigured." | no | **yes**: the next keyed provider (not for score features, see below) | yes |
| Provider rate limit † | provider 429 | if every provider fails: "The AI provider is busy…" | 1 client retry | **yes**: the next keyed provider (not for score features) | yes |
| Provider outage / 5xx † | status 0, 404, 408, 5xx or an unreachable host | if every provider fails: the first provider's error (≤ 300 chars) | 1 client retry | **yes**: `providerChain` = `AI_PROVIDER`, then `AI_FALLBACKS` or every keyed provider; total budget 90 s (`AI_DEADLINE_MS`) | yes |
| Reply cut by token limit † | `kind: truncated` → 422 | message; `truncated: true` | no | **no**: the same request would be cut elsewhere | yes |
| Provider safety block † | `kind: blocked` → 422 | message | no | **no** | yes |
| Empty reply † | `kind: empty` | message | 1 client retry | **yes** | yes |
| Client timeout † (100 s) and server budget (90 s in total, each attempt at most 80 s; no new attempt starts with less than 5 s left) | `AbortController`; the chain stops starting new attempts when the budget is used up | "The AI request timed out." | 1 retry | the chain, while budget is left | yes |
| Network error | `fetch` throws | "Network error: …" | 1 retry | no | no |
| Reply is not valid JSON † | `extractJSON` → `{error:true}` | **depends on the screen**: ATS Scanner (JD Match) shows nothing (`if (!parsed.error) {…}` with no else, `ResumeScan.jsx` L253); others UNKNOWN | no | no | console only |
| Invented figure in an AI rewrite (ATS Builder fixes, Resume Scan) † | `neutralizeInventedFigures` (`factGuard.js`) | `[X]` blank; the card says to fill it; Resume Scan's Save waits until it is filled | n/a | n/a | no |
| Invented figure in Cover Letter, STAR, Salary or interview text † | `numberGuard.findUnsupportedNumbers` (`CoverLetterGen.jsx`, `star.js`, `salary.js`, `interview.js`) | UNKNOWN what each screen shows (not re-read) | n/a | n/a | no |
| A blank the model wrote itself (`[X]%`, `[number]`, `[City, Region]`) † | `findBlanks` (`factGuard.js`): any short [bracketed] text; `[1]` and a bracket already in the resume are ignored | the "fill this in" note on the issues panel, the Fix page, the Builder draft and Resume Scan; Resume Scan's Save says "Fill the blanks to save"; exporting asks once (`exportGuard.js` counts the same blanks) | n/a | n/a | no |
| Ownership / scope / duty / link / place / skill the resume does not support † | `claimGuard.claimWarnings`: ownership, scope, new_term, result, new_content, invented_link, invented_location, new_skill; with the model's `evidence` / `unsupported`: bad_evidence, declared_addition, undeclared_addition | a warning on the card **before** Apply; the button reads "… — I confirm this is true". Warns only, nothing is blocked. Panel, Fix page, Builder draft and Resume Scan (Resume Scan has no evidence fields). **Not checked** in Cover Letter, STAR, Salary, interview (no `claimGuard` import) | n/a | n/a | no |
| A score feature's provider fails † | `NO_SILENT_FALLBACK` in `providers.js`: `score_star_review`, `score_interview_evaluate`, `scan_jd_match`, `jd_analyze`, `memory_plan` | the provider's error; the same model is tried again by the browser's retry | 1 client retry, same provider | **none, by design**: a different model gives the same text a different score | yes |

## Other paths

| Failure | Detected by | User sees | Notes |
|---|---|---|---|
| Unsupported file or > 10 MB † | `ResumeScan` upload (`ResumeScan.jsx` ~L196–198) | "Only PDF or DOCX supported." / "File too large — max 10 MB." | |
| PDF/DOCX gives < 50 characters of text, or the parser throws † | `ResumeScan.jsx` L209 (`text.trim().length < 50`) | "Could not extract text from file." or the parser's message | scanned (image-only) PDFs end up here; no OCR path found in the Scanner. The Builder says "Could not extract text — try a DOCX or paste your resume."; onboarding asks the model to read a PDF that pdf.js cannot read |
| Saving to the database fails | `useMemory.updateMemory` | toast "Couldn't save your latest changes…" | one blob-only retry follows a failed relational push |
| `user_memory` cannot be loaded at login | `critical` fetch → `setRestoreError` | restore-error state | writes stay locked so nothing is overwritten |
| Other table fails to load | per-table `catch` | that list is empty | logged with `console.warn` |
| Stored token expired | `App.jsx` restore | silent refresh then page reload; if refresh fails, signed out | |
| Certificate link not on an allowlisted site, bad redirect, too large, slow | `verify-cert` → `VerifyError` (400/502) | the error message | allowlist: Coursera, Udemy, Accredible/credential.net, edX, freeCodeCamp |
| Job search provider keys missing | `jobs` handler | UNKNOWN user message | server logs `ADZUNA_APP_ID / ADZUNA_APP_KEY are not set.` |
