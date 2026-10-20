# Local browser tests (not part of `npm test`)

A real Chromium drives the app served by Vite on this machine. The Supabase auth, the tables and the Edge Functions are **faked** in `harness.mjs`, so nothing reaches production, no AI is paid for, no CAPTCHA is met. They check the screens, the links between features and how data flows from one feature to the next. They do **not** check the real database, row level security, the real AI, a real microphone or a real phone.

Setup (once, nothing is added to `package.json`):

    npm i --no-save playwright-core @axe-core/playwright
    npx playwright install chromium        # or set PLAYWRIGHT_CHROMIUM to an existing chrome-headless-shell

Run from the repository root (the dev server is started for you on port 5230):

    node tests/e2e-local/sweep.mjs         # every screen, desktop and phone width: console errors, sideways overflow, accessibility rules, screenshots
    node tests/e2e-local/flows.mjs         # data flows between features, a whole mock interview, and where every call-to-action leads

Output goes to `./e2e-out` (or `E2E_OUT`): `sweep.json`, `flows.json` and `shots/`. Add your own seeds to the `SEEDS` / `RICH` objects.

Known limits: the faked AI answers are minimal, so features that need a real answer show their empty or error state; the sign-in widget is not exercised; the first-run onboarding after a real sign-up is not exercised.
