# Plan: stop putting interview questions, answers and tips into account backups (E1)

Status: **PLAN ONLY; owner design decisions on E1a, E1b and E1c recorded 2026-10-22 (section 3). They are not an instruction to change code. No code, SQL, secret, deploy or deletion accompanies it.** Written 2026-10-22 for the product owner (Ivy). Language: English.
Labels: VERIFIED (read in source on 2026-10-22, `origin/main`) · INFERRED (follows from source, not run) · UNKNOWN · APPROVAL.
Follows: `DECISION-dynamic-interview-engine-2026-10-22.md` (E1, direction approved) and `REVIEW-answer-text-data-lineage-2026-10-22.md`.

## 1. The change in one sentence

When a finished mock session is added to memory, the stored record keeps no `question`, `answer` or `tip` (E1a). Nothing else about scoring, saving, the signed receipt or the voice unlock changes.

## 2. Where the code is (VERIFIED)

- `buildSessionRecord` in `src/features/HiringManagerSim/interview.js` builds the record. Its `questions` list holds `question`, `focus`, `skipped`, `score`, `verdict`, `answer`, `tip` per question.
- It is called in two places in `HiringManagerSim.jsx` (the server-scoring path and the legacy browser path), so one change in the function covers both.
- `useMemory.js` `toBackup` removes only two unrelated keys; `mockSessions` therefore goes into `user_memory.data`.
- Readers of `mockSessions` use `avgScore`, `questionsCount`, `date`, `id`, `personaLabel` and `role` (`HiringManagerSim` recent-sessions list, `Dashboard`, `CareerRoadmap`, `WeaknessRadar`, `InterviewCoach`, `AICoach`, `MemoryDashboard`). None was found reading `questions[].answer` or `.tip`. The results screen of the running session uses its own in-memory `results`, not the stored record (VERIFIED by reading the summary section).
- `src/features/HiringManagerSim/sessionRoundTrip.test.js` builds a record from results that include `answer` and checks the score columns only, so it does not depend on the answer being kept.

## 3. Owner decisions (2026-10-22)

| # | Decision | Status |
|---|---|---|
| E1a | The stored record drops `question`, `answer` and `tip`. It keeps `focus`, `score`, `verdict`, `skipped` and the fields the summaries and statistics need. The running session still holds questions and answers in memory so the interview and the results screen work. Condition: every consumer of the stored record is checked before the change | Agreed as design direction |
| E1b | No automatic cleanup of historical data inside E1. A cleanup is a separate step: count and locate records, assess impact, ask for approval. Test results about the two backup branches (section 5) do not replace checking real data | Decided: out of E1 |
| E1c | "Clear memory" must report failure honestly: all deletes succeeded, some failed, or state unknown. Wording and place below | Agreed as design direction; wording to confirm when built |

None of this authorises code, push, PR, merge, SQL or production change. Code starts only when the owner says "do it" for this plan.

### E1c in detail (VERIFIED facts first)

- Today `clearMemory` calls `setCleared(true)` first, and the page then shows "Memory cleared. Fresh start!" (`MemoryDashboard.jsx` lines 70 and 122) before any delete has finished or failed. So the current message can be wrong.
- `sb.delete` throws on a non-OK answer (`src/lib/supabase.js`), and the deletes run in `Promise.allSettled`, so a failed table shows up as a `rejected` result that is currently ignored. The failure is therefore detectable (VERIFIED in code).
- The deletes run only when `user.id` and `user.token` exist. Without them nothing is deleted on the server and the message must not say it was.
- The account backup (`user_memory`) is rewritten by the normal backup after memory is emptied; its success or failure shows through the existing `syncError`. Whether that write finished at the time of the message is UNKNOWN to the dashboard today.

Three outcomes the screen must tell apart:

| Outcome | Condition | Message idea |
|---|---|---|
| Complete | every table delete settled fulfilled, and a signed-in user | A completion message that names only what was verified (the tables), not "all data" |
| Incomplete | at least one table delete rejected | The proposed text: "Some data could not be deleted yet. The remaining records may still contain information you asked to delete. Please try again or contact support." Names the tables that failed if a plain list is possible |
| Unknown | no token, or the backup write result is not known | No claim of deletion; say what is known |

Where: in the Clear memory area of the Memory Dashboard, replacing the success card. The text is the owner's proposal; the exact wording and the support contact (an address exists in the privacy page, section 8) are confirmed when it is built. This plan adds no new button or section.

## 4. Tests first (written and failing before any code)

1. `buildSessionRecord` output contains no `question`, `answer` or `tip` key on any question, for answered, skipped and retried results. The same assertion on the full serialised record (a string search for a known answer text finds nothing).
2. The record still has `avgScore`, `questionsCount`, `skipped`, `persona`, `personaLabel`, `role`, `date`, `id`, and each question's `focus`, `score`, `verdict`, `skipped`; and has no `question` text.
3. `toSessionRow` is unchanged (`avg_score`, `questions_count`, `mode`).
4. Backup payload: with a memory object holding a new session record, `toBackup(state)` serialised contains no text taken from the answer or the tip. This checks the whole path, not only the builder.
5. Round trip: `sessionRoundTrip.test.js` still passes unchanged.
6. The signed-receipt tests (`score-interview` handlers) and `voiceunlock` tests pass unchanged, to show the browser still sends the answer to the server for grading and receipts. The server still receives the answer to grade it; this plan does not change that.
7. A test that the summary screen of the running session still shows the answers and tips (they come from `results`, not from the stored record).
8. Every consumer of a stored record still renders from a record without `question`: the recent-sessions list, `Dashboard`, `CareerRoadmap`, `WeaknessRadar`, `InterviewCoach`, `AICoach`, `MemoryDashboard`, and the older-shape records already in memory (records that still have the removed fields must not break anything).
9. Clear memory (E1c, may be a second pull request): with all deletes resolved, the completion message appears and no failure text; with one rejected delete, the incomplete message appears and no success text; with no token, neither success nor deletion is claimed; the success card is not shown before the deletes settle.
10. The two backup branches in section 5: `mock_sessions` returns rows (the written backup holds no answer text) and returns nothing (old answers in the backup are written back). The second case is documented as a known limit, not fixed in E1.

## 5. What happens to records already stored (INFERRED, to be proved by a test)

- When `mock_sessions` returns at least one row on load, `useMemory` fills `mockSessions` from those rows, which have no answers (`useMemory.js` line 105). The next time a session is added, the whole list is written to the backup, so the old answer-bearing array in `user_memory.data` is replaced by an answer-free one. That would clean the backup for those users as a side effect, but only after they finish another session, and only if the table has rows.
- If `mock_sessions` returns nothing, memory is filled from the backup, old answers included, and they are written back on the next session.
- A test must show both cases before this plan claims anything about history. Until then, the statement is: **new saves stop adding answer text; existing text may remain until a separate cleanup.**
- A cleanup of existing backups (E1b, or a one-time job) is not in this plan. It needs a count first (lineage review, section 5), the owner's approval, and a statement of what it cannot reach (providers, logs, database backups).

## 6. Behaviour when the backup fails

Unchanged: a failed backup shows the existing sync error and keeps the changed keys marked so the next write carries them (`useMemory.js`). With this change a failure also leaves no answer text in the unsent payload. Nothing new is needed.

## 7. What this does not do

It does not delete any stored data, change the database, change what is sent to the AI provider for grading, change the receipt, change "Clear memory", or tell users anything new. The privacy page wording about answers (`legalContent.js`) is the owner's legal-wording matter and is not edited here.

## 8. Size and order

One small pull request: the failing tests, then the change in `buildSessionRecord`, then a green run of `npm test`. With E1a decided, the same pull request updates the tests that read `questions[].question` from a stored record (none found outside `interview.test.js`; UNKNOWN until the tests are run). "Clear memory" feedback is a second pull request, after the owner approves the wording.

## 9. Not verified

Production contents; the real count of backups with answer text; whether any test or screen reads a stored `answer` through a path the grep missed; the behaviour in section 5 (inferred only); provider, log and external backup copies.
