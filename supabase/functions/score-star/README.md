# `score-star` Edge Function (finding F-1, step S4 slice 1)

The browser sends the four STAR sections the user wrote. The server asks the model, computes the overall score with
`supabase/functions/_shared/starScoring.js` (the same code the browser uses to display it), and writes the `star_stories`
row with the service role. The browser never sends a score to be stored.

| Action | Input | Output |
|---|---|---|
| `review` | `story`, optional `context` (role, level, industry) | `result` (scores, rewrite, feedback) and a `receipt` |
| `save` | `story`, `result`, `receipt` from `review` | `{ saved, id, score }` |

The receipt is an HMAC (key: `SCORING_SIGNING_KEY`, else `SUPABASE_SERVICE_ROLE_KEY`, which Supabase provides automatically)
over the user id, time, story, section scores, rewrite and one-liner. `save` refuses a changed number, text or user, and
a receipt older than 2 hours. The overall score is recomputed from the signed section scores. The same story is not saved
twice; at most 30 stories per user per 24 hours; 10 requests per minute per user per function instance.

Deploy (no new secrets needed): `supabase functions deploy score-star --project-ref ruibdsvrcctxgxctaxwe`.
The site uses it unless built with `VITE_SERVER_SCORING=false`. Until slice 3 revokes the browser's write access to the
score columns, the old browser path still works and a forged score is still possible. Tests: `handler.test.js`.
