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
| Provider rate limit that persists after retries | 429, `error.code: "rate_limited"` |
| Provider overload / outage / network failure that persists after retries | 503, `error.code: "busy"` (plain message; the provider's own text is not shown) |
| Provider did not answer in time, after retries | 503, `error.code: "timeout"` |
| Provider returned an empty reply, after retries | 502, `error.code: "empty"` |
| Provider rejected our key (401/403) | 500, `error.code: "misconfigured"` (generic message; not retried) |
| Provider rejected the request (other 4xx) | 400, `error.code: "bad_request"` (not retried) |
| No provider key configured | 500 (generic message) |

## Retries

The function, not the browser, retries the provider. Only **transient** failures are retried:
429, 5xx, 408, timeouts, network errors and empty replies. Up to 3 attempts, waiting 1s then 2.5s
(or the provider's `Retry-After`, capped at 5s), and never more than the total time budget
(default 70s). A bad key, a bad request, a reply cut off by the length limit or a safety block are
**not** retried: repeating them cannot help. The browser retries once only when the function never
answered at all (dropped connection or a gateway error page).

Optional secrets (leave unset for the defaults):

| Secret | Default | Allowed |
|---|---|---|
| `AI_ATTEMPT_TIMEOUT_SECONDS` | 45 | 10 to 75 |
| `AI_TOTAL_TIMEOUT_SECONDS` | 70 | 15 to 80 |

## Routing (fallback between providers and models)

A request is tried against an ordered **chain** of routes (`provider:model`), at most 3. The first route
gets up to 2 attempts when a fallback is waiting (3 if it is the only one); if it still fails in a way
another model could fix, the next route is tried within the same total time budget.

| Failure on a route | What happens |
|---|---|
| Overload, rate limit, timeout, network, empty reply (after retries) | Next route |
| Provider rejected our key (401/403) | Next route (and the route is marked down) |
| Bad request (other 4xx) | **Stop**: another model will not fix a bad request |
| Reply cut off by the length limit, or blocked by safety filters | **Stop** |

A route that just failed is remembered for 60s (per function instance), so the next requests go to a
healthy route first instead of waiting through the broken one's retries again. A downed route is still
used as a last resort and goes back to the front once the cooldown passes.

Which chain a request uses (all optional secrets; nothing is hard-coded, so model names are yours to set):

| Secret | Meaning |
|---|---|
| `AI_PROVIDER`, `AI_MODEL` | The primary route, as before |
| `AI_FALLBACK` | Comma list of `provider` or `provider:model`, tried after the primary. e.g. `anthropic` or `gemini:<model>,anthropic` |
| `AI_ROUTES` | JSON of per-task chains. e.g. `{"default":["gemini"],"interview_eval":["anthropic","gemini"]}`. When it has an entry for the request's task (or `default`) it replaces the chain above for that task |

Routes with no API key, unknown providers, and duplicates are skipped, so a typo or a missing key makes
the chain shorter instead of breaking it. If every route is skipped the function answers
"AI service is not configured".

The browser may label a request with a **task** (`interview_questions`, `interview_eval`, `star`,
`cover_letter`, `resume_scan`, `jd_analysis`, `salary`; anything else counts as `general`). A task is only
a label that selects a server-side chain. The browser can never choose a provider or model.

## Logs

Every call writes one JSON line, e.g.
`{"evt":"ai_call","task":"interview_eval","provider":"anthropic","model":"...","ok":true,"attempts":3,"fallback":true,"tried":["gemini:...!","anthropic:..."],"ms":9120}`
(`!` marks a route that failed) or, on failure, `"ok":false,"status":503,"code":"busy","attempts":5`. It has no keys, prompts,
answers or user ids. Search the function logs for `ai_call` to see how often the provider is
failing and how slow it is.

## Limits to know about

- The rate limiter is in memory, so it is per function instance. It stops bursts and runaway loops,
  not a determined user across many instances. Set a **monthly spend limit at each provider** as the
  real cost backstop.
- Provider keys and request bodies are never logged.

## Tests

`npm test` runs `handler.test.js` against mocked fetch (no Supabase or Deno needed).
