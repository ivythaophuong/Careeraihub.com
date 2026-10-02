# Work Culture Quiz (lead magnet)

A free, public 10-question quiz at `/culture-quiz`. Visitors see their persona straight away and
enter an email to unlock the full report. No login, no AI calls, no API keys in the browser.

## How it works

- 10 forced-choice questions. Every pair of five axes (Innovation, Autonomy, Collaboration,
  Structure, Pace) is compared once, and both options are positive.
- Each answer is "A/B, slightly/strongly". An axis can earn up to 8 points, scaled to 0-100.
  Scores show leaning relative to the other axes.
- The top two axes pick one of 10 personas (`personas.js`).
- On unlock the email, optional name, scores and persona are saved to `culture_leads`.
  Funnel events (view, start, complete, unlock, share, cta_click) go to `culture_quiz_events`.

## Files

| Path | Purpose |
|---|---|
| `src/features/CultureQuiz/CultureQuiz.jsx` | Screens: intro, questions, teaser, email gate, full report |
| `src/features/CultureQuiz/questions.js` | The 10 questions and answer scale |
| `src/features/CultureQuiz/scoring.js` | Score and persona logic (unit tested) |
| `src/features/CultureQuiz/personas.js` | Persona and per-axis copy: edit wording here |
| `src/features/CultureQuiz/tracking.js` | Events, UTM capture, lead save, throttle |
| `src/features/CultureQuiz/shareCard.js` | Downloadable result image |
| `src/main.jsx` | Serves the quiz at `/culture-quiz` outside the logged-in app |
| `supabase/culture_quiz.sql` | Tables and insert-only security rules |
| `supabase/functions/send-culture-report/` | Resend email, triggered by a database webhook |

## Setup

1. **Database.** Run `supabase/culture_quiz.sql` in the Supabase SQL Editor.
2. **Resend.** Verify your sending domain in Resend and create an API key.
3. **Deploy the email function** (Supabase CLI):
   ```
   supabase secrets set RESEND_API_KEY=... FROM_EMAIL="CareerAIHub <hello@careeraihub.com>" \
     WEBHOOK_SECRET=<random string> SITE_URL=https://careeraihub.com
   supabase functions deploy send-culture-report --no-verify-jwt
   ```
4. **Webhook.** Supabase dashboard > Database > Webhooks > create one on table `culture_leads`,
   event `INSERT`, type "Supabase Edge Functions" (or HTTP) pointing at `send-culture-report`,
   with the HTTP header `x-webhook-secret: <the same random string>`.
5. **Test** end to end with your own email before sharing the link.

The quiz works without steps 2-4: leads are saved and the report unlocks on screen. Only the
email copy needs Resend.

## Known limits

- The anonymous insert is protected by row-level security, a honeypot field and a client-side
  30-second throttle. A determined bot can still submit fake emails. If that happens, add a
  CAPTCHA (for example Cloudflare Turnstile) or double opt-in (send a confirmation link first).
- Because anyone can submit any email address, the report email should stay low-risk. Do not
  put sensitive content in it.
- Quiz results describe work preferences, not ability. Keep marketing copy in that spirit.
