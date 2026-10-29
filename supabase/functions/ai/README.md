# `ai` Edge Function

Keeps AI provider keys on the server. The browser sends `{ messages, maxTokens, pdfBase64? }` with the
user's login token; the function checks who they are, applies limits, calls the provider and returns
`{ text }`. The server — not the caller — chooses the provider and model.

## Setup (one time)

1. Install the Supabase CLI and log in: `supabase login`, then `supabase link --project-ref <your-project-ref>`.
2. Set the secrets (these never reach the browser). Only the provider(s) you use are needed:

   ```bash
   supabase secrets set \
     AI_PROVIDER=anthropic \
     AI_MODEL=claude-sonnet-5-5 \
     ANTHROPIC_API_KEY=sk-ant-... \
     ALLOWED_ORIGINS=https://careeraihub.com,https://www.careeraihub.com
   # optional extras: GEMINI_API_KEY=... OPENAI_API_KEY=...
   ```

   `SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided automatically.
3. Deploy: `supabase functions deploy ai`

## Behaviour

| Case | Response |
|---|---|
| No / invalid login, or the public anon key | 401 |
| Over 20 requests/min for one user (per function instance) | 429 + `Retry-After` |
| Invalid body, prompt over 200k chars, bad base64 | 400 |
| Body over 12 MB | 413 |
| Model reply cut off by the token limit / provider safety block | 422 (`truncated: true` when cut off) |
| Provider rate limit | 429 |
| Provider outage or timeout | 502 |
| No provider key configured, or the provider rejected our key | 500 (generic message; details only in server logs) |

## Limits to know about

- The rate limiter is in memory, so it is per function instance. It stops bursts and runaway loops,
  not a determined user across many instances. Set a **monthly spend limit at each provider** as the
  real cost backstop.
- Provider keys and request bodies are never logged.

## Tests

`npm test` runs `handler.test.js` against mocked fetch (no Supabase or Deno needed).
