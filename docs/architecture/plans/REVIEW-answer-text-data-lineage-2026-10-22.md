# Review: where interview answer text goes (read-only data-lineage, D-1 condition 1)

Status: **REVIEW OF SOURCE ONLY. Nothing changed in code, database, secrets or production, and no production record was read.** Written 2026-10-22 for the product owner (Ivy). Language: English.
Labels: VERIFIED (read in this repository on 2026-10-22, `origin/main` after PR #221) · UNKNOWN (needs a read of production, logs or a provider) · PROPOSED.
Answers `DECISION-dynamic-interview-engine-2026-10-22.md`, section 1 (D-1) and section 4 condition 1. It does not decide retention and does not delete anything.

## 1. The flow of one answer

| # | Place | What holds the answer text | Evidence |
|---|---|---|---|
| 1 | Browser memory while typing | The answer in component state, and the transcript for a spoken answer | `HiringManagerSim.jsx` |
| 2 | Browser `sessionStorage` | A "kept on this device" snapshot of the running session; dropped when the tab closes; `clearAllDeviceSessions` removes all of them at sign-out | `deviceSession.js` (VERIFIED) |
| 3 | The `score-interview` Edge Function, then an AI provider | Question, answer (max 3,000 characters) and up to 4,000 characters of the resume go to the provider inside the grading prompt | `interviewScoring.js`, `score-interview/handler.js` (VERIFIED) |
| 4 | Signed receipt | An HMAC over user, time, persona, question, answer and score. The receipt holds a signature, not the text; the browser sends the answer again on `save` so the server can recompute it | `handler.js` (VERIFIED) |
| 5 | `mock_sessions` row | `avg_score`, `questions_count`, `mode` only. No answer column is written | `toSessionRow`, `save` insert (VERIFIED in code; the live table's columns are UNKNOWN) |
| 6 | In-app memory, then `user_memory.data` | `buildSessionRecord` stores per question: `question`, `focus`, `answer`, `tip`, `score`, `verdict` in `mockSessions` (last 20 sessions). `updateMemory` marks it for backup and `toBackup` removes only `scanPdfBase64` and `originalFileUrl`, so the record is upserted into the `user_memory` JSON | `interview.js`, `HiringManagerSim.jsx` lines 247 and 259, `useMemory.js` (VERIFIED in code; production rows UNKNOWN) |
| 7 | Reload | When `mock_sessions` returns rows they replace `mockSessions` in memory, and these rows have no answers. The stored `user_memory` copy is still not removed by a reload | `useMemory.js` line 105 (VERIFIED) |
| 8 | Usage log | `[usage]` events carry feature, user reference (salted hash), provider, model, token counts, cost, resume kind and character count. `buildEvent` lists the only fields allowed. No prompt or answer text | `usage.js` (VERIFIED) |
| 9 | Practice ledger | The ledger code states that only hashes, counts and ids reach it, and computes a payload hash | `ledger.js` header and `payloadHash` (VERIFIED; the live ledger tables were not read) |
| 10 | Server error logs | Messages name the function and a status or kind; none prints a body, prompt or answer | `console.error` calls in `ai` and `score-interview` handlers (VERIFIED) |
| 11 | Voice | The audio goes to `transcribe`; the log line has feature, provider, seconds and outcome, no audio or text | `transcribe/handler.js` (VERIFIED); what the speech provider retains is UNKNOWN |
| 12 | Analytics | No analytics or error-tracking library found in `src`, `index.html` or `package.json` | grep (VERIFIED for the repo; the hosting side and Nginx logs UNKNOWN) |

## 2. Readers of the stored answer

No screen was found that reads `answer` or `tip` back from `mockSessions`. The readers found use counts and scores (`CareerRoadmap`, `Dashboard`, `AICoach`, `InterviewCoach`, `MemoryDashboard`) or the session list in `HiringManagerSim` (`history`, first five). So the stored text appears to serve **no feature today** (VERIFIED by grep of consumers; a missed consumer is possible, so a code owner should recheck before removal).

## 3. What the wording promises

`src/features/Legal/legalContent.js` line 19 lists "practice interview and STAR answers (text)" among the content collected, and line 39 says career data saved in the account stays until the user deletes it, with "Clear memory" in the Memory Dashboard and deletion by email. So the policy **does** say answers may be kept. It does not say that the last 20 sessions' answer text sits in one JSON backup, or that the backup is separate from the `mock_sessions` table. Whether "Clear memory" empties `user_memory.data` for `mockSessions` was not traced (UNKNOWN).

The same page names OpenAI as the main provider and Groq as the backup. The routing documents in this repository describe Groq as the measured primary and the live secrets are held by the owner, so the provider sentence may be out of date (UNKNOWN; check against the live `AI_PROVIDER` before anyone relies on the page).

## 3b. What "Clear memory" does (VERIFIED in code, `MemoryDashboard.jsx` `clearMemory`)

- It sets `mockSessions` (and every other list) to empty in memory. Because the keys change, `updateMemory` marks them for the account backup, and the next backup write replaces `user_memory.data.mockSessions` with an empty list.
- It also deletes the user's rows in `resume_scans`, `star_stories`, `mock_sessions`, `cover_letters`, `jd_analyses`, `applications`, `negotiation_practice` and `insights`. The deletes use `Promise.allSettled`, so a failure is not reported to the user.
- Limits: if the backup is locked or fails (ADR-006 behaviour), the old text stays in `user_memory`; this review did not run the path against a real account (UNKNOWN). It does not touch provider copies, host logs or any database backup outside the application.

## 3c. Three things that must not be conflated

1. **Stop writing answer text to account backups from now on** (code change, local, testable).
2. **Delete historical text already in `user_memory`** (needs a count, a scope and the owner's approval; "Clear memory" is the user's own path, not an operator cleanup).
3. **Anything at providers, in logs or in database backups** (cannot be inferred from a change to `toBackup`; each needs its own check).

`tip` is advice generated from the answer, so it can echo parts of it. Keeping `tip` while dropping `answer` may not meet a goal of holding less personal career text; this is a decision for the owner (E1), not an assumption.

## 4. What this means for D-1

- **Future-only change is small and local:** stop writing `answer` (and decide about `tip`) into the session record that goes to memory. Nothing found reads it. Tests that now expect the answer in the record would change.
- **Existing records are untouched by that change.** Old `user_memory` rows keep their text until a separate, owner-approved step. The repository cannot show how many rows have it.
- **Two retention behaviours need a decision, not a guess (see 3c):** whether `tip` stays (it is the model's advice, derived from the answer) and whether the in-session answer shown on the results screen stays as it is (it is browser-only, so probably yes).
- **Provider retention is not answered here.** Terms are read in `AI-PROVIDER-DATA-TERMS-2026-10-13.md`; live account settings are UNKNOWN.
- **Wording:** after a change, the policy line should say what is kept. That is a legal-wording matter for the owner.

## 5. Read-only checks the owner can run (PROPOSED; nobody runs SQL for her)

1. In the SQL Editor, a count of `user_memory` rows whose `data->'mockSessions'` has any element with a non-empty `answer`. A count only; no text is read.
2. The columns of `mock_sessions` (information_schema), to settle whether a rubric version could ever be stored there.
3. Whether the Memory Dashboard "Clear memory" action also resets `data->'mockSessions'` (a code trace first; no data needed).
4. The live `AI_PROVIDER` and fallbacks against the privacy page.

## 6. Not verified

Production contents; the live ledger tables; host and proxy logs; provider-side retention; speech-provider retention; whether another module reads `mockSessions` answers through a path this grep missed.
