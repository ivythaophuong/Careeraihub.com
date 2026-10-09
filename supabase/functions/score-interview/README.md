# `score-interview` Edge Function (finding F-1, step S4 slice 2)

Same idea as `score-star`: the server grades each interview answer and writes the `mock_sessions` row; the browser never sends a
score to be stored. Shared rules: `supabase/functions/_shared/interviewScoring.js`; receipts: `_shared/receipt.js`.

| Action | Input | Output |
|---|---|---|
| `evaluate` | `personaId`, `role?`, `question`, `answer`, `resumeText?` | `feedback` (score, worked, missed, tip, outline) and a `receipt` |
| `save` | `personaId`, `role?`, `items` (1 to 5 graded answers with their receipts) | `{ saved, id, avgScore, questionsCount }` |

Each receipt signs user id, time, interview style, question, answer and score. `save` verifies every receipt, refuses duplicates inside a
session and receipts older than 2 hours, and computes the average itself. At most 10 sessions per user per 24 hours.

Known limits (accepted): the questions come from the `ai` function and are not signed, so a user can practise on questions of
their own choosing; a valid session can be saved again (within the daily cap) because `mock_sessions` has no column to remember it.

Deploy: `supabase functions deploy score-interview --project-ref ruibdsvrcctxgxctaxwe`. The site uses it unless built with `VITE_SERVER_SCORING=false`.
