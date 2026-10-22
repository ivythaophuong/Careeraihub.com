# Decision Record: Dynamic Interview Engine

**Status:** Product direction approved; documentation draft only. No implementation authorised by this record.  
**Date:** 2026-10-22  
**Owner:** Ivy  
**Scope:** CareerAiHub Mock Interview  
**Related documents:** `AUDIT-dynamic-interview-engine-2026-10-22.md`, `DESIGN-question-bank-mvp-2026-10-22.md`, `RECONCILIATION-question-bank-proposal-2026-10-22.md`, `DESIGN-interview-rubric-and-validation-2026-10-20.md`, ADR-011, ADR-013, ADR-014.

## 1. Decisions

### D-1 — Answer-text retention

**Decision:** The intended design is to stop including interview answer text in long-term account backups going forward. Existing data must be assessed separately before any cleanup or deletion decision.

This is a product decision, not an implemented change.

Before implementation, conduct a read-only data-lineage review covering:

- How `buildSessionRecord`, `updateMemory` and `toBackup` handle `answer`, `tip` and `mockSessions`.
- Whether answer text is currently present in browser storage, account backup payloads, database records, application logs, analytics or provider-side retention.
- What historical data exists in production, where it resides, and what deletion mechanisms are available.
- Whether the product's privacy notice and consent wording accurately describe each data flow.

The repository audit identified a possible path from answers and tips into `user_memory.data`. The contents of production records have not been verified. Other copies and provider retention are also unknown.

**Acceptance principle:** Removing answer text from future account backups must not be represented as deleting historical data, removing all copies, or proving that no other system retains it.

No production data should be deleted or modified until the data inventory, retention decision and required authorisation are complete.

### D-2 — Interviewer persona wording

**Decision:** Soften wording that overemphasises concrete numbers.

Interviewers may ask for measurable outcomes when relevant, but must also recognise qualitative evidence, decisions, observed changes, measurement methods and limitations in available data.

A candidate must not be penalised solely because an answer contains no numerical result. The system must not encourage invented metrics.

### D-3 — Rubric v0 criteria D and E

**Decision:** Approve revision of criteria D (outcome evidence) and E (concreteness) before any rubric-based scoring is implemented.

- **D — Outcome evidence:** Accept quantitative or qualitative outcomes, observed changes, decisions and a credible explanation of how an outcome was assessed.
- **E — Concreteness:** Assess the specificity of actions, examples, reasoning, measurement methods and evidence limitations. Do not use the presence of a number as a proxy for quality.

The revised wording must be tested against reference answers before any rubric-based score is exposed to users.

### D-4 — Order of design work

**Decision:** Design Performance Framework v1 before refining the generation prompt and JSON schema.

The framework will define the evaluation contract. The prompt must follow that contract rather than create a new evaluation standard for each generated question.

## 2. Product architecture direction

The intended sequence is:

1. **Interview context:** role, industry, seniority level, question type and relevant constraints.
2. **Performance Framework:** a versioned, stable definition of competencies, evidence rules and level descriptors.
3. **Question generation:** reviewed questions where appropriate, plus AI-generated personalised questions.
4. **Validation and rubric resolution:** code validates the question structure and resolves the correct framework for its type.
5. **Evaluation:** the model evaluates the answer against the resolved framework and identifies supporting evidence.
6. **Server validation:** code validates the output shape, permitted values, evidence references and score derivation rules.
7. **Presentation:** feedback and any numeric result remain labelled as an AI estimate until the relevant validation requirements are met.

The Question Bank and Dynamic Interview Engine are complementary. The Question Bank supplies human-reviewed examples; the engine supports contextual generation. They should not become separate scoring systems.

## 3. Non-goals and guardrails

The following are not authorised by this decision:

- Changing live interview scoring.
- Adding database tables or columns.
- Changing SQL policies, grants or retention jobs.
- Deploying a new question-generation or evaluation flow.
- Adding caching or optimising model latency before measurement.
- Claiming that reviewed questions predict hiring outcomes.
- Claiming that AI scoring is reliable before validation.
- Storing interview transcripts or introducing a voluntary answer-history feature as part of this MVP.

Preserve the existing signed-receipt, server-side score validation, session summary, usage controls, number guard and voice-unlock behaviour unless a separately approved design establishes a necessary change.

Voice metrics remain separate from content evaluation.

## 4. Conditions before implementation

1. Complete the answer-text data-lineage and retention review.
2. Approve Performance Framework v1 and its evaluation states.
3. Review the revised criteria D and E.
4. Define and approve pilot pass/fail thresholds.
5. Recruit two independent reviewers for the reference-answer validation.
6. Test question generation, rubric resolution, evidence grounding and score stability without changing production.
7. Review current database policies and grants before any future change that touches live data.
8. Obtain explicit implementation approval for the scope of each change.

## 5. Unknowns that remain open

- Whether production `user_memory` records contain answer text or tips.
- Whether other long-term copies exist in logs, analytics, backups or AI-provider systems.
- Where the industry selection is stored and whether it can be passed to this module safely.
- Whether the current live question flow can accept additional inputs without unintended side effects.
- How consistently the current model scores the same answer across repeated runs.
- Whether the proposed criteria work equally well across role types, seniority levels and industries.
- What numerical validation thresholds the owner will accept.
- Whether `mock_sessions` can record a rubric version without a schema change.

## 6. Change history

- **2026-10-22:** Owner approved the design direction described above.
- This document is a proposed decision record. It does not establish that any code, database, backup or production behaviour has changed.
