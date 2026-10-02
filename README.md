# CareerAiHub

AI career coach: resume scan, ATS-friendly resume builder, job search, interview prep and more.
React 18 + Vite single-page app. Supabase provides auth, the database and two Edge Functions that
keep every secret off the browser.

```
Browser (React SPA) ──► Supabase Auth + Postgres (RLS)
        │
        ├─► Edge Function  ai    ──► Anthropic / Gemini / OpenAI   (needs a signed-in user)
        └─► Edge Function  jobs  ──► Adzuna job search             (works for guests, per-IP limit)
```

**No API key is shipped in the browser bundle.** The only values in the client are the public
Supabase URL and anon key (safe by design; protected by Row Level Security).

## Develop

```bash
npm install
npm run dev      # Vite dev server
npm test         # Vitest (unit + Edge Function handlers, all network mocked)
npm run build    # production build to /dist
```

AI features and live job search call the deployed Edge Functions. To run them locally instead,
use the Supabase CLI (`supabase functions serve`) and set the secrets below in `supabase/.env.local`.

## Set up the server side (one time)

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then `supabase login` and
   `supabase link --project-ref <your-project-ref>`.
2. Set secrets (stored by Supabase, never in git or the browser):

   ```bash
   supabase secrets set \
     AI_PROVIDER=anthropic AI_MODEL=claude-sonnet-5-5 ANTHROPIC_API_KEY=sk-ant-... \
     ADZUNA_APP_ID=... ADZUNA_APP_KEY=... \
     ALLOWED_ORIGINS=https://careeraihub.com,https://www.careeraihub.com
   # Optional extra providers: GEMINI_API_KEY=... OPENAI_API_KEY=...
   ```
3. Deploy: `supabase functions deploy ai && supabase functions deploy jobs`
4. In each AI provider's dashboard, **set a monthly spend limit**. The in-function rate limit is
   per instance, so the provider limit is the real cost backstop.

Details and the error table: [supabase/functions/ai/README.md](supabase/functions/ai/README.md).

## Database

Tables (all scoped by `user_id` with Row Level Security): `user_memory`, `resume_scans`,
`applications`, `star_stories`, `cover_letters`, `jd_analyses`, `mock_sessions`,
`negotiation_practice`, `insights`. Disable "Confirm email" under Supabase → Authentication →
Providers → Email only if you want instant sign-in.

## Deploy the web app (Docker)

```bash
docker compose up -d --build   # serves the SPA on 127.0.0.1:8081
```

The image contains only the compiled static site; it needs no environment variables or secrets.
Point Nginx Proxy Manager (or any reverse proxy) at `127.0.0.1:8081` and add TLS there.
`.dockerignore` keeps `.env` files out of the build context.

## Project layout

| Path | What |
|---|---|
| `src/App.jsx` | App shell, module switching, session handling |
| `src/features/*` | One folder per module (Resume Scan, ATS Builder, Job Search, …) |
| `src/lib/ai.jsx` | `callLLM()` → `ai` Edge Function (retry, timeout, truncation handling) |
| `src/lib/session.js` | Login session storage and token refresh |
| `src/hooks/useMemory.js` | Loads/saves user memory (merged state, debounced backup) |
| `src/hooks/useDevice.js` | Phone / tablet / desktop layout switching |
| `supabase/functions/ai` | AI proxy (auth, limits, provider calls) |
| `supabase/functions/jobs` | Adzuna proxy |

## Known limitations

- JD Analyzer, STAR Builder, HM Simulator, Salary Coach and Cover Letter still return sample output
  and show a "Preview" banner; they are not yet wired to the AI.
- Weakness Radar and Readiness Score are derived from the resume scan score.
