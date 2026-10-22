# Reconciliation: an outside proposal for a Question Bank, rubric and evaluation engine, against what the repository already says

Status: **a comparison, not a decision. No code, SQL, secret or deploy accompanies it.** Written 2026-10-22 for the product owner (Ivy). Language: English (owner statement, 2026-10-19).
Labels: VERIFIED (read in this repository on 2026-10-22, or in a document dated as stated) · PROPOSED · UNKNOWN · APPROVAL.

## 1. What was compared

On 2026-10-22 the owner pasted an analysis written by another assistant. It proposes a Question Bank (industries, roles, competencies, question versions, session snapshots, evaluation runs), rubrics by question type, an overall score computed by the backend from validated criterion scores, row-level security and retention rules, and a four-stage plan (audit, Question Bank MVP, Evaluation Engine, Voice and Progress). It also describes a "current system prompt" and a "current schema". **Neither of those is in this repository**: the prompt that runs today has no list of criteria (see section 2), and no `questions` or `question_versions` table exists. The analysis is therefore about a design someone else had in mind, not about this product. The paste itself is not stored here; this document only records the comparison.

Sources read: `supabase/functions/_shared/interviewScoring.js`, `src/features/HiringManagerSim/interview.js`, `docs/architecture/plans/DESIGN-interview-rubric-and-validation-2026-10-20.md`, `docs/DECISIONS.md` (ADR-011, ADR-013, ADR-014), `docs/DATA_LINEAGE.md`, `docs/database/README.md`.

## 2. What is true today (VERIFIED)

- **Questions come from one AI call per session.** `buildQuestionsPrompt` (`interview.js`) gets the persona paragraph, the role the user typed and the CV text (up to 12,000 characters). It asks for five questions in a fixed order (one opening, two behavioural, one role-depth, one curveball). There is no question bank, no reviewed question and no source cited for any question.
- **The industry is not an input.** The profile has an `industry` field, but it is not passed to the question prompt. A difference by field appears only through the role the user typed or through the CV. The four personas are four kinds of company (seed startup, Series B, Fortune 500, tech lead), not four industries.
- **One AI score per answer.** `score-interview` returns a 0-100 `score`; code clamps it, assigns the label from the band, signs it in a receipt and averages the signed scores on save (at most five per session). The prompt has no criteria list. There are no per-criterion scores and no evidence quotes.
- **The score depends on the model.** Three different models gave the same text the scores 12, 22 and 32 (measured 2026-10-14, recorded in `providers.js`). `score_interview_evaluate` is therefore kept out of silent fallback. How much two runs differ on the current model: UNKNOWN.
- **Every per-answer score carries "AI estimate, not verified evidence"** (owner decision D-R1 option a, 2026-10-20).
- **Voice stays out of the score.** A spoken answer reaches the grader as plain transcript text; WPM and rhythm are shown beside the answer and are not in the prompt for the score (ADR-014). The rhythm thresholds are proposed starting values, not tuned on real microphones.
- **Browser writes to the score tables.** `docs/database/README.md` records that `INSERT` and `UPDATE` on `mock_sessions` were revoked from `authenticated` and read back on 2026-10-18 (`authenticated` keeps `SELECT` and `DELETE`); saves go through the `score-interview` function. The policies themselves are not in this repository (UNKNOWN). Not re-read today.
- **No test calls a real model**, so the quality of the feedback is not measured (CLAUDE.md). The only production data in the rubric plan: 9 saved sessions by 6 users on 2026-10-20.
- **A rubric and a validation plan already exist, as a proposal**: `DESIGN-interview-rubric-and-validation-2026-10-20.md` (rubric v0 for past-experience questions, three levels per criterion, a label derived by a rule that a test enumerates, a reference set of at least 60 answers, two reviewers, agreement and stability and injection checks). It awaits the owner's approval of rubric v0, the choice of two reviewers and the volunteers.

## 3. Point by point

| Claim in the outside analysis | State in this repository | Verdict |
|---|---|---|
| A question bank mixing reviewed, CV-personalised and AI-new questions is the right direction | Today all questions are AI-written for each session | **Valid and not built.** Design in `DESIGN-question-bank-mvp-2026-10-22.md` |
| One question may belong to several industries, roles and competencies | No question table exists | **Valid for the target.** Not needed for a pilot (see the MVP design) |
| A question has a type (behavioural, technical, situational) apart from its competency | A question has only a free-text `focus` | **Valid.** The rubric plan says the same (type assigned in advance) |
| Rubrics by question type; do not force STAR on every answer | Rubric v0 is scoped to past-experience questions and marks `n/a` for the others | **Already planned**, and consistent |
| Missing numbers are not automatically a poor answer | The live prompt asks to judge only what was said; v0 criterion D accepts "a figure, a decision, a change" | **Valid; already reflected** in v0 |
| The backend, not the AI, computes the overall score from validated criterion scores | Today the AI gives one score per answer and code averages them. The rubric plan derives a label by a rule from criterion levels | **Valid and planned**, but nothing of it is live. The live number is an AI estimate and is labelled so |
| Distinguish low score, not enough evidence, and evaluation error | The live path throws an error on an unreadable or empty answer and shows no score | **Partly there** (error is separate); "not enough evidence" is not a state today |
| Separate content evaluation from delivery metrics | Done (ADR-014) | **Done** |
| Pause counts are trustworthy only when the audio pipeline and the pause definition are validated | Stated in `rhythm.js` and in ADR-014 item 4 | **Agrees** |
| Versioned rubric; store the rubric version used in each session | No rubric is live; nothing to version yet | **Valid when a rubric goes live** |
| `evaluation_runs` apart from responses, for retry and comparison | The product keeps no answers and stores only the session average | **Valid in principle; premature.** Needs the decision on keeping answers first |
| Foreign key to `auth.users`, RLS on every table, no client-written scores | See section 2; policies are not in this repository | **A real concern for any new table**; for existing tables it needs a read-only check against the database |
| Do not store transcripts or audio for long | Audio is not kept; the transcript lives in the answer box until it is sent for feedback | **Agrees** |
| Track `question_started`, `skipped`, `abandoned` and so on; completion rate alone is not quality | No such events exist | **Valid; later.** Needs a privacy review and a denominator before any comparison |
| Do not claim how competitors work from a blog | The analysis says so itself | **Agreed.** Nothing here relies on competitors |
| A "confidence score" as a goal | ADR-014 defers a confidence percentage until there is evidence | **Not adopted** |
| Measure schema validity, evidence grounding, consistency, human agreement, reliability and cost | The rubric plan section 6 covers stability, agreement and injection | **Already planned** |

## 4. What is new in the outside analysis and worth keeping

1. **Question versions and session snapshots** once a rubric is live, so an old result is never re-read against a newer rubric.
2. **Evidence quotes checked against the transcript**, so the AI cannot invent something the candidate never said. This is not in the rubric plan and is worth adding to rubric v1.
3. **A "not enough evidence" status** distinct from a low score.
4. **A question taxonomy with mappings**, as the long-term shape (not for the pilot).
5. **Events for question quality**, with a defined denominator and with technical failures excluded.

## 5. What is not adopted, and why

- Building all thirteen tables at once. The analysis itself advises against it; the pilot needs none (see the MVP design).
- Any score of confidence.
- A schema or prompt described there as if it were ours.
- Statements about what other products do.

## 6. Decisions of the owner (2026-10-22)

| # | Decision | Status |
|---|---|---|
| Q1 | Rubric v0 | **Approved with conditions**: its content and criteria are to be reviewed before it is built; not approved as written |
| Q2 | Two independent reviewers for the reference answers | Recruit two; none named; no validation run until then |
| Q3 | Pilot domain and who writes and reviews questions | Product Management; the owner and volunteers write; see `DESIGN-question-bank-mvp-2026-10-22.md` section 10 |
| Q4 | Keeping a user's answers | **Not in the MVP.** Answers stay handled in the moment; no long-term transcript store. A voluntary history would need its own design (consent, retention, deletion) |

These are product directions. Nothing is built, and the conditions in section 12 of the design file still apply.

## 7. Not verified

- The current policies and grants on the live tables (only the 2026-10-18 reading in `docs/database/README.md`).
- How much the live feedback varies between runs on the current model.
- Whether the three-level criteria suit technical or opening questions.
