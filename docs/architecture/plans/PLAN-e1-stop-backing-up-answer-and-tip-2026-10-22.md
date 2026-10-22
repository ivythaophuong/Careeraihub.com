# Plan: stop putting interview answer text and tips into account backups (E1)

Status: **PLAN ONLY. No code, SQL, secret, deploy or deletion accompanies it.** Written 2026-10-22 for the product owner (Ivy). Language: English.
Labels: VERIFIED (read in source on 2026-10-22, `origin/main`) · INFERRED (follows from source, not run) · UNKNOWN · APPROVAL.
Follows: `DECISION-dynamic-interview-engine-2026-10-22.md` (E1, direction approved) and `REVIEW-answer-text-data-lineage-2026-10-22.md`.

## 1. The change in one sentence

When a finished mock session is added to memory, the stored record keeps no `answer` and no `tip`. Nothing else about scoring, saving, the signed receipt or the voice unlock changes.

## 2. Where the code is (VERIFIED)

- `buildSessionRecord` in `src/features/HiringManagerSim/interview.js` builds the record. Its `questions` list holds `question`, `focus`, `skipped`, `score`, `verdict`, `answer`, `tip` per question.
- It is called in two places in `HiringManagerSim.jsx` (the server-scoring path and the legacy browser path), so one change in the function covers both.
- `useMemory.js` `toBackup` removes only two unrelated keys; `mockSessions` therefore goes into `user_memory.data`.
- Readers of `mockSessions` use `avgScore`, `questionsCount`, `date`, `id`, `personaLabel` and `role` (`HiringManagerSim` recent-sessions list, `Dashboard`, `CareerRoadmap`, `WeaknessRadar`, `InterviewCoach`, `AICoach`, `MemoryDashboard`). None was found reading `questions[].answer` or `.tip`. The results screen of the running session uses its own in-memory `results`, not the stored record (VERIFIED by reading the summary section).
- `src/features/HiringManagerSim/sessionRoundTrip.test.js` builds a record from results that include `answer` and checks the score columns only, so it does not depend on the answer being kept.

## 3. Decisions this plan needs (APPROVAL)

| # | Question | Recommendation |
|---|---|---|
| E1a | Keep `question` and `focus` in the record? | The question text is written by the AI and can refer to the candidate's CV, so it can be personal too. Recommend dropping `question` text as well and keeping `focus` and `score`/`verdict` (small, no free text) unless a screen needs the text. None was found. Owner decides. |
| E1b | Strip answer and tip from records already in memory when the next session is written? | Not decided. This edits historical backup content, so it is a separate approval. See section 5. |
| E1c | Notice when "Clear memory" cannot delete a table | A user-visible message is a UI change; the owner asks for the wording and place first (no invented UI). |

## 4. Tests first (written and failing before any code)

1. `buildSessionRecord` output contains no `answer` and no `tip` key on any question, for answered, skipped and retried results. The same assertion on the full serialised record (a string search for a known answer text finds nothing).
2. The record still has `avgScore`, `questionsCount`, `skipped`, `persona`, `personaLabel`, `role`, `date`, `id`, and each question's `score`, `verdict`, `skipped` (and `focus` if E1a keeps it).
3. `toSessionRow` is unchanged (`avg_score`, `questions_count`, `mode`).
4. Backup payload: with a memory object holding a new session record, `toBackup(state)` serialised contains no text taken from the answer or the tip. This checks the whole path, not only the builder.
5. Round trip: `sessionRoundTrip.test.js` still passes unchanged.
6. The signed-receipt tests (`score-interview` handlers) and `voiceunlock` tests pass unchanged, to show the browser still sends the answer to the server for grading and receipts. The server still receives the answer to grade it; this plan does not change that.
7. A test that the summary screen of the running session still shows the answers and tips (they come from `results`, not from the stored record).

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

One small pull request: the failing tests, then the change in `buildSessionRecord`, then a green run of `npm test`. If E1a drops `question`, the same pull request updates the tests that read `questions[].question` from a stored record (none found outside `interview.test.js`; UNKNOWN until the tests are run). "Clear memory" feedback is a second pull request, after the owner approves the wording.

## 9. Not verified

Production contents; the real count of backups with answer text; whether any test or screen reads a stored `answer` through a path the grep missed; the behaviour in section 5 (inferred only); provider, log and external backup copies.
