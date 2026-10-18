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
`OPENROUTER_MODEL`, `DEEPINFRA_MODEL`, `MISTRAL_MODEL` override it), never `AI_MODEL`. The default DeepInfra and OpenRouter model ids were not verified against a live account: check them once. Groq's `llama-3.3-70b-versatile` returned "does not exist or you do not have access" for a free account (2026-10-09), so the default is `openai/gpt-oss-120b`, a production model on Groq's model list; if all providers fail, the chosen provider's error is returned. Only the provider name and error kind are logged, never keys or bodies. Tests: `fallback.test.js`.
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
| OpenRouter | Does not store prompts unless the account opts in. Requests carry `provider: { zdr: true }`, so only Zero Data Retention endpoints are used (docs: openrouter.ai/docs/guides/features/zdr) | whether `:free` models have a ZDR endpoint: UNKNOWN. If not, the request fails and the next provider is tried |

## Features that produce a score do not fall back, and room for thinking

- `NO_SILENT_FALLBACK` (`providers.js`): `score_star_review`, `score_interview_evaluate`, `scan_jd_match`, `jd_analyze`, `memory_plan`. For these the chain is only the first provider that can serve the request (the first one that reads PDFs, when a PDF is attached). If it fails, the caller gets that error and the browser's one retry goes to the same provider. Reason, MEASURED 2026-10-14 on an invented set: the same interview answer scored 12, 22 and 32 from three models, so a silent switch changes the number the user sees. `score-star` and `score-interview` set their own label; for `ai` the label comes from the browser, and it only decides the caller's own request. Every other feature falls back as before.
- `withThinkingRoom` (`providers.js`): OpenAI and Anthropic requests carry twice the feature's output limit (at least 4096, at most 16000), because a model that thinks counts its thinking against the limit and a reply cut by the limit is not retried elsewhere (Haiku 5.5 used up to 3,182 of the 4,000 `ats_parse` allows). The provider bills the tokens used, not the limit. Groq's gpt-oss already had this (`groqBody`); other compatible providers and Gemini are unchanged.
- Not changed: the order of the chain for writing features is still `AI_PROVIDER` then `AI_FALLBACKS` (or every keyed provider). Which providers are keyed in production, and whether `AI_FALLBACKS` is set, is UNKNOWN from the repo.

## Time budget for the fallback chain (ADR-012)

`callWithFallback` has an overall budget (default 90 s, `DEFAULT_DEADLINE_MS` in `providers.js`). Each provider attempt gets at most the time that is left (and never more than its own 80 s), and no further provider is started when less than 5 s remain; the first provider's error is then reported, as before. `ai`, `score-star` and `score-interview` all use it because they all call `callWithFallback`.

- Why 90 s: it must stay below the browser's wait (100 s in `src/lib/ai.jsx` and `src/lib/serverScoring.js`), which is below the platform's request idle timeout of 150 s (Supabase Edge Function limits page, read 2026-10-11; the page lists 150 s idle timeout for both plans and 150 s / 400 s wall clock for free / paid plans). The value 90 s is a proposal pending owner confirmation.
- Optional secret `AI_DEADLINE_MS` changes the budget without a code change (ignored if it is not a number of at least 5000).
- Limit of this change: aborting a request closes the connection but does not prove the provider stopped processing or billing. Reconciling that is later work (cost reservation, "Approach B").
- The browser still retries once on 5xx, so one user action can cost up to two budgets. Not changed here.

## Usage metering (step C1 of the pricing plan)

Every model call attempt writes one log line `[usage] {json}` (Supabase dashboard, Functions, `ai` / `score-star` / `score-interview`, Logs). It holds counts and metadata only:
`correlation_id`, `feature`, `user_ref` (a pseudonym, not the user id), `provider`, `model`, `attempt`, `fallback`, `outcome`, `error_kind`, `http_status`, `duration_ms`,
`input_tokens`, `output_tokens`, `thinking_tokens`, `total_tokens`, `usage_status`, `has_pdf`, `price_table_version`, `cost_usd`, `cost_status`. Never a prompt, a CV, an answer, a key or an e-mail (tests check this).

- Tokens are what the provider reported. If it reported none: `usage_status: "usage_unavailable"` and null tokens. Nothing is estimated.
- Cost comes only from `PRICE_TABLE` in `supabase/functions/_shared/usage.js` (versioned entries with an effective date). The table lists the models the production chain uses (OpenAI `gpt-6-luna`, Groq `openai/gpt-oss-120b`), with prices copied from the providers' own pages and the date each was read; any other model has no entry, so `cost_status` is `price_unknown`. Thinking tokens, PDF input and free tiers are billed in provider-specific ways; an entry that cannot describe a quirk must not be added (the comment above `PRICE_TABLE` says what each entry assumes). Prices change: re-read them before relying on a cost figure and add a new dated entry instead of editing an old one.
- `feature` is chosen by the app (`tab_<tool>` from the open tool, or an explicit name); `score-star` and `score-interview` set their own. Anything odd becomes `unknown`.
- `user_ref` is an HMAC of the user id. Set the secret `USAGE_LOG_SALT` once (`supabase secrets set USAGE_LOG_SALT=<random string>`); without it the service role key is used, and rotating that key changes every pseudonym.
- An error response from `ai` carries `error.requestId`, the same value as `correlation_id`, for support.
- Logging errors are swallowed: metering can never break a request.

Report: copy the log lines into a file and run `node scripts/usage-report.mjs <file>`. It prints, per feature: requests, users, errors, answers by fallback, average tokens (only over calls that reported them), cost where a price entry exists, and how many calls had no cost.
Credit prices must not be set from this alone: they also need a judgement of the value each action gives the user (`docs/product/PRICING-AND-CREDITS-STRATEGY.md`).

### Resume counts in the usage line (Stage 1 of the Resume Context design)

Each `[usage]` event also carries `resume_kind` (`structured`, `text`, `pdf`, `none` or null) and `resume_chars` (a whole number or null): what kind of resume source the call carried and how many characters of it. Counts only, never text. The app sends them as the optional request fields `resumeKind` and `resumeChars` (set by `callLLMFor` in `src/lib/aiFeature.js`); `score-interview` sets them itself. Anything that is not on the fixed list or not a sensible number is recorded as null. The same change gives every call site its own feature label (a test fails if a bare `callLLM(` appears).

### Usage ledger (off by default)

`ai` can reserve a row in the usage ledger before it calls a provider and settle it afterwards (`supabase/functions/_shared/ledger.js`; tables in `docs/database/proposed/2026-10-15-practice-ledger.sql`, applied 2026-10-15).

- **Switch:** the secret `AI_LEDGER=on` (and `SUPABASE_SERVICE_ROLE_KEY`, which the platform provides). Without it nothing changes: deploying this code is not enough to turn it on.
- **Gate mode:** with no row in `ai_policies` the ledger only records (`gate_mode: observe`); once the owner inserts a policy row it enforces (`gate_mode: enforce`) and a refused request gets HTTP 429. Every `[usage]` line carries `gate_mode`.
- **Fail-open (owner decision D-7):** if the ledger cannot be reached or answers badly, the AI request goes through and `[ai] ledger gate_error` is logged. The gate has a 2.5 s time limit.
- **Settling:** the provider answered with usable output: `completed` with the reported tokens; answered but output cut off, blocked or empty: `completed` with no usage, so the reservation stands as the cost; answered with an error status: `failed`; no status (timeout, network, unexpected): `unknown_pending` (the slot is freed, the reserved tokens stay counted).
- **Content:** only a hash of the request, counts and ids reach the ledger; never a prompt, a CV or an answer.
- **Estimate:** the reservation is about 4 characters a token for the prompt plus the output ceiling, plus a fixed 3000-token allowance for an attached PDF (its size in tokens is not known before the call).
- **Rollback:** `supabase secrets unset AI_LEDGER`.
