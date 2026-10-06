# Failure matrix

From `ai.jsx`, `ai/handler.js`, `providers.js`, `verify-cert/handler.js`, `useMemory.js`, `App.jsx`. "Logged" means server-side `console.error` only; no request id or metrics exist. **UNKNOWN** = not found in source.

## AI call path (browser → `ai` → provider)

| Failure | Detected by | User sees | Retry | Fallback | Logged |
|---|---|---|---|---|---|
| Not signed in / expired session | `ai.jsx` (no session) or function 401 | "Please sign in…" / "Your session expired. Please sign in again." | no | no | no |
| Anon key used as a token | `authenticate()` → 401 | same | no | no | no |
| Over 20 requests/min per user per instance | limiter → 429 + `Retry-After` | "Too many requests. Please wait a moment…" | 1 client retry (429 is retryable) | no | no |
| Body > 12 MB | 413 | "Request is too large." | no | no | no |
| Invalid body, prompt > 200k chars, bad base64 | `validate()` → 400 | the validation message | no | no | no |
| No provider key configured | `pickProvider` null → 500 | "AI service is not configured." (+ `diag` flags, signed-in callers only) | no | no | yes (flags, never values) |
| Provider rejects our key (401/403) | `statusFor` → 500 | "AI service is misconfigured." | no | no | yes |
| Provider rate limit | provider 429 → 429 | "The AI provider is busy…" | 1 client retry | no | no |
| Provider outage / 5xx | → 502 | provider message (≤ 300 chars) | 1 client retry | **none**: single provider per request | no |
| Reply cut by token limit | `kind: truncated` → 422 | message; `truncated: true` | no | no | no |
| Provider safety block | `kind: blocked` → 422 | message | no | no | no |
| Empty reply | `kind: empty` → 502 | message | 1 client retry | no | no |
| Client timeout (100 s; function waits 80 s on the provider) | `AbortController` | "The AI request timed out." | 1 retry | no | no |
| Network error | `fetch` throws | "Network error: …" | 1 retry | no | no |
| Reply is not valid JSON | `extractJSON` → `{error:true}` | **depends on the screen**: ATS Scanner (JD Match) shows nothing (no else branch, ~L482); others UNKNOWN | no | no | console only |
| Invented figure in an AI rewrite | `neutralizeInventedFigures` | `[X]` blank; the card needs input; Save is disabled until replaced | n/a | n/a | no |
| Ownership / scope inflation | not detected | nothing | | | |

## Other paths

| Failure | Detected by | User sees | Notes |
|---|---|---|---|
| Unsupported file or > 10 MB | `ResumeScan.handleFile` | "Only PDF and DOCX files are supported." / "File too large — maximum 10 MB." | |
| PDF/DOCX gives < 50 characters of text, or the parser throws | `JDMatchTab` upload (`ResumeScan.jsx` ~L426–444) | "Could not extract text from file." or the parser's message | scanned (image-only) PDFs end up here; no OCR path found |
| Saving to the database fails | `useMemory.updateMemory` | toast "Couldn't save your latest changes…" | one blob-only retry follows a failed relational push |
| `user_memory` cannot be loaded at login | `critical` fetch → `setRestoreError` | restore-error state | writes stay locked so nothing is overwritten |
| Other table fails to load | per-table `catch` | that list is empty | logged with `console.warn` |
| Stored token expired | `App.jsx` restore | silent refresh then page reload; if refresh fails, signed out | |
| Certificate link not on an allowlisted site, bad redirect, too large, slow | `verify-cert` → `VerifyError` (400/502) | the error message | allowlist: Coursera, Udemy, Accredible/credential.net, edX, freeCodeCamp |
| Job search provider keys missing | `jobs` handler | UNKNOWN user message | server logs `ADZUNA_APP_ID / ADZUNA_APP_KEY are not set.` |
