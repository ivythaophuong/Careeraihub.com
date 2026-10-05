# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # Production build (outputs to /dist)
npm run preview   # Preview production build locally
npm test          # Run Vitest tests (vitest run, no watch mode)
bash scripts/smoke-test.sh   # Checks the deployed Edge Functions (asks for a test login; never prints it)
```

`src/features/ATSBuilder/ATSBuilder.test.js` has 6 known failing tests that predate the current work.

## Platform rules (read before changing anything about scores, trust or verification)

1. **Secrets never reach the browser.** Nothing with a `VITE_` prefix may be a secret: everything `VITE_` ships to every
   visitor. AI provider keys and the Adzuna keys live only in Supabase Edge Function secrets.
2. **A user claim can create Evidence, but only an authorized server-side verification process can create VERIFIED
   Evidence or contribute to a Trust Score.** The browser never sends `status`, `verified`, a score, or a score bonus
   that the system then believes.
3. **Unknown is not weak.** With too little evidence we say "Not enough evidence yet" and point to the action that
   creates it. We never invent a number to fill a gap.
4. **Every score has a source, every source has evidence, and every weakness leads to an action.**
5. **No sample data presented as real.** No hardcoded companies, candidates, jobs, market figures or match percentages
   in the app UI. Empty states are honest.
6. **Say what a score is.** The score computed by the database trigger is the **Practice Score** (from the user's own
   resume scans, interview answers and STAR stories). It is not verified and must not be called "Trust" or "verified".
7. **Anything that fetches a URL the user supplies** must use an exact hostname allowlist over HTTPS, re-check every
   redirect, and cap time and size (see `supabase/functions/verify-cert/handler.js`).
8. **Database writes that decide trust are server-side.** Do not let a browser write columns that other people rely on
   (scores, verification, employer approval). Changes to the database are applied by hand in the Supabase SQL editor and
   must be documented in `docs/database/` (see its README).

## Architecture

**CareerAiHub** is a React 18 SPA. Supabase is the backend: auth, Postgres (with Row Level Security on every table) and
three Edge Functions. There is no other server.

### Entry point & routing

`index.html` → `src/main.jsx` → `src/App.jsx`

There is no React Router. Navigation is tab-based: `App.jsx` holds an `activeModule` state and `renderActiveModule()`
maps it to a feature component in `src/features/`. Recruiters (`role = recruiter`) are sent to `EmployerPortal`.

### AI integration

All model calls go through `callLLM` in `src/lib/ai.jsx`, which POSTs to the **`ai` Edge Function**
(`supabase/functions/ai`). The function checks the signed-in user, applies limits, and calls the provider with a key held
as a Supabase secret. The server, not the browser, chooses the provider and model (`AI_PROVIDER`, `AI_MODEL`,
`GEMINI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`, `ALLOWED_ORIGINS`). Replies are JSON parsed with
`extractJSON`. Scores in feature screens are the model's opinion, not measurements.

### Edge Functions (`supabase/functions/`)

| Function | Purpose |
|---|---|
| `ai` | Authenticated proxy to the AI provider |
| `jobs` | Proxy to Adzuna job search (needs `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`; works for guests, rate-limited by IP) |
| `verify-cert` | Checks a certificate link on an allowlisted platform; requires sign-in |

Each has `handler.js` (testable, no Deno APIs), `handler.test.js`, and a thin `index.ts`. Deploy with
`supabase functions deploy <name> --project-ref <ref> --use-api`. Deploy the website before a function whose contract
the website must follow (an old site would not send what the new function needs).

### Supabase client and data

`src/lib/supabase.js` exports a custom `sb` client (not the official `createClient`). Its database helpers take a token
argument, but they use the stored session's token, refreshed when near expiry (`src/lib/session.js`), because tokens
passed from React state go stale after about an hour.

`src/hooks/useMemory.js` loads the user's data on login, normalises snake_case → camelCase, and writes a JSON blob backup
to `user_memory`. Saving stays **locked** until `user_memory` loads, and stays locked if it fails to load (the app shows a
retry screen), so a failed load cannot overwrite saved data. It exposes `syncError` (failed saves, shown as a toast) and
`syncedAt` (changes after each good save; screens that read database-computed values depend on it).

`candidate_trust_profiles.trust_score` is recomputed by a database trigger from `resume_scans`, `mock_sessions` and
`star_stories` (weights 40 / 35 / 25). Browsers cannot write the score columns. Employers need `employers.verified_at`
(set by an admin) to read candidate profiles, create matches, or have jobs listed publicly. Details: `docs/database/`.

### Document parsing

`src/lib/resumeParser.js` extracts text client-side using `pdfjs-dist` (PDF) and `mammoth` (DOCX). Scanned PDFs are sent
to the `ai` function.

### Styling

No Tailwind or external UI library. All styles are inline CSS-in-JS objects. Reusable primitives (`Card`, `Btn`, `Badge`,
`Spinner`, `EmptyState`) live in `src/components/CommonUI.jsx`. The color palette and per-module color assignments are in
`src/styles/theme.js`. Dark mode is the default; light mode is a toggle.

### Deployment

Docker multi-stage build: Node 20 builds the app (`npm ci`, `npm run build`), Nginx Alpine serves `/dist`. The only
build-time settings are the public ones in `.env.production`. The container publishes host port 8081 because Nginx Proxy
Manager forwards `careeraihub.com` to the server's public IP on that port; do not change the port mapping without
re-pointing the proxy host first. Operational runbook: `docs/DEPLOY_AND_ROTATE_KEYS.md`.

## Environment variables

Only public values are used by the app, in `.env.production` / `.env`:

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON` | Supabase public anon key (safe to publish; Row Level Security protects the data) |

Server-side secrets are set with `supabase secrets set`, never in this repo.
