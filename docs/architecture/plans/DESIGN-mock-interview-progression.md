# Design: guided practice progression for Mock Interview (Challenge x Interaction)

Status: **DESIGN ONLY. No code, SQL, scoring or production change.** Written 2026-10-13 from the owner's product direction. Needs owner approval of section 6 before any implementation brief.
Labels: OWNER (direction given by the owner) · VERIFIED (read in repo) · PROPOSED · UNKNOWN · APPROVAL.

Principle (OWNER): *Start comfortably. Build confidence. Add pressure gradually. Simulate when ready.* Levels are guidance for practice, never a judgement of ability, never a lock.

## 1. Two axes, not one ladder (OWNER, adopted)

| Axis | Values | Available now |
|---|---|---|
| Challenge | Untimed → Timed → Full simulation | Untimed only |
| Interaction | Text → Voice | Text only |
| Feedback loop | Review → Improve → Retry | exists (more detail, try again; first attempt counts) |

The owner's four levels are named points on these axes: L1 = Untimed + Text; L2 = Timed + Text; L3 = Untimed (prep time) + Voice; L4 = Simulation + Voice. A user may take Timed + Text as far as they like without ever using voice. Voice is an option, never a prerequisite.

## 2. Guidance after a session, not gates (OWNER, adopted)

After a finished session the results screen offers one next step with a plain reason, and always the options: take the challenge · review feedback first · continue at my own pace · preview the next step. Struggling suggests going back, in neutral words, never "not ready". Nothing is locked; every level is reachable from the start screen once it exists.

**What the suggestion may be based on (PROPOSED, needs APPROVAL):** the user's own history that the app already holds (`memory.mockSessions`: number of finished sessions, whether they used retries) and the user's choice. **Not** the AI score. Reasons: the AI answer score is one noisy estimate (`docs/audits/STAR-VARIANCE-RESULTS-2026-10-12.md` measured the movement for STAR; interview scores were never measured the same way), ADR-011/013 say no AI number is evidence, and thresholds on it would be arbitrary. "Ready" will mean "you have done this and chose to continue" until a deterministic structure check exists (Structure Score gate, `ENABLED_LANGUAGES` is empty).

## 3. Fit with decisions already on record

| Direction | On record | Resolution |
|---|---|---|
| Timed practice | ADR-012 #4: no browser-behaviour signals; `DESIGN-mock-interview-tier0.md` D7: optional timer, hidden by default, counts up, does not cut an answer; contract: practice has no mandatory hard deadline | A timed level is compatible only as an **opt-in challenge the user starts**, with a **soft limit**: at zero the screen says time is up, **the typed answer is never discarded**, the user may submit it. Time never changes the score and is never a cheating signal. Needs APPROVAL as a refinement of D7 (the timer becomes a user-selected target, still not a cut-off) |
| Time measured by the browser | clock is client-side | informational only; never stored as evidence; server-measured time exists only if a signed `start` is built later (deferred) |
| "Limit editing after completion" (L4) | none | allowed as a UX rule for the simulation (an answer is final once submitted); today the first attempt already counts and retries are practice-only |
| Voice and voice-quality feedback | ADR-012 #7 and contract section 10: provider, retention, privacy, duration, cost undecided | L3 and L4 stay **designed, unavailable**. "Voice delivery feedback" (pace, fillers) is out of scope until data and consent exist. Content feedback from a transcript only |
| Progress shown to the user | ADR-013 Q-E: counts, not scores; never claim progress or readiness from activity alone | show counts and "what you tried" ("3 untimed sessions, 1 timed"), never "level 2 achieved" as a skill claim. Use words like "next challenge", not "unlocked" |
| Practice vs recruiters / Trust Score | ADR-012 #3, ADR-013 | unchanged. Timed or simulated sessions write the same `mock_sessions` row today, so **they would also feed `trust_score`**. A harder mode must not be presented as stronger evidence; the row carries no challenge type (columns: `mode` = persona) |

## 4. What each stage needs (PROPOSED sequence)

1. **Foundation (done in PR 2a, not committed):** reliable text flow, device-kept draft, honest states. Still missing before progression is trustworthy: server record of "answer saved / feedback ready / session complete" (Track 2 SQL).
2. **Guided next step (no SQL):** results-screen suggestion built from `memory.mockSessions` and the user's choice; copy in one reviewable file (as `consentCopy.js` does); tests that it never locks, never mentions ability, never uses the AI score.
3. **Timed text (no SQL, after APPROVAL of the soft-limit rule):** user picks a limit (the values are the owner's product choice; the owner suggested 2 to 3 minutes per question as a starting point, not yet approved as a value), count-down, "time is up" state that keeps the answer, an easy switch back to untimed. Whether the timed flag is stored with the session needs the SQL proposal (`mock_sessions` has no column for it: UNKNOWN until read).
4. **Voice (blocked):** needs the decisions in `docs/audits/INTERVIEW-CONSTRAINTS-PHASE0-AUDIT.md` section 11 item 7 and the session ledger.
5. **Simulation (blocked on 4):** chained questions, prep time and answer time from the exercise configuration, final summary and a next step.

## 5. Risks

- Counting time can feel like surveillance: keep it opt-in, count-down only for a mode the user chose, no timing stored as a score input.
- A timed mode can raise the harm of an unreliable AI score; keep the AI-estimate label on every timed result.
- "Level" wording can read as a grade; use "challenge", never "rank", "tier" or badges.
- Storing progress server-side is a privacy and retention decision (N2 open); until then progress is derived, not stored.

## 6. Decisions needed from the owner

| # | Decision | Recommendation |
|---|---|---|
| P1 | Adopt the two-axis model and the "Start comfortably..." principle as the product direction for Mock Interview | Yes |
| P2 | The next-step suggestion may use finished-session counts and the user's choice, and must not use the AI score | Yes |
| P3 | Timed practice is an opt-in challenge with a soft limit; the answer is kept at zero; time never affects the score (refines D7) | Yes |
| P4 | The default time values for the timed challenge | Owner to choose; assistant has no data (no timing measurements exist) |
| P5 | Voice (L3) and simulation (L4) stay unavailable until their separate decisions | Yes |
| P6 | Order: finish the foundation and server session record first, then guidance, then timed, then voice | Yes |
