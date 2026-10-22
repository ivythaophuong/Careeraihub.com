# Design: a small Question Bank for Mock Interview, and "Generate 5 more"

Status: **PROPOSED for the owner's approval. No code, SQL, secret or deploy accompanies it.** Written 2026-10-22 for the product owner (Ivy). Language: English (owner statement, 2026-10-19).
Labels: VERIFIED (read in this repository on 2026-10-22) · PROPOSED (a rule or number the owner must approve; none is measured) · UNKNOWN · APPROVAL.
Builds on: `RECONCILIATION-question-bank-proposal-2026-10-22.md` (what an outside proposal gets right and wrong), `DESIGN-interview-rubric-and-validation-2026-10-20.md` (rubric v0 and how to check the AI), ADR-011, ADR-013, ADR-014.

## 1. The problem

All five questions of a session are written by the AI at the moment the user starts (VERIFIED, `buildQuestionsPrompt`). Nobody has reviewed any of them, a question has no recorded type, and the industry the user chose is **not** an input to the question prompt (VERIFIED). So the questions differ by field only through the role typed or the CV. Five questions also cannot cover what a real interview asks in a given field.

## 2. Goals and non-goals

Goals (PROPOSED):
1. Some questions are **written and reviewed by people** for a chosen field, so the user gets questions of a known quality.
2. The user can ask for **five more**, different from the ones already asked.
3. Every question has a **type** assigned in advance (the rubric plan needs this).
4. A user can tell a **reviewed** question from an **AI-written** one.
5. The smallest change that does this, with nothing new in the database for the pilot.

Non-goals: a taxonomy with many-to-many mappings, versioned rubrics, evaluation history, question analytics, other languages, any change to how answers are scored, any confidence score.

## 3. The pilot, smallest safe form

**A reviewed set kept in the repository as a data file**, not in the database. It is read-only data, it needs no migration, no row-level security and no secret, it is versioned by git, and a change goes through a pull request and its tests. (PROPOSED. A table can replace the file when the set outgrows it or when someone other than the owner must edit it.)

Each item (PROPOSED fields):

| Field | Meaning |
|---|---|
| `id` | A stable key, never reused |
| `text` | The question, one or two sentences, English |
| `type` | One of `opening`, `behavioural`, `situational`, `role_depth`, `technical`, `curveball` |
| `competencies` | A short list of tags (for example `prioritisation`, `stakeholder`) |
| `domains` | The fields it suits (a list; one is enough for the pilot) |
| `levels` | Optional: the seniority it suits |
| `source` | `owner_written`, `volunteer_written` or `adapted_from_public_guidance` with the guidance named |
| `reviewed_by` and `reviewed_on` | Who agreed it was a good question, and when |
| `retired` | A date, if it is withdrawn; a retired item is kept, never deleted |

A pilot of **one domain** chosen by the owner (UNKNOWN which; Product Management is only an example) with about **30 reviewed questions**: at least 5 for each of the types the five-question structure uses. The number 30 is a proposal, not a measurement.

## 4. How a session is built

Code decides, with no AI call, for the reviewed part (the same principle as ADR-011):

1. From the pilot set, keep the items that match the user's domain and role if known, and that the user has not been asked on this device (see section 6).
2. Fill the structure the product already uses: **1 opening, 2 behavioural, 1 role-depth, 1 curveball**.
3. **Mix (PROPOSED):** three reviewed questions and two **personalised** by the AI from the CV and the role, as today. If the pilot set has no match (another field), all five are AI-written as today; nothing breaks.
4. Each question carries a small tag, **Reviewed** or **AI-written**, so the user knows what they are looking at. The AI-written ones keep the one-line "what the interviewer is testing" the AI already returns.

The AI prompt for the personalised questions gains two inputs it lacks today: the **industry** and the **list of questions already chosen**, so it does not repeat them. (VERIFIED that industry is not passed now.)

## 5. "Generate 5 more"

- Available after a finished round of five (the owner's wording, 2026-10-22), also for a user who skipped some.
- It builds a new round the same way as section 4 and **excludes every question asked in this user's earlier rounds on this device**.
- The user may choose the **kind of round** (behavioural, role-specific, situational) or leave it to the app.
- A daily cap on new rounds (PROPOSED: 3 a day) protects cost and abuse. Cost: one question-generation call measured at 688 input and 613 output tokens on average (20 calls on production, 2026-10-22), about **0.0004 USD** at the price table in `usage.js`. The price was read on 2026-10-15 and not re-checked.

## 6. What "already asked" means

Today the product keeps no answers and stores only the session average (VERIFIED). So "already asked" can only be remembered on the **device** (a list of question ids, as the timed-round marker is kept today in `localStorage`). On another device the user may see a question again. A server-side record needs the owner's decision on keeping what a user did (Q4 in the reconciliation) and a SQL change the owner would run; it is **not** part of the pilot.

## 7. Voice

Unchanged by this design. Voice is offered after one timed round with at least four of five questions answered (VERIFIED, `earnedVoice`; it is kept on the device). The owner's idea of "text first, voice later" already exists in that rule. A stricter rule (two rounds) or keeping the mark in the account is a separate decision. The mark must **not** depend on an AI score (ADR-011, ADR-014).

## 8. How this fits the rubric plan

The rubric plan needs the type of each question to be known in advance. The reviewed set gives that for its items, so rubric v0 can later be applied to the past-experience questions of the pilot without guessing a type. Nothing in the live scoring changes in this design.

## 9. Pull requests (PROPOSED)

| # | Change | Tests first |
|---|---|---|
| 1 | The data file with the pilot questions, and a validation test: required fields, allowed types, no duplicate id or text, the minimum per type | The test fails on a bad item |
| 2 | A pure function that builds the reviewed part of a round from the set, the user's domain, the structure and the asked list | Enumerates: no match, a match, repeats excluded, structure order |
| 3 | The mix in the session start, the **Reviewed** and **AI-written** tags, and **Generate 5 more** with its cap | Component tests; the live path unchanged when the set has no match |
| 4 | Industry and the already-chosen questions in the question prompt | The prompt contains them; the existing prompt tests still pass |

Each is its own pull request; nothing is deployed without the owner's word.

## 10. Owner decisions (APPROVAL)

| # | Decision |
|---|---|
| D-Q1 | The pilot domain |
| D-Q2 | Who writes the first questions and who reviews them (the rubric plan already needs two reviewers) |
| D-Q3 | The mix of reviewed and AI-written questions (proposed 3 and 2) |
| D-Q4 | The daily cap on new rounds (proposed 3) and whether the user picks the kind of round |
| D-Q5 | Whether a retired or edited question must be recorded in the product (not for the pilot) |

## 11. Risks and what is not verified

- **Quality of reviewed questions is only as good as the reviewers.** The owner is the first reviewer; that is a limit to state, not a flaw to hide.
- **The AI-written questions are not measured either.** There is no test of their quality (CLAUDE.md). The Reviewed tag must never imply the AI-written ones are checked.
- **Questions copied from public guidance:** the source and its licence must be checked before use (UNKNOWN for any given source). The safest pilot is questions the owner and volunteers write themselves.
- **Device-only memory of asked questions** can repeat a question on another device, as stated in section 6.
- **A fixed set can be memorised.** For a pilot this is acceptable; the AI-written part keeps variety.
- Not verified: how users react to the tag, the real cost of the personalised calls beyond the 20 measured ones, and whether 30 questions are enough for one domain.
