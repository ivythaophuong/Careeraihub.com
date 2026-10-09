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
   # fallbacks (used when the chosen provider is busy or down): GROQ_API_KEY=... OPENROUTER_API_KEY=... DEEPINFRA_API_KEY=... MISTRAL_API_KEY=...
   # optional: AI_FALLBACKS=groq,openrouter  (order of fallbacks; default = every provider that has a key)
   ```

   `SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided automatically.
3. Deploy: `supabase functions deploy ai`

## Fallback

If the chosen provider answers 429, 5xx, 401/403/404 (our key or model), times out, is unreachable or returns nothing, the function tries the
next provider that has a key. It does not fall back for a reply cut off by the length limit, a safety block, or 400/413/422 (the request itself
is wrong). Requests with a PDF go only to Anthropic, Gemini or OpenAI. Groq, OpenRouter, DeepInfra and Mistral use their own default model (`GROQ_MODEL`,
`OPENROUTER_MODEL`, `DEEPINFRA_MODEL`, `MISTRAL_MODEL` override it), never `AI_MODEL`. The default DeepInfra and OpenRouter model ids were not verified against a live account: check them once. Only the provider name and error kind are logged, never keys or bodies. Tests: `fallback.test.js`.
A fallback model may answer differently from the primary one: JSON shape is still checked by the callers (`extractJSON`, `normalize*`).

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

## Data terms of the fallback providers (read 2026-10-09 from the providers' own pages; re-check before relying on them)

| Provider | What the page says | Open question |
|---|---|---|
| Gemini, free tier | Content is used to improve Google products and humans may review it (ai.google.dev/gemini-api/terms). Paid tier: not used to improve products | which tier our key is on: UNKNOWN |
| Groq | No retention by default; logs for troubleshooting or abuse up to 30 days; Zero Data Retention setting; no training on inputs/outputs | whether a free account can enable ZDR: UNKNOWN |
| DeepInfra | Inputs not stored to disk, content not logged, no training, except Google/Anthropic models where those companies' policies apply | where data is processed: not stated |
| Mistral | Free Experiment plan: data may be used for training unless opted out in the Admin Console; paid plans: not used for training (secondary sources, official page not readable) | confirm on Mistral's own page |
| OpenRouter (`:free` models) | depends on the underlying model host; not checked | UNKNOWN |
