# CareerAiHub

AI career tools for job seekers (resume scan and builder, cover letter, interview and salary practice, skills gap, credential checks) and a portal for employers. The default market in the app is Singapore.

React 18 + Vite single-page app, Supabase for auth and data, three Supabase Edge Functions for everything that needs a secret. There is no other backend server.

## Run it locally

```bash
npm install
cp .env.example .env     # fill the public values; see the file for what each one is
npm run dev              # open http://localhost:5173
npm test
```

Open the app through the dev server. Double-clicking `index.html` shows a blank page, because the app is JSX that Vite compiles. Run `npm install` again after switching branches.

Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON` the app falls back to the project values hard-coded in `src/lib/supabase.js`.

## How it fits together

```
Browser (React SPA) ──► Supabase Auth + database (row access limited by RLS)
        │
        └─► Edge Functions:  ai (LLM proxy) · jobs (Adzuna) · verify-cert (certificate pages)
```

- AI calls go browser → `ai` function → Anthropic / Gemini / OpenAI. Provider keys exist only as Edge Function secrets.
- Details, per-module data flow, known gaps and decisions: see `docs/`.

## Documentation

| File | What it answers |
|---|---|
| `docs/SYSTEM_MAP.md` | What runs where; which module calls what; the resume scan flow |
| `docs/DATA_LINEAGE.md` | Where each piece of user data is stored and who can change it |
| `docs/VERIFICATION_STATUS.md` | What is proven, partial or missing (start here to audit) |
| `docs/DECISIONS.md` | Why the system is built this way, with evidence |
| `docs/FAILURE_MATRIX.md` | What the user sees when each step fails |
| `docs/OPEN_POINTS.md` | Planned work not yet built |
| `docs/product/` | Product material (verification modes) |
| `docs/archive/` | Superseded files kept for history |
| `tests/README.md` | Where each kind of test lives |
| `docs/database/` | Hand-applied SQL changes and their notes (there are no migrations yet) |
| `docs/DEPLOY_AND_ROTATE_KEYS.md` | Go-live and key-rotation checklist |
| `supabase/functions/ai/README.md` | Setup, limits and error codes of the AI function |

These documents record only what was checked in the code; anything unchecked is marked UNKNOWN.

## Deploy

`docker compose up -d --build` builds the SPA (Node 20) and serves it with nginx; host port 8081 → container port 80, behind Nginx Proxy Manager. Edge Functions are deployed separately with the Supabase CLI (`supabase functions deploy <name>` for each of `ai`, `jobs`, `verify-cert`) after setting their secrets. Follow `docs/DEPLOY_AND_ROTATE_KEYS.md`. `scripts/smoke-test.sh` checks the deployed functions.

## Known gaps

See `docs/VERIFICATION_STATUS.md`. The main ones: no SQL migrations, browser-sent scores accepted by three tables, no observability or cost tracking, no real-model evaluation of AI answers, sample data in the employer preview.
