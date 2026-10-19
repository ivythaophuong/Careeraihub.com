# Metric contract: the interview figures shown in the app

Status: **CONTRACT (descriptive). No code, SQL, secret or deploy accompanies it.** Written 2026-10-19 for the product owner (Ivy). It records what each interview figure means today, so that a screen, a test or a future change (for example decision X in `MAP-mock-interview-score-readers-2026-10-18.md`) names the figure it touches. It decides nothing about which figure the product should use.
Labels: **VERIFIED-CODE** (read and confirmed in the repo at main d754a05) · **VERIFIED-PRODUCTION-LOGIC** (the deployed function or policy was read on production on 2026-10-19 with a read-only query) · **VERIFIED-DATA** (an aggregate count was run on production on 2026-10-19; counts only, no personal data) · **UNKNOWN-DATA** (not queried, so it is not known whether real rows hit the case) · PROPOSED. Reading how a function treats a case proves the logic, not that production data contains the case.

## 1. The figures

| # | Name | Formula | Inputs | Enough data when | Not enough data shows | Where it is shown |
|---|---|---|---|---|---|---|
| M1 | Question score | The AI grades the answer 0 to 100 | The first attempt at a question | The question is not skipped | no score | Feedback after each answer |
| M2 | Session score | Mean of the answered questions, rounded (`summarize` in `supabase/functions/_shared/interviewScoring.js`) | M1 of the first attempts; skipped questions are left out | At least 1 answered question | `null` | Session summary, session history list |
| M3 | **Latest session** | `avg_score` of the newest session (`latestSessionScore`, `src/lib/interviewFigures.js`) | `mock_sessions.avg_score`, newest first | The newest session has a finite `avg_score` | `null`, shown as "—" or "none yet", never 0 | Dashboard, Career Roadmap, Interview Coach overview (as the input of the next-step card) |
| M4 | **Radar interview axis** | Mean of up to 5 newest sessions; non-finite values dropped before the mean (`buildEvidence` in `WeaknessRadar.jsx`) | `avgScore`, or the older `score` field | At least `MIN_EVIDENCE` = 2 sessions | "Not enough evidence yet" | Weakness Radar |
| M5 | **Interview Sim (AI estimate)** | `ROUND(AVG(avg_score))` over the user's 5 newest sessions by `created_at`, inside `recompute_trust_score` | `mock_sessions.avg_score` | **None: with no session it stores 0** | `0` is stored and shown | Trust Match breakdown (weight 0.35). The Employer Portal code reads it too. Production state read 2026-10-19 (VERIFIED-PRODUCTION-LOGIC): the policy "recruiters can read visible profiles" no longer exists on `candidate_trust_profiles`, so a recruiter has no direct read of the table, and `employer_view_candidates` returns only name, headline, bio, skills, location, work preference, salary range, currency, consented parts and expiry (no score column). The code branch that reads the table directly (flag off) therefore gets no rows. Not tested with a signed-in recruiter (none is verified) |

M1 is an AI-generated assessment score. M2 to M5 are aggregates derived from M1, of different scope: M2 is one session, M3 is the newest single session, M4 and M5 are means over several sessions. None of them is an independently validated measure of how well a person will do in a real interview. The screens carry the words "AI estimate" in different places.

## 2. Where the definitions differ (VERIFIED-CODE and VERIFIED-PRODUCTION-LOGIC, except where marked)

1. **Two questions, two figures.** M3 answers "how did my last session go?"; M4 and M5 answer "how have my recent sessions gone?". They are not wrong together; they were shown under similar names ("readiness", "interview") until PR #176 renamed M3.
2. **M4 and M5 are both "mean of 5" but are computed by two different pieces of code** (the browser and the database function) and can differ:
   - With one session: M4 shows nothing (needs 2), M5 uses that session.
   - With a session whose `avg_score` is empty: the database takes the 5 newest rows first and the mean skips the empty one; the browser drops the empty one and then takes 5.
   - M4 reads `avgScore ?? score` (a legacy field); M5 reads only `avg_score`.
   **Production data, read 2026-10-19 (VERIFIED-DATA):** 9 sessions from 6 users; **0 sessions with an empty `avg_score`**; 2 sessions with `avg_score` 0 (whether those are real zero scores or something else is UNKNOWN-DATA). For the users who have both figures, **M4 and M5 never differ** (0 of the users with 2 or more sessions). 4 of the 6 users have fewer than 2 sessions, so M4 would show nothing for them while M5 holds a value. So the first case above (one session) occurs; the empty-score case does not occur today.
3. **M5 turns "no data" into 0** (VERIFIED-PRODUCTION-LOGIC; in `candidate_trust_profiles`, 7 profiles, `interview_score` is 0 on 2, `ats_score` on 5, `star_score` on 5, VERIFIED-DATA; a stored 0 cannot be told apart from a real score of 0). `recompute_trust_score` uses `COALESCE(..., 0)` for the interview, ATS and STAR parts and adds them to `trust_score` (0.40, 0.35, 0.25). A person with no session has `interview_score` 0, which is "unknown", not "weak". This is why the Dashboard can still show "Practice score 0/100". It is a property of the stored data, so it is not a display fix. (The Roadmap and the Trust Match screens treat 0 as "not done" in places; see `TrustMatch.jsx` `done: !!(trustProfile?.interview_score)`.)
4. The same function takes the ATS part from `MAX(credibility_score)` while its own comment says "Latest ATS scan score". Out of scope here; recorded so it is not lost.
5. "First attempt counts" is carried in the signed receipt, but `score-interview/handler.js` says the rule is kept by the browser (no session or ledger table at the time it was written). How strictly the server enforces it today is UNKNOWN-DATA and UNKNOWN-CODE (not re-read).

## 3. Rules for anyone who changes or displays a figure (PROPOSED)

1. A figure is shown under its own name (M3 "Latest session", M4 "Average of your last N practice sessions", M5 "Interview Sim (AI estimate)"). "Readiness", "Interview Ready" and similar words are not used for any of them: they claim more than a score of one or five practice sessions shows.
2. Unknown is `null` in code and a dash or words on screen. It is never 0, and never a coloured band.
3. A milestone ("75 and 5 stories") says in its own text which figure it reads. Today the step "Practice interviews" and the milestone "Latest interview session > 75" read M3. Whether that condition is the right one for a milestone (one session versus a stable level) is an **owner decision, not taken**.
4. M5 keeps its meaning until the owner decides otherwise (Trust Score and what a recruiter sees depend on it). Changing M5 is a database change with its own script, replica test and approval.
5. Any new figure (for example a rule-based Structure Score) gets its own row here, with a type and version, and is not added to M2 to M5.

## 4. Not verified

- (Now answered, see 2.2: no empty `avg_score`; M4 and M5 do not differ today.) Whether the 2 sessions with `avg_score` 0 are real zero scores.
- The exact wording on the Trust Match screen of what "Interview Sim" covers beyond the label.
- Whether recomputation order for sessions with the same `created_at` matters in practice.

## 5. Possible next steps (each needs the owner's approval)

1. Done on 2026-10-19 (aggregates only), see 2.2. Repeat it when the number of sessions has grown.
2. Decide the milestone condition (one session, or a mean over several, with a minimum).
3. Decide how "no data" is represented in `candidate_trust_profiles`. This is not a swap of 0 for `NULL`. It needs a contract for the whole Trust Score first: (a) the state "no data"; (b) the formula when one or more components are missing (today they count as 0 with fixed weights 0.40, 0.35, 0.25); (c) what the candidate and a recruiter see; (d) compatibility with the existing queries, the triggers (`trg_trust_on_*`, `lock_trust_columns`), `TrustMatch` (`!!interview_score`), the Employer Portal and the tests. A separate design and approval; nothing is changed before that.
