# Design brief: where Interview Coach questions come from, and how to make them checkable

Status: **DESIGN BRIEF. No code, SQL, secret or deploy accompanies it.** Written 2026-10-19 for the product owner (Ivy). It does not change behaviour.
Labels: VERIFIED (read in the repo) · PROPOSED · UNKNOWN · APPROVAL (needs the owner before it is built or shipped).

## 1. What is true today (VERIFIED in the repo)

- The module "Interview Coach" (`simulate`) is `src/features/InterviewCoach/InterviewCoach.jsx`. Its tabs "Study Modules" and "Live Session" both render `HiringManagerSim`. Whether "Study Modules" is meant to have its own content is UNKNOWN.
- Questions are written by the AI on each start. `start()` in `HiringManagerSim.jsx` calls `callLLMFor('mock_questions', resume)` with the text from `buildQuestionsPrompt` (`src/features/HiringManagerSim/interview.js`). The call goes to the `ai` Edge Function (OpenAI first, Groq as fallback).
- The prompt holds: the persona guidance (`PERSONAS` in `supabase/functions/_shared/interviewScoring.js`: Seed Startup, Series B, Fortune 500, Tech Lead), the role the user typed, the resume (at most 12,000 characters, or an attached PDF, marked untrusted), and fixed rules: five questions (1 opening, 2 behavioural, 1 role depth, 1 curveball), no invented employers, projects or achievements.
- `normalizeQuestions` drops questions shorter than 15 characters and duplicates, keeps at most 5, and fails below 3. Each question carries `question`, `focus` (free text, 40 characters) and `why`.
- There is no question bank and no outside source. The words "Tell me about yourself" and similar appear only in the landing demo (`src/features/Landing/demoHtml.js`).
- No test calls a real model, so the quality of the questions is not measured (CLAUDE.md, "Testing").
- UNKNOWN: the sampling temperature used for OpenAI (the code shows `temperature: 0.1` only on the Gemini path), so how much two runs differ is UNKNOWN.

## 2. The problem

The owner wants to serve many careers without writing and maintaining a bank per career. The only source today is the model's memory, which cannot be checked, and "what a real interviewer asks" is a claim nobody can verify from the code.

## 3. Direction (PROPOSED): structure first, knowledge second, retrieval third

1. A **universal question structure** that every generated question must satisfy.
2. A small **shared competency list**, not one list per career.
3. A **pre-built, reviewed knowledge layer** (sources and rubrics). The AI reads from it during a session. **Live web search is not the default**; it is used only when the layer lacks what is needed.
4. A **quality gate** between the AI and the candidate, in three separate layers that are never merged into one score.

Why not search the web at the start of every session: more latency, more cost per session (today about 0.002 USD, estimated from the price table; a search plus checking steps would multiply calls and the new figure is UNKNOWN), results that vary between runs, and web pages can carry instructions aimed at the model. The `ai` function has no search tool today, so this would be a new risk surface.

## 4. Question structure v1 (PROPOSED)

Each question is an object with these fields. Fields marked "code" can be checked by code; the others need a person.

| Field | Meaning | Check |
|---|---|---|
| `question` | The text, 15 to 500 characters (as today) | code |
| `competency` | One id from the shared list (section 5), replacing the free-text `focus` | code |
| `intent` | One of: `experience`, `reasoning`, `knowledge`, `situation` | code |
| `level` | `entry`, `mid`, `senior`, taken from the user's input or `unspecified` | code |
| `why` | What the interviewer is really testing (as today) | code (length) |
| `assumes` | Typed list of what the question takes for granted, each tagged `claim` (about the candidate), `hypothetical` (a scenario stated as imaginary) or `role_context` (background of the job). See 4.2. | code (tags) + person (meaning) |
| `criteria` | 2 to 4 short statements of what a strong answer shows. No single "correct" answer for open questions. | person |
| `origin` | Where the text came from; defined in 4.1 | code |
| `quality_status` | `unchecked`, `sampled_ok`, `sampled_failed`. Kept apart from `origin`. Starts as `unchecked`; only a person's review changes it. | code (enum) + person |
| `sources` | For `ai_from_sources` only: list of `{ url, retrievedAt, excerpt }` | code (present) + person (fit) |
| `promptVersion` | The version of the prompt that produced it | code |

### 4.1 Meaning of `origin` and `quality_status`

| `origin` | Meaning | What it does NOT mean |
|---|---|---|
| `ai_generated` | The AI wrote it from the prompt and context; no outside source is recorded for it | Nothing about quality |
| `reviewed_bank` | Taken from an internal bank that went through a defined review. **No such bank exists today.** | That it predicts job performance |
| `ai_from_sources` | The AI wrote it from outside sources that were retrieved and recorded | That it is a good question |

`origin` says where a question came from; `quality_status` says how far it has been checked. The screen may show both, and must never infer one from the other.

### 4.2 Rules for `assumes`

- `claim`: a statement about the candidate's experience, action or result. Must be supported by the resume or an earlier answer. "How did you increase activation by 25% in your last launch?" is a claim and fails without that evidence.
- `hypothetical`: a scenario stated as imaginary ("How would you prioritise competing requests with limited capacity?"). It needs no support in the resume.
- `role_context`: background of the job. It must fit the role and must not be used to infer personal achievements.
Code can check that the tags exist and that a `claim` shares its key terms with the resume. It cannot prove the meaning is right; that stays in the quality review.

### 4.3 Rules for writing a question (PROPOSED)

The schema says what a question must carry, not what makes it good. The generator prompt and the review use these rules:
- One main thing is assessed per question.
- The question fits its `competency` and `intent`.
- It never turns an assumption into a fact about the candidate (4.2).
- Within a session, questions differ in purpose, not only in wording.
- A question about specialist knowledge rests on knowledge that fits the role; if that is missing, the system falls back (section 7) instead of guessing.

Rule: the screen must show the `origin` so the user can tell an AI-written question from a reviewed one. No screen says "evidence-based" until `sources` exist for that question.

## 5. Shared competencies (PROPOSED, a starting set, not validated)

`problem_solving`, `communication`, `ownership`, `analytical_thinking`, `collaboration`, `motivation`. Technical or craft knowledge is a seventh slot, `domain_knowledge`, whose content depends on the role and is the only place where outside sources are really needed.

The common list is not forced on every career. The structure is shared, the list can grow, and specialist criteria (for example SQL and statistics for a data analyst, or design critique for a designer) are separate sets added when needed. `domain_knowledge` alone is too broad to carry them.

These are examples for design; no evidence yet shows this list covers the careers the product will serve. Adding a competency needs a person's decision.

## 6. Sources and trust (PROPOSED)

| Tier | Examples | Use |
|---|---|---|
| 1 | Official technical documentation, published competency frameworks of professional bodies, a real employer's own job posting | Confirm skills and role requirements |
| 2 | Training material, research or professional writing with an author and references | Add scenarios and context |
| 3 | Community lists of interview questions, forum posts | Find which topics are common. **Never copied word for word, never treated as a standard.** |

- A trustworthy source proves the knowledge is right, not that the question is well asked. These are separate checks.
- Respect each source's terms and copyright; store a short excerpt and the URL, not bulk copies. Whether a given source's terms allow this is UNKNOWN until read per source; a lawyer may be needed.
- Retrieved text is data, never instructions: it goes inside a delimited block, as the resume does today, and the model is told to ignore any instruction in it.
- **Idea to examine (UNKNOWN):** the `jobs` Edge Function already talks to Adzuna. Real job postings could supply "what this role asks for" across careers. Adzuna's terms for this use have not been read.

## 7. Quality gate: three layers, never one score

| Layer | Question it answers | Who checks |
|---|---|---|
| Structural | Are all fields present and valid? Duplicates? Within limits? | Code, in `normalizeQuestions` |
| Evidence | Is the subject knowledge supported by the listed sources? | A person on a sample; an AI check may flag but is **not independent** of the generator and must not be called verification |
| Quality | Is it clear, right for the level, does it separate strong from weak candidates? | Two independent raters on a sample, using the same procedure as D1 (`D1-interview-structure-calibration-standard-2026-10-18.md`) |

If the evidence is not enough, the system must not pretend it was checked. **There is no reviewed bank today, so this fallback does not exist yet.** Until one does, either a minimal set of reviewed general questions is built first, or today's behaviour stays as the fallback and the limit is stated plainly. A question that has not passed the quality sample is not described as good in any text shown to users.

## 8. Build order (PROPOSED; each step needs its own approval to merge or deploy)

1. **Contract and tests (no production change).** Fix the schema in section 4, the rules in 4.2 and 4.3, and tests for missing fields, wrong enum values, duplicates, malformed output and loading of old stored sessions. Tests first (fail, then pass).
1b. **Offline evaluation.** Run the new prompt on a set of varied roles and levels and look at the questions themselves, not only whether the JSON is valid. Acceptance criteria are written before the run.
1c. **Behind a flag.** Only if 1b meets those criteria. The flag returns to today's behaviour; old data is not changed. This is the first step that touches production behaviour.
2. Shared competency list, kept short.
3. Source policy and the knowledge layer: where it is stored, who reviews it, how old entries are retired. **Any database change is a separate APPROVAL** (the Supabase Free plan has no backups or point-in-time recovery).
4. Retrieval from the layer during a session, then live search only when the layer lacks coverage.
5. A test set of varied roles, levels, careers and resumes, including cases where the correct result is to refuse for lack of evidence.
6. Wire into Interview Coach behind a flag, with a rollback that returns to today's behaviour.

## 9. Not verified

- The effect of the structure fields on question quality: no measurement exists and none is claimed.
- Cost and latency of retrieval and of the extra checks.
- Whether the shared competency list fits careers outside software and business roles.
- Source terms (Adzuna and any website), and any legal view on storing excerpts.
- Whether "Study Modules" should differ from "Live Session".
- Cost, latency and the share of retries or fallbacks of the new design must be measured separately for generation, retrieval, extra checks and regeneration before any cost target is set. Today's 0.002 USD is an estimate for the current design only.

## 10. Decisions the owner needs to make

| # | Decision | Recommendation |
|---|---|---|
| Q1 | Knowledge layer first, live search only when needed | **Yes** |
| Q2 | Start with steps 1 and 1b (contract, tests, offline evaluation); flag in 1c only after the criteria are met; no retrieval yet | **Yes, with these conditions** |
| Q3 | Who writes and reviews the competency rubrics and the source list | UNKNOWN: owner to name people. This decides how fast steps 2 and 3 can go |
| Q4 | How many independent raters are available for the quality sample | Needs at least 2 (same need as D1) |
| Q5 | Which careers and languages come first | English first, and at least one career group outside software and business in the test set, so the structure is not judged on two families only |

## 11. Documents to write next (PROPOSED)

1. `Question Structure v1`: the schema, the generation rules and the validity conditions.
2. `Question Quality Rubric v1`: the quality criteria and the independent rating procedure.
3. `Interview Coach Evaluation Plan`: test cases, acceptance criteria, fallback and rollback.

No code, SQL, push, merge or deploy follows until the owner approves the scope.
