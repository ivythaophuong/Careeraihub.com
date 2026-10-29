# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Control documents (read these before changing behaviour): `docs/SYSTEM_MAP.md`, `docs/DATA_LINEAGE.md`, `docs/VERIFICATION_STATUS.md`, `docs/DECISIONS.md`, `docs/FAILURE_MATRIX.md`. When you document behaviour, write only what you verified in source, tests, `docs/database/` or git history; otherwise write UNKNOWN.

## Commands

```bash
npm run dev       # Start Vite dev server (http://localhost:5173). Opening index.html directly does not work.
npm run build     # Production build (outputs to /dist, git-ignored)
npm run preview   # Preview production build locally
npm test          # Run Vitest tests (vitest run, no watch mode)
bash scripts/smoke-test.sh   # Smoke test of the deployed Edge Functions (asks for a password; needs network)
```

Run `npm install` after switching branches: dependencies differ between branches.

## Architecture

**CareerAiHub** is a React 18 SPA (Vite) plus three Supabase Edge Functions. The browser never holds a provider API key. Supabase handles auth and persistence.

### Entry point & routing

`index.html` → `src/main.jsx` → `src/App.jsx`

There is no React Router. `App.jsx` keeps an `activeModule` state (mirrored in `?tab=<id>`) and `renderActiveModule()` switches between feature components. The sidebar list is `MODULES` in `src/styles/theme.js`; the component for each id is wired in `renderActiveModule()` in `src/App.jsx`. A new module needs both, plus a component under `src/features/`.

### AI integration

All LLM calls go through `callLLM` in `src/lib/ai.jsx`, which POSTs to the `ai` Edge Function (`supabase/functions/ai`) with the user's Supabase token. The function checks the caller with the auth server, rate-limits (20 req/min/user/instance), chooses the provider and model from its own secrets (`AI_PROVIDER`, `AI_MODEL`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`) and returns `{ text }`. Defaults are in `supabase/functions/ai/providers.js`. There is no automatic failover to a second provider. The client retries once on 429, 5xx, timeout or network error.

AI output is parsed with `extractJSON`. Figures an AI rewrite adds that are not in the user's text are neutralised by `src/lib/factGuard.js` / `numberGuard.js`, but these only cover figures, not ownership or scope inflation, and are not used by every module (see `docs/VERIFICATION_STATUS.md`).

Other Edge Functions: `jobs` (Adzuna job search proxy, works for guests) and `verify-cert` (fetches allowlisted certificate pages, sign-in required).

### Supabase

`src/lib/supabase.js` exports a custom `sb` client (not the official `createClient`). It wraps fetch with the anon key and a user token that `src/lib/session.js` refreshes before it expires. The memory tables are `user_memory`, `resume_scans`, `applications`, `star_stories`, `cover_letters`, `jd_analyses`, `mock_sessions`, `negotiation_practice`, `insights`; the app also uses `profiles`, `candidate_trust_profiles`, `employers`, `employer_members`, `job_listings`. Row-level security is expected, but the policies are not in this repo.

The repo has no SQL migrations. Database changes are applied by hand and recorded in `docs/database/`. Score columns are written by a database trigger; three input tables still accept browser-sent scores (see `docs/database/README.md`).

`src/hooks/useMemory.js` loads the tables in parallel at login, normalises snake_case to camelCase, and upserts the whole memory object into `user_memory` on every update. If `user_memory` cannot be read, writing stays locked so saved data is never overwritten. Failed saves set `syncError`, and `App.jsx` shows a toast.

### Document parsing

`src/lib/resumeParser.js` extracts PDF text in the browser with `pdfjs-dist` and DOCX text with `mammoth`. `src/lib/resumeDigest.js` condenses long resumes and job descriptions before the model reads them and tells the user when it did.

### Styling

No Tailwind or external UI library. Most styles are inline objects; there are also CSS files per area (`src/styles/appTheme.css`, `src/features/*/*.css`). Reusable primitives are in `src/components/CommonUI.jsx`. Colours are in `src/styles/theme.js`, and several modules (EmployerPortal, TrustMatch) define their own palette `T`. Dark mode is the default.

### Deployment

Docker multi-stage build: Node 20 runs `npm ci` and `npm run build`; `nginx:alpine` serves `/dist`. No provider keys are in the image. `docker-compose.yml` publishes host port 8081 → container port 80 on the external `npm_net` network; Nginx Proxy Manager forwards the domain to port 8081, so do not change that mapping without re-pointing it (see the comment in the compose file). Edge Function secrets are set with `supabase secrets set`; the go-live and key-rotation steps are in `docs/DEPLOY_AND_ROTATE_KEYS.md`. `docs/archive/BACKEND_IMPLEMENTATION.md` is an old plan for an Express API that was not built.

## Environment variables

See `.env.example`. Browser (Vite, public): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON`, `VITE_LLM_RETRY_DELAY_MS`. Edge Function secrets (server only): `AI_PROVIDER`, `AI_MODEL`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `ALLOWED_ORIGINS`. Never put a provider key in a `VITE_` variable; `tests/security/noSecretsInClient.test.js` fails if one appears.

## Testing

`npm test` runs Vitest (jsdom). Test files live beside the code in `src/`, in `supabase/functions/*/handler.test.js`, and (whole-codebase rules and live-service checks) in `tests/security/` and `tests/integration/` (see `tests/README.md`), covering the AI proxy, `verify-cert`, `jobs`, session refresh, `useMemory`, the resume digest, the number/fact guards, ATS Builder and interview logic. `tests/integration/auth.test.js` is the exception: it calls the real Supabase auth endpoints. No test calls a real AI model, so AI answer quality is not measured.
