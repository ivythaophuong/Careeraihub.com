# Metric contract: the interview figures shown in the app

Status: **CONTRACT (descriptive). No code, SQL, secret or deploy accompanies it.** Written 2026-10-19 for the product owner (Ivy). It records what each interview figure means today, so that a screen, a test or a future change (for example decision X in `MAP-mock-interview-score-readers-2026-10-18.md`) names the figure it touches. It decides nothing about which figure the product should use.
Labels: VERIFIED (read in the repo at main d754a05, or read from production on 2026-10-19 with a read-only query) · UNKNOWN · PROPOSED.

## 1. The figures

| # | Name | Formula | Inputs | Enough data when | Not enough data shows | Where it is shown |
|---|---|---|---|---|---|---|
| M1 | Question score | The AI grades the answer 0 to 100 | The first attempt at a question | The question is not skipped | no score | Feedback after each answer |
| M2 | Session score | Mean of the answered questions, rounded (`summarize` in `supabase/functions/_shared/interviewScoring.js`) | M1 of the first attempts; skipped questions are left out | At least 1 answered question | `null` | Session summary, session history list |
| M3 | **Latest session** | `avg_score` of the newest session (`latestSessionScore`, `src/lib/interviewFigures.js`) | `mock_sessions.avg_score`, newest first | The newest session has a finite `avg_score` | `null`, shown as "—" or "none yet", never 0 | Dashboard, Career Roadmap, Interview Coach overview (as the input of the next-step card) |
| M4 | **Radar interview axis** | Mean of up to 5 newest sessions; non-finite values dropped before the mean (`buildEvidence` in `WeaknessRadar.jsx`) | `avgScore`, or the older `score` field | At least `MIN_EVIDENCE` = 2 sessions | "Not enough evidence yet" | Weakness Radar |
| M5 | **Interview Sim (AI estimate)** | `ROUND(AVG(avg_score))` over the user's 5 newest sessions by `created_at`, inside `recompute_trust_score` | `mock_sessions.avg_score` | **None: with no session it stores 0** | `0` is stored and shown | Trust Match breakdown (weight 0.35). The Employer Portal code reads it too, but since the consent-only script of 2026-10-19 a recruiter has no direct read of the table and `employer_view_candidates` returns no scores |

All of M2 to M5 are AI estimates: M1 is set by the model, and the others are means of it. The screens carry the words "AI estimate" in different places; no figure is a measure of how well a person will do in a real interview.

## 2. Where the definitions differ (VERIFIED)

1. **Two questions, two figures.** M3 answers "how did my last session go?"; M4 and M5 answer "how have my recent sessions gone?". They are not wrong together; they were shown under similar names ("readiness", "interview") until PR #176 renamed M3.
2. **M4 and M5 are both "mean of 5" but are computed by two different pieces of code** (the browser and the database function) and can differ:
   - With one session: M4 shows nothing (needs 2), M5 uses that session.
   - With a session whose `avg_score` is empty: the database takes the 5 newest rows first and the mean skips the empty one; the browser drops the empty one and then takes 5.
   - M4 reads `avgScore ?? score` (a legacy field); M5 reads only `avg_score`.
   Whether real data hits these cases is UNKNOWN (not queried for empty `avg_score`).
3. **M5 turns "no data" into 0.** `recompute_trust_score` uses `COALESCE(..., 0)` for the interview, ATS and STAR parts and adds them to `trust_score` (0.40, 0.35, 0.25). A person with no session has `interview_score` 0, which is "unknown", not "weak". This is why the Dashboard can still show "Practice score 0/100". It is a property of the stored data, so it is not a display fix. (The Roadmap and the Trust Match screens treat 0 as "not done" in places; see `TrustMatch.jsx` `done: !!(trustProfile?.interview_score)`.)
4. The same function takes the ATS part from `MAX(credibility_score)` while its own comment says "Latest ATS scan score". Out of scope here; recorded so it is not lost.
5. "First attempt counts" is carried in the signed receipt, but `score-interview/handler.js` says the rule is kept by the browser (no session or ledger table at the time it was written). How strictly the server enforces it today is UNKNOWN.

## 3. Rules for anyone who changes or displays a figure (PROPOSED)

1. A figure is shown under its own name (M3 "Latest session", M4 "Average of your last N practice sessions", M5 "Interview Sim (AI estimate)"). "Readiness", "Interview Ready" and similar words are not used for any of them: they claim more than a score of one or five practice sessions shows.
2. Unknown is `null` in code and a dash or words on screen. It is never 0, and never a coloured band.
3. A milestone ("75 and 5 stories") says in its own text which figure it reads. Today the step "Practice interviews" and the milestone "Latest interview session > 75" read M3. Whether that condition is the right one for a milestone (one session versus a stable level) is an **owner decision, not taken**.
4. M5 keeps its meaning until the owner decides otherwise (Trust Score and what a recruiter sees depend on it). Changing M5 is a database change with its own script, replica test and approval.
5. Any new figure (for example a rule-based Structure Score) gets its own row here, with a type and version, and is not added to M2 to M5.

## 4. Not verified

- Whether real rows have an empty `avg_score`, and whether M4 and M5 differ for any real user today.
- The exact wording on the Trust Match screen of what "Interview Sim" covers beyond the label.
- Whether recomputation order for sessions with the same `created_at` matters in practice.

## 5. Possible next steps (each needs the owner's approval)

1. A read-only query counting sessions with empty `avg_score` and users whose M4 and M5 would differ. No change.
2. Decide the milestone condition (one session, or a mean over several, with a minimum).
3. Decide whether "no data" should be stored as `NULL` in `candidate_trust_profiles` instead of 0. It touches the Trust Score formula and the Employer Portal; a separate design and approval.
