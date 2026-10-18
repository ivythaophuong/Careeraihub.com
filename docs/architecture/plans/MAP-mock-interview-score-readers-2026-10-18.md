# Map: who writes and who reads the Mock Interview score (step P0)

Status: **MAP. Read-only research. No code, SQL, secret or deploy accompanies it.** Written 2026-10-18 for the product owner (Ivy). It is the groundwork that `D1-interview-structure-calibration-standard-2026-10-18.md` and `PLAN-voice-and-deterministic-first-2026-10-18.md` ask for before any wiring: "read the code path of `mock_sessions` and every place that reads a score".
Labels: VERIFIED (read in the repo at main `ae1c651`, or read from production on 2026-10-18 with read-only queries) · UNKNOWN · PROPOSED.
Purpose: if the owner later decides to replace the AI-set interview number by the rule-based Structure Score (decision X), this is the list of everything that touches the number, so nothing is changed blind. **This map does not make that decision.**

## 1. The path of one score

```
 browser   HiringManagerSim: the person answers
   |  POST score-interview { action: 'evaluate' }  (the answer text goes to the function; not stored)
 server    score-interview: calls the AI (callWithFallback), AI returns score 0-100 + feedback
   |  signs a receipt (HMAC over user, time, persona, question, answer, score) and returns it
 browser   keeps each graded answer and its receipt in memory (and a device copy in sessionStorage)
   |  POST score-interview { action: 'save', items: [{question, answer, score, ts, sig}] }
 server    checks every receipt, one score per question, computes the average itself, inserts ONE row with the service role
   |  mock_sessions (user_id, mode = persona, questions_count, avg_score)
 database  trigger trg_trust_on_mock_session (insert/update) and trg_trust_on_mock_session_delete
   |  recompute_trust_score(user): interview_score = ROUND(AVG(avg_score of the user's LAST 5 sessions)),
   |  trust_score = ROUND(ats*0.40 + interview*0.35 + star*0.25); upserts candidate_trust_profiles
 readers   screens (section 3), the AI coach prompt, the recruiter policy (section 4)
```
VERIFIED: `score-interview/handler.js` (evaluate, save), `interview.js`, the production bodies of `recompute_trust_score`, `trigger_recompute_trust_score`, `trigger_recompute_trust_score_after_delete` and `lock_trust_columns`.

## 2. Writers of the number

| Writer | What it writes | Status |
|---|---|---|
| `score-interview` `save` (service role) | the `mock_sessions` row, `avg_score` = rounded mean of the **AI** scores of the answers' **first attempts** | the live path |
| The browser's old direct insert (`updateMemory(..., { table: 'mock_sessions' })`, used only when `VITE_SERVER_SCORING=false`) | the same row from the browser | **cannot work in production**: `authenticated` and `anon` hold no `INSERT` or `UPDATE` on `mock_sessions` (read 2026-10-18), so it is dead code behind a flag that is on by default |
| `complete_practice_session` (the ledger function, applied 2026-10-15) | a `mock_sessions` row from the counted, evaluated submissions | **not called by any code yet**; when it is, its average also feeds the trust trigger (section 5) |
| `recompute_trust_score` (trigger, security definer) | `candidate_trust_profiles.interview_score` and `trust_score` | live; browser roles cannot set these (trigger `lock_trust_columns`) |

Production data (read 2026-10-18): **9 session rows from 6 users**, 2026-05-22 to 2026-10-18. Columns of `mock_sessions`: `id`, `user_id`, `mode`, `questions_count`, `avg_score`, `created_at`. There is **no column for the score type or version**, so a rule-based score and an AI score cannot be told apart in the table today (ADR-013 Q-D proposes nullable `score_type` and `score_version`, not applied).

## 3. Readers in the app (all read the AI number)

| Where | What it reads | How it uses it |
|---|---|---|
| `src/hooks/useMemory.js:69, 105` | rows of `mock_sessions` (newest `SESSIONS_KEPT`), `avg_score` mapped to `avgScore` | the one loader every screen below shares |
| `HiringManagerSim` (history list, summary) | each session's `avgScore`; the live session's average from `score-interview` | list and summary, coloured by band, labelled "An AI estimate" |
| `Dashboard.jsx:231` | `mockSessions[0].avgScore` (the **latest** session) | the "readiness" figure |
| `CareerRoadmap.jsx:78, 99-101` | `mockSessions[0].avgScore` (latest) and the trust profile's visibility | readiness and the next actions |
| `InterviewCoach.jsx:46-58` | the session count, `questionsCount`, and `sessions[0].avgScore` | the Overview counts (shown as counts, "do not measure how well you answer") and `nextActions` |
| `WeaknessRadar.jsx:22-27` | the mean of `avgScore` over up to 5 sessions, only when at least `MIN_EVIDENCE` exist | the interview axis |
| `AICoach.jsx:41-43` | the latest `avgScore`, put into the **prompt** as "an AI estimate, based on the first attempt at each question" | the model reads the number |
| `MemoryDashboard.jsx` | counts; lists `mock_sessions` among the tables "Clear memory" removes | deletion and counts |
| `TrustMatch.jsx:295, 324` | `candidate_trust_profiles.interview_score`, labelled "Interview Sim (AI estimate)", weight 0.35 | the candidate's own trust breakdown |
| `EmployerPortal.jsx:733` | `candidate_trust_profiles.interview_score` of candidates the employer may see | recruiter screen (section 4) |

**Inconsistency found (VERIFIED):** the screens use two different "interview" numbers. Dashboard, Roadmap and the Interview Coach use the **latest single session**; the database trust score and the Weakness Radar use the **mean of the last 5 sessions**. The same person can see two different interview figures for the same history. Any change of the score must say which one it means.

## 4. Who can see `interview_score`

Production, read 2026-10-18, table `candidate_trust_profiles`:
- Policy "candidate owns profile": the owner reads and writes their own row (`auth.uid() = user_id`).
- Policy **"recruiters can read visible profiles"**: `is_visible = true AND is_verified_employer_member()`. The consent-only SQL that would replace it (`2026-10-09-consent-only-recruiter-access.sql`) is **not applied**. Read 2026-10-18: **1 employer, 0 verified; 7 candidate profiles, 1 of them visible**. So no recruiter can read a profile today (the policy needs a verified employer member). The standing rule (ADR-013 item 6): no employer is verified until consent-only access is applied, or the owner decides in writing which scores a recruiter may see.
- Browser roles hold **all** privileges (`SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER`) on this table by default. `TRUNCATE` is not subject to row level security; the REST interface does not offer it, so it is probably not reachable (UNKNOWN until checked), but the privilege should be revoked (the same finding as for `mock_sessions`, REV2 section B5, for the older tables).
- The trigger `lock_trust_columns` stops `anon` and `authenticated` from setting the four score columns (insert sets 0, update keeps the old value).

## 5. Things that change if the number changes (checklist for the future ADR)

| # | Item | Why it matters |
|---|---|---|
| 1 | `score-interview` `save` (the average is of AI scores) and the browser summary | the source of the number |
| 2 | The signed receipt (it signs the AI score) | the receipt format would carry the rule score and its version |
| 3 | `mock_sessions` | no score type or version column; the 9 historic rows are AI estimates and must stay distinguishable ("Earlier AI estimate", ADR-013 Q-D) |
| 4 | `recompute_trust_score` (last 5 mean, weight 0.35) | the Trust Score would silently change meaning; the owner's rule for this phase is that it does not change |
| 5 | The ledger function `complete_practice_session` | a second writer of the average (not used yet) |
| 6 | The two "interview" definitions (latest vs last 5) in section 3 | must be unified or named |
| 7 | `AICoach` prompt | the model is told the number is "an AI estimate"; a rule score needs different wording |
| 8 | UI labels and the acceptance rules: "Structure Score" name, a visibly separate rule panel, a beta label, "no AI number shown", distinct states (`insufficient_data`, `unsupported_language`, `processing_error`) | acceptance document section 5 |
| 9 | Recruiter exposure (section 4) | a rule score would reach recruiters through the same policy until consent-only access is applied |
| 10 | Existing tests that pin the AI number (`HiringManagerSim.*.test.jsx`, `interviewScoring` tests, the `score-interview` handler tests) | they would need versioned replacements |

## 6. What this changes in the plan

- D2 (an owner-only rules panel next to the AI feedback) touches **only** `HiringManagerSim` and a read-only call to the scorer: it needs none of the rows above, which is why it can run first.
- Decision X touches **every row in section 5**; it is correct to keep it out of this phase.
- Two fixes that do not need decision X and would be worth doing on their own: revoke the unneeded browser privileges on `candidate_trust_profiles` and `mock_sessions` (a small SQL, tested on a replica first), and name or unify the two "interview" figures in the UI.

## 7. Not verified

Whether `TRUNCATE` for `anon` and `authenticated` is reachable through any exposed interface; the readers inside the landing page demo (a static sample, not read here); any reader outside `src/` and `supabase/` (for example an external dashboard or script reading the table directly).
