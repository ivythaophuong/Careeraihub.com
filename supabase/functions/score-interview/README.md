# `score-interview` Edge Function (finding F-1, step S4 slice 2)

Same idea as `score-star`: the server grades each interview answer and writes the `mock_sessions` row; the browser never sends a
score to be stored. Shared rules: `supabase/functions/_shared/interviewScoring.js`; receipts: `_shared/receipt.js`.

| Action | Input | Output |
|---|---|---|
| `evaluate` | `personaId`, `role?`, `question`, `answer`, `resumeText?` | `feedback` (score, worked, missed, tip, outline) and a `receipt` |
| `save` | `personaId`, `role?`, `items` (1 to 5 graded answers with their receipts) | `{ saved, id, avgScore, questionsCount }` |

Each receipt signs user id, time, interview style, question, answer and score. `save` verifies every receipt, refuses duplicates inside a
session (the same answer, or two graded answers to the same question) and receipts older than 2 hours, and computes the average itself. At most 10 sessions per user per 24 hours.

Known limits (accepted): the server cannot tell which attempt at a question was the first (there is no session or ledger table), so a user who calls `evaluate` several times can choose which receipt to save; the browser only sends the first attempt. the questions come from the `ai` function and are not signed, so a user can practise on questions of
their own choosing; a valid session can be saved again (within the daily cap) because `mock_sessions` has no column to remember it.

Deploy: `supabase functions deploy score-interview --project-ref ruibdsvrcctxgxctaxwe`. The site uses it unless built with `VITE_SERVER_SCORING=false`.

## Delivery figures (voice practice)

`evaluate` accepts an optional `delivery` object for a **spoken** answer: six numbers measured in the browser (`speechSec`, `totalSec`, `speechPercent`, `longPauses`, `longestPauseSec`, optional `paceWhileSpeakingWpm`). `sanitizeDelivery` (in `_shared/interviewScoring.js`) keeps only those six, as bounded numbers; anything else is ignored.

- With valid figures the prompt gets a "Delivery measurements" block and the model also writes a short `delivery` coaching text. Without them the prompt and the reply are exactly as before.
- The text is checked by code (`deliveryTextOk`): it may only use the measured figures, may not state that the candidate is nervous or anxious, and may not give an ideal range or call a figure too fast or too slow. A text that fails is dropped; the rest of the feedback is returned.
- The score is judged on the content only. The receipt signs the score and does not include the delivery text, and `save` stores no delivery data.
- Redeploy needed after this change: `supabase functions deploy score-interview --project-ref ruibdsvrcctxgxctaxwe`. Old web builds simply never send `delivery`; a new web build against an old function gets no `delivery` text back.
