# Design: how the evaluation framework could extend to many roles and industries (long-term shape)

Status: **PROPOSED, design only. Nothing is built, approved or validated, and no code, SQL, secret or deploy accompanies it.** Written 2026-10-22 for the product owner (Ivy). Language: English.
Labels: VERIFIED (read in this repository on 2026-10-22) · PROPOSED · UNKNOWN · APPROVAL.
Source: an outside architecture suggestion, pasted by the owner; this file compares it with the repository and keeps what fits. Builds on `DESIGN-performance-framework-v1-2026-10-22.md`, `DECISION-dynamic-interview-engine-2026-10-22.md`, `DESIGN-question-bank-mvp-2026-10-22.md`.

## 1. The proposal in one paragraph

Four layers: (1) a **core evaluation framework** shared by every role (evidence extraction and validation, evaluation states, versioning, error handling); (2) **question-type rubrics** (behavioural, situational, role-depth, technical, opening, curveball); (3) **role competency profiles**, grouped by **role family** (Product, Engineering, Commercial, Marketing, Finance, People, Operations); (4) **industry and seniority context**, applied only when the real job needs it. The AI may personalise questions from the CV, level and job description, but may not create a rubric, weights or pass thresholds per session; those are versioned and managed outside the model.

## 2. What already matches the repository

| Proposed layer | In the repository today | Fit |
|---|---|---|
| 1 Core framework | `DESIGN-performance-framework-v1`: three layers (extraction, assessment, derivation), evidence states, versioning, result states | Same idea, already drafted. Layer 1 of this proposal is sections 2, 4, 9, 10 and 15 of that file |
| 2 Question-type rubrics | Framework v1 section 3 and 6: six fixed types, criteria per type | Same list of types. Descriptors per level are still missing |
| 3 Role profiles | None. Question Bank items carry a `domains` list; pilot is Product Management | Not started |
| 4 Industry and seniority | Questions have an optional `levels` field; industry is not an input to the question prompt today (VERIFIED, `buildQuestionsPrompt`); four interviewer personas exist (`PERSONAS`: Seed Startup, Series B, Fortune 500, Tech Lead) | Not started; personas are a company-environment idea and would sit near layer 4 |

## 3. Where the proposal conflicts with decisions already taken

- **"Hundreds of roles" versus the current scope.** The Question Bank design (non-goals) and Framework v1 (section 13) exclude a large multi-industry taxonomy and thousands of static questions. The proposal is therefore a **target shape**, not work for the pilot. Layers 3 and 4 stay unbuilt until Layers 1 and 2 pass their validation (decision record, section 4).
- **A reusable framework is not a validated one.** The example table of roles and competencies (Product, Engineering, Sales, Marketing, Finance, HR) is an illustration. No profile may be released on the strength of the shared engine; each needs its own written descriptors, reviewers and tests.
- **Personas versus industry.** The existing personas change how the interviewer sounds and what it probes (for example the `startup` persona's emphasis on numbers, which D-2 softens). They must not become a hidden second rubric. Decide whether a persona is a question style only, with no effect on criteria.

## 4. Rules to keep if the layers are ever built (PROPOSED)

1. **Inheritance is one-directional and explicit.** A role profile may add or reweight competencies only inside a versioned file; a lower layer may not remove a core rule (for example "no number requirement", "unmatched quote is dropped").
2. **Applicability is stated, not assumed.** An industry criterion (for example compliance in finance, safety in health) applies only when the question or job description calls for it. Otherwise it is `not_applicable`, never a penalty.
3. **A profile has a release state:** draft, piloted, released. The product shows only released profiles; a role with no released profile uses the core framework and the question-type rubric, and says so.
4. **Every result names** the framework, question-type rubric and profile versions used (Framework v1 section 10).
5. **Seniority** changes the expected depth of evidence only through written level descriptors; the model does not infer a level from writing style.
6. **Fairness check per profile:** reviewers look for criteria that favour one background, accent, or style over the evidence asked for (Framework v1 section 6.1).
7. **Maintenance cost is a gate:** the number of profiles is limited by how many a named reviewer pair can keep current, not by how many the AI can draft.

## 5. Staged route (PROPOSED; each stage needs its own approval)

| Stage | Scope | Exit condition |
|---|---|---|
| 1 | Core framework plus Product Management | Reference set, two independent reviewers, thresholds fixed before results (Framework v1 sections 11 and 12) |
| 2 | Two or three role families that differ from Product (for example Engineering and a commercial one) | The core framework is reused without change to layer 1; what had to change is listed |
| 3 | More roles inside families that passed stage 2 | Each added profile has descriptors, reviewers and tests |
| 4 | Industry and level extensions | Each extension shown to change results only where the job needs it |
| 5 | Scale | Only released, versioned profiles are offered |

Stage 2 is the real test of the claim "reusable"; until it is run, "reusable" is a hypothesis.

## 6. Decisions for the owner (APPROVAL)

| # | Decision |
|---|---|
| X1 | Adopt the four-layer shape as the **long-term direction**, with no change to the pilot scope (Product Management, layers 1 and 2) |
| X2 | Treat interviewer personas as question style only, or allow them to affect criteria (not recommended) |
| X3 | Which role families to try at stage 2, decided after stage 1 results |

## 7. Not verified

Whether the criteria generalise across families (no test exists); the effort of maintaining profiles; where the industry selection lives in the app; whether the existing `domains` and `levels` fields in the Question Bank design are enough to key profiles; any claim in the outside table of role competencies.
