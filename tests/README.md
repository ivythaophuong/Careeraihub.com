# Tests

`npm test` runs every `*.test.js(x)` under `src/`, `tests/` and `supabase/` (see `vite.config.js`).

| Where | What |
|---|---|
| `src/**/` next to the code | Unit and component tests for that module |
| `supabase/functions/*/handler.test.js` | Edge Function request handling, with a mocked `fetch` |
| `tests/security/` | Whole-codebase rules: no provider keys or direct provider calls in the browser source, no invented trust claims in the UI |
| `tests/integration/` | Tests that call real services. `auth.test.js` hits the live Supabase auth endpoints, so it needs network access |

No test calls a real AI model. See `docs/VERIFICATION_STATUS.md`.
