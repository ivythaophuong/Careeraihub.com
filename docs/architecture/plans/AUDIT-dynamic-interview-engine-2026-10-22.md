# Audit: what the Mock Interview does today, against a "Dynamic Interview Engine" proposal

Status: **AUDIT ONLY. Nothing in product code, SQL, secrets or production changed.** Written 2026-10-22 for the product owner (Ivy). Language: English.
Labels: VERIFIED (read in this repository on 2026-10-22) · PROPOSED · UNKNOWN · APPROVAL.
Scope: step 1 of the owner's roadmap (audit first). Not covered: the outside "Master Prompt" itself, which this session did not receive as text; points about it come from the owner's review only (UNKNOWN for anything else in it).
Related: `DESIGN-question-bank-mvp-2026-10-22.md`, `RECONCILIATION-question-bank-proposal-2026-10-22.md`, `DESIGN-interview-rubric-and-validation-2026-10-20.md`, ADR-011, ADR-013, ADR-014.

## 1. The flow today (VERIFIED)

| Step | Where | What happens |
|---|---|---|
| Questions | `buildQuestionsPrompt`, `normalizeQuestions` in `src/features/HiringManagerSim/interview.js`; call in `HiringManagerSim.jsx` (feature label `mock_questions`) | One prompt writes 5 questions: persona text, role, resume (up to 12,000 characters). Fixed order: 1 opening, 2 STAR-answerable behavioural, 1 role depth, 1 curveball. Returns `{question, focus, why}`. |
| Question checks | `normalizeQuestions` | Object and array shape, length at least 15 characters, case-insensitive duplicates dropped, text clipped to 500, at least 3 questions or an error. No id, no type, no schema library; `extractJSON` parses the text. |
| Inputs the prompt lacks | same | **Industry and level are not inputs.** Only persona, role and resume. |
| Grading | `supabase/functions/_shared/interviewScoring.js` (`buildEvaluationPrompt`, `normalizeEvaluation`); server path `score-interview` | One prompt per answer returns a 0-100 `score`, `worked`, `missed`, `tip`, `betterAnswerOutline`. The verdict label is computed in code from the score. Server path signs a receipt (HMAC over user, time, persona, question, answer, score) and `save` recomputes the average from signed scores. A legacy browser path (`mock_evaluate_legacy`) still exists behind a switch. |
| Rubric | none | The score comes from one general instruction ("0-100 honestly", bands, "most real answers score 40-75"). There is no criteria list, no weights, no version, no question-type framework. |
| Persona text | `PERSONAS` | Four persona paragraphs are inserted into both prompts. |
| Model | `supabase/functions/ai/providers.js` | Default temperature 0.1; provider chosen by server secrets; fallback to other providers (CLAUDE.md). A second provider can score the same text differently (MEASURED hint in `DESIGN-ai-routing-by-feature.md`, small sample). |
| Guards | `findInventedInFeedback`, `numberGuard` | Money-like figures in the tip/outline that the answer never contained are flagged. Not ownership or scope inflation. |
| Saved | `toSessionRow`, `save` action | `mock_sessions` row: `avg_score`, `questions_count`, `mode`. |
| Voice | `guidance.js` (`earnedVoice`) | Unlock after a timed round with at least 4 of 5 answered, kept on the device; independent of the AI score. |

## 2. Findings that change the plan

1. **Answer text is probably stored in the account backup (VERIFIED in code; production rows UNKNOWN).** `buildSessionRecord` puts each question's `answer` and `tip` into the session record, and `updateMemory` adds that record to `mockSessions` (last 20 sessions). `toBackup` in `src/hooks/useMemory.js` removes only `scanPdfBase64` and `originalFileUrl`, so `mockSessions` goes into `user_memory.data`. This conflicts with the wording "no long-term transcript store" used in the Question Bank decisions (Q4). Either the decision means "no new store beyond today's", or this behaviour needs its own decision (consent, retention, deletion). `docs/DATA_LINEAGE.md` was not found to describe it (grep found no entry). **Do not describe the product as keeping no answers until this is settled.**
2. **The persona text rewards numbers.** The `startup` persona says it probes for "concrete numbers" and is "metric obsessed". With a single general score, this can lower the score of a candidate with no figures. The evaluation prompt itself already says not to add numbers the candidate did not state, which is the right half.
3. **Rubric v0 criterion E (Concreteness) names "numbers"** (`DESIGN-interview-rubric-and-validation-2026-10-20.md`, table row E) and D allows "a figure, a decision, a change". Wording should change so a missing figure is not penalised (see section 4).
4. **STAR is the only frame.** The question prompt asks for "answerable with a STAR story"; the grader has no per-type framework. A role-depth or situational question has no matching criteria.
5. **Reuse is high.** The receipt and save logic, `normalizeEvaluation`, `summarize`, `verdictFor`, the number guard, the usage ledger and the voice unlock are sound parts to keep. A parallel engine would duplicate them.

## 3. Mapping the proposal to what exists

| Proposed element | Today | Gap | Smallest change (PROPOSED) |
|---|---|---|---|
| Inject role, industry, level, constraint | role and resume only | industry (the user already selects it elsewhere, UNKNOWN where it is stored for this module), level | add inputs to `buildQuestionsPrompt`; test the prompt text |
| Question output schema | `{question, focus, why}` | no id, type or competency | code assigns `id`; model returns `type` from a fixed list; `normalizeQuestions` rejects unknown types |
| Rubric per question | none | all of it | Performance Framework v1 in the repo, versioned; the model may suggest context, code applies the framework (see section 4) |
| Server validation of ids, weights, enums, lengths | length and duplicates only | ids, enums, weights | extend `normalizeQuestions` and a new rubric validator, both pure and tested |
| Separate generation, rubric resolution, evaluation | one prompt each for generation and evaluation; no resolution step | the middle step | resolve in code from the framework, not by a second model call |
| Rubric snapshot per session | none | score cannot be traced to a rubric version | record `rubricVersion` in the signed receipt; no new table needed to start (UNKNOWN whether `mock_sessions` can hold it; do not add a column without the owner's SQL decision) |
| Cache | none | n/a | out of scope; if ever done, key by framework version plus non-personal inputs and never share CV-derived output |
| Latency claims | none measured | n/a | measure before quoting |

## 4. Rules for Performance Framework v1 (PROPOSED; the owner approves)

- Choose the criteria set by **question type**: past-experience (STAR-like), situational (analysis and decision), technical/role-depth (domain reasoning), opening/motivation.
- Separate **required**, **valuable**, **context-dependent** and **insufficient evidence** per criterion. A missing figure is "insufficient evidence", never a penalty. When no figure exists, assess how the candidate chose a measure, how they would measure, what they observed and the limits of the data.
- Domain terms are evidence of knowledge only through how they are applied; a missing keyword is never a deduction by itself. Red flags are read in context.
- Example figures in any rubric text are labelled as illustration.
- The rubric is applied and versioned by code; the model scores against it and quotes evidence from the answer. It does not invent the criteria per session.
- Anything that produces a number stays labelled "AI estimate" until the validation run in the rubric plan passes (ADR-011, ADR-013).

## 5. What not to do yet

New database table for questions; thousands of questions per industry; cache; model or latency optimisation; changes to current scoring; pushing, merging, SQL, deploy.

## 6. Test checklist for the later PRs (PROPOSED; each test is written before its code)

1. `buildQuestionsPrompt` contains industry and level when given, and is unchanged when they are absent.
2. `normalizeQuestions` rejects: unknown type, empty text, duplicate text, model-supplied id; assigns ids in code.
3. The rubric validator rejects: missing criterion, unknown enum, weights not summing to 1, text over the length limit.
4. A framework chosen for each question type; an unknown type falls back to a safe default and is flagged.
5. Missing figure: an answer with no numbers but a stated way of measuring is not placed in the lowest band by any rule that code applies.
6. The receipt covers `rubricVersion`; a changed version is refused on save.
7. Voice unlock still depends only on the timed round and the 4-of-5 rule.
8. Number guard still flags invented money-like figures.
9. Model JSON failure (truncated, wrong type, extra text) returns the existing safe error, not a partial score.
10. Pilot run, no production change: Product Management cases at three levels and several industries; the same answer scored repeatedly (spread recorded); two independent reviewers compare question quality. Pass/fail thresholds are an owner decision (UNKNOWN until set).

## 7. Decisions for the owner (APPROVAL)

| # | Decision |
|---|---|
| E1 | Answers in the account backup: keep as is, stop saving answer text, or make it an opt-in history with its own design |
| E2 | Persona wording about "concrete numbers": keep, soften, or leave for the framework step |
| E3 | Approve changing rubric v0 criteria D and E as in section 4 before any build |
| E4 | Which comes next: Performance Framework v1 (step 2) or the prompt and schema (step 3) |

## 8. Not verified

Production contents of `user_memory` and `mock_sessions`; whether `mock_sessions` can store a rubric version; where the industry choice lives for this module; the outside Master Prompt text; real latency and cost of a three-step flow; the quality of any current question or score.
