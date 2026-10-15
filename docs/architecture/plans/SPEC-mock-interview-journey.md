# Functional spec: the Mock Interview journey (design all of it now, build it in slices)

Status: **SPEC. Owner direction given 2026-10-15; slice 1 (soft timed text and the guided next step) is built on `feat/mock-guided-next-and-timed`, not deployed.** Everything else here is design.
Labels: OWNER (decided by the owner) · VERIFIED (read in repo or measured) · PROPOSED · UNKNOWN · APPROVAL (needs the owner's explicit yes).
Builds on, and does not replace: `DESIGN-mock-interview-progression.md`, `DESIGN-mock-interview-tier0.md`, `PLAN-mock-interview-e2e.md`, `docs/DECISIONS.md` ADR-012 and ADR-013, `docs/audits/INTERVIEW-CONSTRAINTS-PHASE0-AUDIT.md`, `docs/database/proposed/PROPOSAL-practice-session-ledger-2026-10-13.md`.

## 1. Direction and limits

- OWNER: design the whole experience now, build it in vertical slices, each with its own tests and review. Do not finish text practice and then find that timed, voice or simulation do not fit.
- OWNER: scoring and the Trust Score stay as they are during this work, until their effect is audited and decided separately. A timed or simulated session writes the same `mock_sessions` row as today and must not be presented as stronger evidence than an untimed one.
- Standing decisions that apply (VERIFIED in `docs/DECISIONS.md`): no paste, tab-focus or other browser behaviour signals are collected or used to infer cheating (ADR-012 #4); the voice provider, audio storage and recording limits are not decided and no implementer may choose one (ADR-012 limits); a score is an AI estimate for practice, not verified evidence.
- Levels are guidance, never a gate, a rank or a judgement of ability. Words that read as a grade are not used ("rank", "tier", "badge", "unlock", "level achieved"). A test enforces this for the next-step copy.

## 2. Four decisions (the 2026-10-15 questions)

| # | Question | Decision | Why and consequence |
|---|---|---|---|
| D1 | What does voice feedback rest on? | **Transcript first.** Judge the content of the answer. Add delivery feedback (pace, fillers, pronunciation) only when there is a method that can be shown to be reliable. | No reliable delivery measure exists in the repo (UNKNOWN). The audio itself is not an input to scoring in the first version. |
| D2 | What happens when time runs out? | **Soft limit now.** At zero the screen says so; the answer is kept and can still be sent; time never changes a score. The session model carries a `deadlinePolicy` field (`soft` today) so a server-checked deadline can be added later without reshaping the session. | A deadline needs a server only if it changes the result. Score and Trust Score ignore time, so a client timer is enough and cheap (ADR-012 keeps a signed server `start` as a design option, not built). Switch to a server deadline if a session is ever used as evidence, or a limit becomes a rule of a graded exercise. APPROVAL at that point. |
| D3 | How does the person move to a harder challenge? | **A suggested next step, chosen by the person.** Never an automatic unlock. They can always go back. | Already built (slice 1). The suggestion uses the challenge the person chose and how many questions they answered or skipped. It does not use the AI score. |
| D4 | What does practice history keep? | **Result and feedback, not the answer text, and no audio.** The server keeps the question set, status and progress, the per-question feedback and score, and a hash and length of each answer. | Matches the recorded owner decision D-3 = C (`PROPOSAL-practice-session-ledger`, section 6). I first recommended keeping answers too; that conflicted with D-3 and is withdrawn. Audio is not stored in any version until a separate consent, retention period and provider are approved. |

## 3. The journey: two axes, not one ladder

| Axis | Values | Today |
|---|---|---|
| Challenge | Untimed → Timed → Full simulation | Untimed and **Timed (soft)** |
| Interaction | Text → Voice | Text only |
| Feedback loop | Review → Improve → Retry | Exists: "More detail", try again (first attempt counts) |

The four named practice points map onto the axes (they are names for places on the axes, not locks):

| Name | Challenge + interaction | What the person does | Available |
|---|---|---|---|
| Practice without pressure | Untimed + Text | Read a question, write, get feedback, improve, retry | Yes |
| Practice under time | Timed + Text | The same, with 3 minutes per question as a soft limit | Yes (slice 1, not deployed) |
| Voice practice | Untimed with preparation time + Voice | Hear or read a question, prepare, answer aloud, check the transcript, confirm, get feedback on content | No (blocked, section 8) |
| Interview simulation | Simulation + Voice (or Text) | A chain of questions with preparation and answer time from the exercise settings; answers are final once sent; one summary and a next step | No (blocked by voice and the session record) |

A person may take Timed + Text as far as they like and never use voice.

## 4. One shared session

All modes use one session model, not one state machine per mode.

```
Practice experience   onboarding · challenge choice · next-step guidance
Shared session        session · questions · answers · feedback · save / resume
 ├─ Text engine       draft and answer (exists)
 ├─ Timer engine      per-question count-down, deadlinePolicy (soft exists)
 ├─ Voice engine      permission · recording · transcript · correction (not built)
 └─ Feedback engine   request · states · uncertainty (exists, states below)
Server-side controls  sign-in · usage limits · concurrency · persistence · retention (partly: AI proxy checks sign-in and rate-limits; no per-user budget, no session record yet)
```

PROPOSED target architecture, not yet verified in the repo as a whole.

### 4.1 Session fields (what a session knows)

`sessionId` · `persona` · `role` · `challenge` (`untimed` | `timed` | later `simulation`) · `interaction` (`text` | later `voice`) · `deadlinePolicy` (`soft` | later `server`) · `questions[]` · per question: `answerState` · `feedbackState` · `attempt` (1 counts, later attempts are practice) · `skipped`.

VERIFIED today: the device snapshot keeps persona, role, questions, index, results, answer, elapsed time and, since slice 1, the `challenge`; it lives in `sessionStorage` for up to 2 hours. The server knows nothing of a session until it is finished (`mock_sessions` keeps `avg_score`, `questions_count`, `mode`). UNKNOWN until the ledger SQL is approved: server-side session id, status and progress.

### 4.2 Answer and feedback states (never merged)

| State | Meaning | What the screen says |
|---|---|---|
| draft | Typed or transcribed, not sent | "Kept on this device" |
| evaluating | Sent, no reply yet | "Sending your answer; not saved to your account yet" |
| `feedback: confirmed` | The server replied with a graded result (it carries the receipt used to save) | Score and feedback |
| `feedback: failed` | The server answered with an error status | "Not evaluated; your answer is still here" |
| `feedback: unknown` | Timeout or network loss: the server may still have run the AI | "We could not confirm; trying again sends a new AI request" |
| `feedback: pending` | A confirmed request still processing (future, needs the session record) | "Still working" |

VERIFIED: `describeEvaluationFailure` already separates a known failure from an unknown one and never says a retry is free. A timeout never means "the AI did not run". A retry can cost another request.

## 5. Engines

- **Text engine (exists).** Draft kept on the device; minimum and maximum length; first attempt is the one that counts; retries are practice and are not saved.
- **Timer engine.** Soft count-down per question for the first attempt (slice 1: 180 s, starts when the question appears, pauses while the answer is being evaluated, stops when feedback shows). At zero: a status message; the box stays editable and sendable. The optional count-up "Elapsed" timer stays hidden by default and informational. Refresh: the question's count-down restarts (the soft limit is not an exam rule). Pause/resume policy for a server deadline is designed only when D2 changes.
- **Voice engine (not built).** Needs, before any code: permission request and denial handling; recording lifecycle and a hard length limit; speech-to-text provider and where it runs (device or server); transcript shown for correction before it is graded; upload failure and retry; no audio kept (D4); usage limits and cost. The provider is an APPROVAL, not an implementer's choice.
- **Feedback engine (exists).** One graded call per answer; states in 4.2; score labelled as an AI estimate; claims about figures the person did not give are flagged.
- **Server-side controls (partly exists).** The `ai` function checks sign-in and rate-limits per user per instance; there is no per-user budget or concurrency slot and no session ledger (ADR-012 and the ledger proposal, decisions D-1 to D-6 still open). Voice and simulation must not ship before usage limits exist.

## 6. Behaviour rules per situation

| Situation | Rule |
|---|---|
| Refresh or switch module mid-session | The device snapshot offers "Continue practice"; a timed session resumes with a fresh count-down on the same question; nothing is called saved |
| The kept session expires (2 hours) while the select screen is open | "Continue practice" re-reads the stored snapshot; if it is gone the card disappears and nothing opens |
| Sign out | Every kept session in this tab is removed (it holds the person's answers) |
| Time runs out | Status message, answer kept and sendable, no score effect |
| Send fails (known) | Answer stays; says it was not evaluated |
| Send fails (unknown) | Answer stays; says it is not confirmed; a retry is a new request |
| Double click on send | Ignored while a request is running |
| Skip | Counts as not answered; if most questions are skipped the next step suggests going back to untimed, in neutral words |
| Leave without finishing | Confirmation first; nothing is saved unless a question was answered and the session is finished |
| Retry an answer | Practice only; the first attempt counts; practice score is labelled "not counted" |
| Finish | One summary, the suggested next step with its reason, and the other ways forward |

## 7. What is kept, and where

| Item | Where | How long |
|---|---|---|
| Draft answer, questions, progress, chosen challenge | This browser tab (`sessionStorage`) | Until the tab closes or 2 hours |
| "A timed round was finished" | This browser (`localStorage`, key `careerai_mock_timed:<id>`) | Until cleared; only changes the wording of the next-step suggestion |
| Finished session result (`avg_score`, `questions_count`, `mode`) | `mock_sessions` row and the user's memory | Until the person deletes it |
| Per-question feedback, score, answer hash and length | Future ledger (needs SQL approval) | Per the ledger proposal |
| Original answer text | **Not stored on the server** (D-3 = C, D4) | n/a |
| Audio | **Not stored** in any version until a separate approval | n/a |
| Transcript | Treated like an answer text: shown for correction, not stored | n/a |

## 8. Phase plan and completion criteria

| Phase | Scope | Done when | Gate |
|---|---|---|---|
| 0 | This spec; contracts for session, states, engines; reuse of the existing audits | Owner reads and approves D1 to D4 | Owner |
| 1 | Text and shared session foundation | Draft, resume and honest states exist (built earlier); server session record (status, progress) designed and approved | SQL approval (ledger D-1 to D-6) |
| 2 | Timed text | Slice 1 in production: count-down, soft end, side-panel text, device resume, tests | Owner merges and deploys |
| 3 | Voice practice | Permission, recording, transcript correction, failure paths, privacy text, limits, cost estimate all designed, approved and tested | Provider, retention and cost APPROVAL; usage limits exist |
| 4 | Simulation and full progression | Chained questions, preparation and answer time from settings, one summary, next step across modes | Phase 3, and the session record |
| 5 | QA and rollout | Regression, usage controls checked against measured use, feature flag, rollback plan, privacy policy updated | Owner |

Rollout rule for every phase: a flag off by default, a rollback by image tag, and a statement in the privacy text of what is collected before it is collected.

## 9. Acceptance tests (what a reviewer can check)

- Slice 1 (exists): choosing Timed shows a 3:00 count-down; at zero a status says time is up and the answer is kept; the box stays usable and the answer can be sent; Untimed shows no count-down; the next-step card shows one suggestion with a reason and four ways forward; the suggestion never reads an AI score; the copy contains no rank, tier, badge, lock or "level achieved".
- Phase 1 additions: a session survives a refresh and a lost connection; unknown and failed feedback are shown differently; a retry never double-saves.
- Phase 3 additions: microphone denied shows a text fallback; a transcript is shown for correction before grading; no audio leaves the device without the approved path; a failed upload keeps the transcript.
- Every phase: scoring and the Trust Score are unchanged, proved by the existing tests.

## 10. Open decisions (owner)

- Ledger SQL: D-1, D-2, D-4, D-5, D-6 of the proposal (D-3 is decided).
- Speech-to-text provider, where it runs, maximum recording length, cost ceiling.
- Whether a future session type may be used as evidence (then D2 becomes a server deadline).
- Whether the timed length stays 3 minutes (P4): no timing data exists yet, so the value is a starting point, to be reviewed after real use.
- Legal review of the privacy text for any change that collects voice data.
