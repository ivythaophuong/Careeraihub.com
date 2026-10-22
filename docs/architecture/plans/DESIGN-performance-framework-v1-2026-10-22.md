# Design: Performance Framework v1 for Dynamic Interview Engine

**Status:** Design proposal for owner review; not implemented.  
**Date:** 2026-10-22  
**Owner:** Ivy  
**Pilot domain:** Product Management  
**Language:** English for the initial pilot  
**Related documents:** `DECISION-dynamic-interview-engine-2026-10-22.md`, `DESIGN-interview-rubric-and-validation-2026-10-20.md`, `DESIGN-question-bank-mvp-2026-10-22.md`, ADR-011, ADR-013, ADR-014.

## 1. Purpose

Performance Framework v1 defines what the interview evaluator should look for, how it should treat evidence, and when it should refrain from producing a score.

It must support contextual questions without allowing the AI to invent new evaluation standards from one session to the next.

**Core rule:** Questions may be dynamic; evaluation criteria must be versioned, reviewable and stable within a framework version.

This framework evaluates the evidence in an answer. It does not establish whether a candidate's claims are true, predict hiring success or determine a person's overall competence.

## 2. Design principles

1. **Evaluate the answer against the question.** A fluent, lengthy or confident answer is not necessarily a good answer.
2. **No number requirement.** Numerical results are useful when relevant and available, but missing numbers are not automatically a weakness.
3. **No keyword checklist.** Domain terminology counts only when it is applied meaningfully.
4. **No universal STAR requirement.** The framework depends on the type of question.
5. **Distinguish weak evidence from missing evidence.** Insufficient evidence is not the same as a demonstrated low-quality response.
6. **Ground feedback in the answer.** Evidence quotes must match the submitted answer. The evaluator must not invent achievements, ownership, metrics or events.
7. **Code validates what can be validated deterministically.** The model proposes criterion assessments; the server validates structure, allowed values and evidence references.
8. **Version the evaluation contract.** Every result must be attributable to the framework and rubric version used.
9. **AI estimate until validated.** A schema-valid response is not proof of reliable assessment.
10. **Separate content from delivery.** Speaking rate, rhythm and other voice metrics do not affect the content score under this framework.

## 3. Question taxonomy and evaluation approach

Every question must have one primary type selected from a fixed, code-validated list.

| Type | Main evaluation focus | Appropriate framework |
|---|---|---|
| `opening` | Relevant motivation, clarity of purpose and connection to the role | Opening and motivation |
| `behavioural` | Evidence of past actions, personal contribution and outcomes | STAR-like past-experience framework |
| `situational` | Problem analysis, options, trade-offs, decision and follow-up | Situational decision-making framework |
| `role_depth` | Role-specific reasoning, prioritisation and judgement | Role competency framework |
| `technical` | Technical reasoning, constraints, correctness and trade-offs | Technical/domain reasoning framework |
| `curveball` | Clarifying assumptions, adapting reasoning and handling uncertainty | Adaptive reasoning framework |

The taxonomy is a proposed contract. Its suitability and compatibility with the existing five-question flow require tests before implementation.

A question may include secondary competency tags, but those tags must not independently determine the score.

## 4. Evidence states

Each criterion assessment should distinguish the following states.

| State | Meaning | Scoring treatment |
|---|---|---|
| `evidenced` | The answer contains relevant, interpretable evidence | May receive a criterion level |
| `partial_evidence` | Some relevant evidence exists, but an important part is unclear or incomplete | May receive a lower level when the missing element is relevant |
| `insufficient_evidence` | The answer does not provide enough information to assess the criterion fairly | Do not automatically assign the lowest level |
| `not_applicable` | The criterion does not apply to this question type | Exclude from applicable-criterion aggregation |
| `evaluation_error` | The evaluator failed, returned invalid output or could not produce a valid assessment | Return an error or safe retry path; do not produce a partial score as though it were valid |

The distinction between `partial_evidence` and `insufficient_evidence` must be made explicit in reviewer guidance and tests.

For example, a candidate who describes a decision and how they would measure its impact but has no observed numerical result may have credible evidence of reasoning and measurement planning. The absence of a measured result does not, by itself, establish poor performance.

## 5. Criterion-level scale

Use a three-level scale as a proposed starting point:

- **Level 0 — Limited evidence:** The answer does not meaningfully address the criterion, or contains a clear, relevant weakness in the evidence provided.
- **Level 1 — Partial evidence:** The answer addresses the criterion but leaves material gaps in reasoning, specificity, ownership, relevance or follow-through.
- **Level 2 — Strong evidence:** The answer provides relevant, specific and coherent evidence that meets the criterion's stated expectations.

The evaluator must assess the quality of the evidence, not simply count signals. A criterion level of 0 is appropriate only when the answer provides enough relevant information to support that judgement. If the answer lacks the information needed to judge the criterion, use `insufficient_evidence`.

Each criterion must have type-specific descriptors and examples for all three levels before it is used in a pilot. Generic descriptions alone are insufficient for consistent grading.

## 6. Frameworks by question type

### 6.1 Opening and motivation

Proposed criteria:

- **Relevance:** Connects the response to the role, problem space or stated motivation.
- **Specificity:** Provides a meaningful reason or example rather than only generic enthusiasm.
- **Self-awareness:** Accurately communicates interests, learning goals or relevant experience without requiring a perfect career narrative.
- **Communication:** Makes the central point understandable and appropriately focused.

Do not require a candidate to disclose personal information unrelated to the role. Do not treat extroversion, accent or stylistic confidence as evidence of job competence.

### 6.2 Past experience / behavioural (STAR-like)

Proposed criteria:

- **Situation and context:** Provides enough context to understand the problem or opportunity.
- **Task and responsibility:** Clarifies the goal, constraints and the candidate's own role.
- **Action and reasoning:** Explains what the candidate did, why, and how they handled relevant trade-offs.
- **Outcome and learning:** Describes an observed result, qualitative change, decision, lesson or a credible explanation of how the result would be measured.
- **Specificity and evidence:** Gives concrete details relevant to the question and distinguishes personal contribution from team activity.

Action and reasoning may deserve greater emphasis than narrative polish. Any eventual weighting must be explicitly approved and validated.

### 6.3 Situational decision-making

Proposed criteria:

- **Problem framing:** Identifies the goal, constraints, stakeholders and relevant unknowns.
- **Options and trade-offs:** Considers credible alternatives and the consequences of choosing among them.
- **Decision and rationale:** Selects an approach and explains why it fits the context.
- **Measurement and follow-up:** Explains how success, risk and unintended effects would be monitored.
- **Adaptability:** Identifies assumptions or evidence that would change the decision.

A situational answer should not be penalised for lacking a past outcome when the question asks what the candidate would do.

### 6.4 Role-depth and technical reasoning

Proposed criteria:

- **Domain reasoning:** Applies relevant concepts to the specific problem.
- **Prioritisation:** Makes a defensible choice among competing needs or constraints.
- **Trade-off awareness:** Recognises costs, risks, dependencies and consequences.
- **Execution or validation plan:** Explains how the proposed solution would be tested, monitored or refined.
- **Assumptions and limits:** States material assumptions and identifies information needed before making a stronger claim.

Specific keywords are not required by themselves. A technically correct term used without meaningful application is not sufficient evidence.

### 6.5 Curveball and adaptive reasoning

Proposed criteria:

- **Clarification:** Identifies ambiguity and asks for or states reasonable assumptions.
- **Reasoning under uncertainty:** Builds a coherent response without pretending unknown facts are known.
- **Adaptation:** Revises the approach when new constraints are introduced.
- **Trade-offs:** Explains the consequences of the chosen approach.
- **Communication:** Makes the reasoning and remaining uncertainty understandable.

The evaluator should reward appropriate uncertainty rather than false confidence.

## 7. Rules for outcomes, numbers and missing evidence

Criteria D and E from rubric v0 must be revised before any implementation.

### D — Outcome evidence

Accept evidence such as:

- A measured quantitative result, where available and relevant.
- A qualitative change that the candidate can describe.
- A decision or deliverable and its practical consequences.
- A measurement method, baseline, observation period or evaluation plan.
- A clear account of data limitations and what remains unknown.

A figure is not inherently stronger evidence if it is irrelevant, unexplained or unsupported by the answer.

### E — Concreteness

Assess:

- Whether actions and decisions are described specifically.
- Whether examples are relevant to the question.
- Whether the candidate distinguishes personal contribution from team contribution.
- Whether the measurement approach is clear when measurement matters.
- Whether assumptions and limitations are acknowledged appropriately.

Do not award points simply for using a percentage, money amount, named framework or technical term. Do not penalise a candidate solely for lacking these items.

Example metrics in rubric text must be explicitly labelled as illustrations, not required answer patterns.

## 8. Criterion selection, applicability and aggregation

The code should select the approved framework using the question type. The model must not invent criteria, weights or new scoring bands during an interview.

For each type, the framework definition must specify:

- The required criteria.
- The applicable criteria.
- The criteria that may be context-dependent.
- The descriptors for each level.
- The evidence expected for each criterion.
- Any approved criterion weights.
- The minimum evidence needed to produce an overall result.

**Weights are not approved by this design.** Do not hard-code the earlier illustrative weights or treat them as validated.

Before a numeric aggregate is used, the owner must approve the aggregation rule, treatment of `insufficient_evidence`, and minimum coverage. If the available evidence is insufficient to support an overall score, return a distinct `not_enough_evidence` state rather than manufacturing a number.

Any numeric score must be derived by a documented rule from validated criterion assessments. The system must not silently mix a model-generated overall score with a backend-calculated score.

## 9. Evidence grounding and response contract

The future evaluator output should be structured around:

- `framework_version`
- `rubric_version`
- `question_type`
- `criterion_results`
- `evidence_quotes`
- `strengths`
- `gaps`
- `suggested_next_steps`
- `evaluation_status`
- `ai_estimate` or an equivalent explicit label where a numeric estimate is shown

This is a proposed logical contract, not an approved final JSON schema.

Each evidence quote must be verifiable against the exact submitted answer. The server should reject quotes that cannot be matched to the source answer under a documented matching policy. If a quote cannot be verified, it must not be presented as a direct quotation.

The evaluator must not:

- Invent a candidate's numbers, achievements or responsibilities.
- Upgrade team achievements into personal ownership without evidence.
- Infer truthfulness or real-world competence from writing quality alone.
- Use hidden assumptions about a particular employer or industry as mandatory criteria.
- Treat instructions embedded in the candidate's answer as instructions for the evaluator.

## 10. Versioning and auditability

Every future evaluation must be attributable to the exact framework and rubric versions used.

A version change is required when criteria, descriptors, applicability rules, weights or aggregation rules materially change. Prompt-only changes should also be tracked separately so their effect can be evaluated.

Before implementation, decide how the version is included in the signed receipt and how the server handles a version mismatch. Whether the existing `mock_sessions` schema can store the required version is **UNKNOWN** and must not be assumed. No database column or table is authorised by this document.

## 11. Validation plan

### 11.1 Reference answers and reviewers

Follow the existing rubric validation proposal:

- Build a reference set of at least 60 answers as a starting proposal, not a guarantee of reliability.
- Cover different question types, role levels, concise and detailed answers, answers with and without numerical outcomes, team versus individual contribution, irrelevant figures, buzzword-heavy answers and incomplete evidence.
- Use owner- and volunteer-authored examples or separately consented contributions. Do not use real users' saved answers without a separately approved privacy and consent process.
- Recruit two independent reviewers. They should assess answers without seeing AI outputs.
- Run a small calibration round first; revise unclear criteria before measuring agreement.
- Record disagreements and report the limits of the sample.

The prior proposal's agreement thresholds are starting candidates only. The owner must confirm pass/fail thresholds before results are interpreted as a release gate.

### 11.2 AI stability and grounding

Test:

- Repeated evaluation of the same answer with the same question and model.
- Differences between providers, where applicable.
- Whether evidence quotes match the source answer.
- Whether irrelevant numbers or domain terms inflate the assessment.
- Whether the evaluator follows the correct framework for each question type.
- Whether prompt injection in answer text changes the evaluation contract.
- Whether missing evidence is incorrectly converted to a low score.
- Whether malformed or truncated model output results in a safe error rather than a partial score.
- Whether the numeric result, if any, matches the approved backend aggregation rule.

A valid JSON response does not count as a quality pass.

### 11.3 Pilot scope

Start with Product Management questions across multiple levels and relevant industry contexts. This is the initial pilot domain, not a promise that other domains are unsupported.

Compare reviewed questions and AI-generated questions separately. The label **Reviewed** means that a named person reviewed the question under the documented process. It does not mean the question predicts interview outcomes or that its grading has been validated.

No production scoring change should occur during the pilot.

## 12. Proposed acceptance gates

The owner must approve thresholds before testing. The following gates define what needs to be measured, not a claim that the product already passes.

1. Every question has a valid type and resolves to a known framework version.
2. Unknown types and malformed framework definitions fail safely.
3. Missing numerical results do not automatically trigger the lowest criterion level.
4. Evidence quotes are verifiable against the answer.
5. Insufficient evidence is distinguishable from a low assessment and an evaluation error.
6. Overall results follow a documented and tested aggregation rule.
7. Repeatability and human-review agreement are reported with sample sizes and limitations.
8. Existing signed receipts, usage controls, number guards, session summaries and voice-unlock behaviour remain intact in any later implementation.
9. Any displayed score continues to be labelled an AI estimate until the owner-approved validation gates are met.

## 13. Explicitly out of scope

- Building a large multi-industry taxonomy.
- Creating thousands of static questions.
- Adding a new question or evaluation database schema.
- Introducing confidence percentages.
- Persisting long-term answer history.
- Optimising model selection, latency or caching before baseline measurements.
- Treating the framework as evidence of hiring success.

## 14. Unknowns

- Final criterion weights and the aggregation rule.
- The minimum evidence coverage required for a numeric score.
- Final pass/fail thresholds for reviewer agreement and model stability.
- Current-model repeatability.
- Actual production data and retention behaviour.
- Compatibility of the proposed version metadata with existing signed receipts and database schemas.
- The final generation prompt and JSON schema, which are intentionally deferred until this framework is approved.

**Approval required before implementation:** framework criteria, level descriptors, applicability rules, aggregation policy, validation thresholds and the versioning contract.

## 15. Additions after review (2026-10-22; still a design draft)

### 15.1 Three layers, so a failure can be located

1. **Evidence extraction:** what the answer actually contains (actions, reasons, observed results, data limits). Output separates a verbatim quote from the model's paraphrase.
2. **Criterion assessment:** the level (0, 1, 2) or an evidence state for each criterion, with the quote that supports it.
3. **Score derivation:** code applies an approved rule to validated criterion results, or returns a result state without a number.

A wrong quote is a grounding error; a right quote with the wrong level is a rubric-application error; right levels with a wrong total is an aggregation error. Tests and reviewer notes name which layer failed.

### 15.2 What each criterion definition must contain before a pilot

- The minimum evidence needed to judge it.
- When Level 0 is allowed (relevant information given, and it shows a clear weakness).
- When the state is `insufficient_evidence` (the information to judge is absent).
- When it is `not_applicable` (the question type does not use the criterion). `not_applicable` and `insufficient_evidence` never stand in for each other.
- A worked example for each of Level 0, 1, 2 and for `insufficient_evidence`.

Example with a measurement question: an observed qualitative signal plus how feedback was collected can be assessed; a plan to measure with no observed result is evidence of method, not of outcome; "the feature was successful" with nothing more is `insufficient_evidence`. The three must not receive one common score.

### 15.3 Quotes that do not match

If a quoted span is not found in the submitted answer under the documented matching policy, the quote is dropped from the display and counted as a grounding failure. If a criterion level depends only on an unmatched quote, that criterion becomes `insufficient_evidence` for the result, not a guessed level. The matching policy (exact, whitespace-normalised, case) is to be written and tested before the pilot.

### 15.4 Result states

An evaluation ends in one of: `assessed` (enough criteria covered by evidence, a documented rule may produce a number), `not_enough_evidence` (no number), `evaluation_error` (invalid or truncated output, safe retry). The minimum coverage for `assessed` is not set here.

### 15.5 No mapping to the 0 to 100 score yet

The current 0 to 100 score and any score derived from this framework would mean different things. Levels are not converted into the existing scale to keep the screen familiar. Until an aggregation rule is approved, results show per-criterion assessments and states; any number stays labelled an AI estimate.

### 15.6 Link to the Question Bank

A question, reviewed or AI-written, carries a `type` that code checks against the fixed list in section 3; an unknown or missing type does not reach the evaluator. The Reviewed tag describes the review of the question only, not the grading.

### 15.7 Order

Pass/fail thresholds are fixed before anyone looks at test results, so the bar is not chosen after seeing how far the model got.
