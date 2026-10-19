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
| `assumes` | What the question assumes about the candidate. Must be empty or appear in the resume. | code + person |
| `criteria` | 2 to 4 short statements of what a strong answer shows. No single "correct" answer for open questions. | person |
| `origin` | `ai_generated`, `reviewed_bank` or `ai_from_sources` | code |
| `sources` | For `ai_from_sources` only: list of `{ url, retrievedAt, excerpt }` | code (present) + person (fit) |
| `promptVersion` | The version of the prompt that produced it | code |

Rule: the screen must show the `origin` so the user can tell an AI-written question from a reviewed one. No screen says "evidence-based" until `sources` exist for that question.

## 5. Shared competencies (PROPOSED, a starting set, not validated)

`problem_solving`, `communication`, `ownership`, `analytical_thinking`, `collaboration`, `motivation`. Technical or craft knowledge is a seventh slot, `domain_knowledge`, whose content depends on the role and is the only place where outside sources are really needed.

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

If the evidence is not enough, the system uses a reviewed general question instead of pretending it was checked. A question that has not passed the quality sample is not described as good in any text shown to users.

## 8. Build order (PROPOSED; each step needs its own approval to merge or deploy)

1. **Question structure v1 in code, no retrieval.** Extend the prompt and `normalizeQuestions` to the fields marked "code" in section 4, with `origin = ai_generated`. Tests first (fail, then pass). Old stored sessions must still load. A flag allows the old behaviour. This is the only step that touches production behaviour and it is small.
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

## 10. Decisions the owner needs to make

| # | Decision | Recommendation |
|---|---|---|
| Q1 | Knowledge layer first, live search only when needed | **Yes** |
| Q2 | Start with step 1 (structure v1, no retrieval, behind a flag) | **Yes** |
| Q3 | Who writes and reviews the competency rubrics and the source list | UNKNOWN: owner to name people. This decides how fast steps 2 and 3 can go |
| Q4 | How many independent raters are available for the quality sample | Needs at least 2 (same need as D1) |
| Q5 | Which careers and languages come first | Owner's choice; English first is the lowest effort |
