# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # Production build (outputs to /dist)
npm run preview   # Preview production build locally
npm test          # Run Vitest tests (vitest run, no watch mode)
```

## Architecture

**CareerAiHub** is a React 18 SPA with no backend server. All AI calls go directly from the browser to Anthropic, OpenAI, and Gemini APIs. Supabase handles auth and persistence.

### Entry point & routing

`index.html` → `src/main.jsx` → `src/App.jsx`

There is no React Router. Navigation is tab-based: `App.jsx` manages an `activeModule` state that controls which of the 12 feature components renders. Adding a new module means adding it to the `MODULES` array in `App.jsx` and creating a component under `src/features/`.

### AI integration

All LLM calls go through `callLLM()` in `src/lib/ai.jsx`, which POSTs to the `ai` Supabase Edge Function
(`supabase/functions/ai`) with the signed-in user's token (refreshed by `src/lib/session.js`). The function holds the
provider keys (Anthropic / Gemini / OpenAI), chooses provider and model from its own secrets, enforces limits, and
returns `{ text }`. The browser never sees an API key. `callLLM` retries once on 429/5xx, and throws `LLMError`
(`.status === 401` → user must sign in; `.truncated` → reply hit the length limit). Live job search uses the `jobs`
Edge Function (Adzuna proxy). Handler logic is plain JS in `handler.js` so it is unit-tested with mocked fetch.

### Supabase

`src/lib/supabase.js` exports a custom `sb` client (not the official `createClient`). It wraps fetch manually with the anon key and user JWT. The schema has 9 tables: `user_memory`, `resume_scans`, `applications`, `star_stories`, `cover_letters`, `jd_analyses`, `mock_sessions`, `negotiation_practice`, `insights`. All rows are scoped by `user_id` via RLS.

`src/hooks/useMemory.js` fetches all 9 tables in parallel on login, normalizes snake_case → camelCase, and upserts a JSON blob backup to `user_memory`. It uses an atomic lock flag to prevent race conditions.

### Document parsing

`src/lib/resumeParser.js` extracts text client-side using `pdfjs-dist` (PDF) and `mammoth` (DOCX). The raw text is then passed to Claude for structuring.

### Styling

No Tailwind or external UI library. All styles are inline CSS-in-JS objects. Reusable primitives (`Card`, `Btn`, `Badge`, `Spinner`, `EmptyState`) live in `src/components/CommonUI.jsx`. The color palette and per-module color assignments are in `src/styles/theme.js`. Dark mode is the default; light mode is a toggle.

### Deployment

Docker multi-stage build: Node 20 runs `npm ci` + `npm run build`, Nginx Alpine serves `/dist` on port 80 (compose maps it to
`127.0.0.1:8081`, behind Nginx Proxy Manager with TLS). The image needs no env vars or secrets. Edge Functions are deployed
separately with `supabase functions deploy ai` / `jobs`; secrets are set with `supabase secrets set` (see README.md).

## Environment variables

The client reads no secrets. Server secrets live in Supabase: `AI_PROVIDER`, `AI_MODEL`, `ANTHROPIC_API_KEY`,
`GEMINI_API_KEY`, `OPENAI_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `ALLOWED_ORIGINS`. (`VITE_LLM_RETRY_DELAY_MS` is an
optional test-only knob.)

## Testing

`npm test` runs Vitest with jsdom and mocked network (no live Supabase or provider calls): `src/lib/ai.test.js`,
`src/lib/session.test.js`, `src/hooks/useMemory.test.js`, `src/auth.test.js`, and the Edge Function handler tests under
`supabase/functions/*/handler.test.js`. There are no component tests yet.
