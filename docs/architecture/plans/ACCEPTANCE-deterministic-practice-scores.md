# CareerAiHub — Deterministic Practice Scores: Acceptance Criteria & Merge Gates

**Status:** Owner decisions recorded; implementation pending review (text of the owner's roadmap of 2026-10-10, kept as written)
**Scope:** STAR Structure Score and Interview Structure Score
**Out of scope:** Resume Scan/JD Match migration, `score-resume` production implementation, Trust Score formula changes and database trigger deployment.

Implementation status (updated by the assistant, not part of the owner's text): Gate A is implemented in `supabase/functions/_shared/structure/` (see its README). Gates B to D are not started.

## 1. Owner decisions

1. User-facing names: **Structure Score** for STAR stories and interview answers; **ATS Readiness** for resume scoring.
2. AI feedback: text-only. No AI-generated 0–100 score in the user-facing experience.
3. Languages: English and Vietnamese, but each language is supported only after passing its own acceptance tests.
4. Resume Scan and JD Match: deferred to a separate decision and implementation plan.
5. Calibration: remain in pre-release evaluation until at least 50 real STAR stories have been reviewed by a human evaluator and the quality gate below has been met. The sample count alone does not authorize release.

## 2. Shared scoring contract

Every deterministic score must expose a consistent, versioned contract. Adapt the exact field names to existing project conventions before implementation.

Required fields:

* `score_type`: identifies the metric, e.g. `star_structure` or `interview_structure`.
* `score_version`: identifies the exact scoring rules and weights.
* `score`: numeric value only when sufficient supported evidence exists; otherwise `null`.
* `status`: at minimum `scored`, `insufficient_data`, `unsupported_language` or `processing_error`.
* `evidence`: the checks actually performed, their outcomes and relevant counts. Do not claim checks that were not run.
* `language`: the language used for scoring when it can be identified reliably.

Acceptance criteria:

* [ ] The same normalized input, language, and score version produce the same result.
* [ ] The scoring function is deterministic and has no model, network, database or browser dependency.
* [ ] Missing evidence is not silently converted to zero.
* [ ] Unsupported language is not scored using English rules as a fallback.
* [ ] A processing failure cannot be stored or displayed as a valid score.
* [ ] Scores from different versions are not silently treated as directly comparable.
* [ ] The scoring contract and version-selection rules are documented and covered by tests.
* [ ] Any change to weights, thresholds, vocabulary lists, tokenization or language rules increments the score version.

## 3. Package 2a — STAR Structure Score

The initial score uses the existing STAR section weights, subject to verification against `star.js`:

* Situation: 0.15
* Task: 0.15
* Action: 0.40
* Result: 0.30

Acceptance criteria:

* [ ] Length, ownership, concrete-result signals, context markers and vague-word density are implemented as versioned, testable rules.
* [ ] Every section score is calculated only from that section's eligible evidence.
* [ ] An absent or unassessable section returns `null`, not an invented zero.
* [ ] The aggregation rule defines what happens when one or more sections are missing; missing sections are not silently treated as zero or used to inflate the remaining weights.
* [ ] The evidence output explains which checks passed, failed or could not be evaluated.
* [ ] A quantified result is treated as a structural signal, not proof that the result is true or meaningful.
* [ ] First-person wording is not treated as proof of individual ownership.
* [ ] Tests include short, padded, vague, quantified-but-irrelevant, first-person, team-based, incomplete and non-STAR stories.
* [ ] English and Vietnamese fixtures pass their respective language-specific test suites before either language is enabled for users.

## 4. Package 2b — Interview Structure Score

Acceptance criteria:

* [ ] Length, question-answer lexical overlap, specificity, ownership, STAR cues and filler/hedging are calculated by deterministic rules.
* [ ] Question-answer word overlap is documented as a weak relevance signal, not proof that the question was answered.
* [ ] Repeating words from the question without providing an answer does not automatically earn a high score.
* [ ] A short but relevant answer is not automatically treated as poor solely because of length.
* [ ] Numbers, proper nouns and named tools are signals of specificity, not proof of correctness.
* [ ] Session score is calculated from eligible answered questions according to a documented aggregation rule.
* [ ] Unanswered questions, unsupported-language answers and processing failures are handled explicitly; they do not silently become zero.
* [ ] Integrity signals such as paste events, tab switches and response time remain separate and do not change the Structure Score in version 1.
* [ ] English and Vietnamese tests cover code-switching, accents represented in text, filler variations, lexical repetition and answers that are relevant without following STAR.
* [ ] The same input and score version always yield the same score and evidence.

## 5. AI feedback and UI

Acceptance criteria:

* [ ] The UI uses the approved names: **Structure Score** and **ATS Readiness**.
* [ ] AI feedback contains written strengths, gaps and actionable suggestions; it does not show an AI-generated 0–100 score.
* [ ] AI feedback is labelled clearly as AI-generated guidance or an estimate, not a verified assessment.
* [ ] The deterministic score and AI feedback are visually distinct.
* [ ] The UI explains that Structure Score measures answer/story structure, not truthfulness, professional competence or hiring suitability.
* [ ] The score's checks and evidence are available to the user in understandable language.
* [ ] `null`, `insufficient_data`, `unsupported_language` and `processing_error` have distinct, accurate UI states.
* [ ] Unsupported-language content does not receive a misleading low score.
* [ ] No AI score is consumed downstream as a deterministic score, used in Trust Score, or persisted as a new deterministic result.
* [ ] Existing historical AI-generated scores remain distinguishable from new deterministic scores and are not silently relabelled.
* [ ] Automated UI tests verify the absence of AI numeric scores and verify all non-success states.

## 6. Language acceptance gate

English and Vietnamese are evaluated independently.

For each language:

* [ ] First-person and team-ownership markers are tested against realistic language-specific phrasing.
* [ ] Verb lists, vague-word lists, filler lists, stop words and text normalization are versioned.
* [ ] Vietnamese tests cover diacritics, punctuation, spacing, common inflections and natural phrasing.
* [ ] English tests cover common verb forms, contractions, team-based language and varied answer structures.
* [ ] Tests include negative cases designed to expose easy score inflation.
* [ ] A reviewer checks representative outputs against the source text.
* [ ] A language is enabled only if its test suite and human-review gate pass.

If one language fails, that language remains unsupported. The other language may proceed if its own gates pass. Do not delay or falsely claim support for both based on one language's results.

## 7. Calibration and beta release gate

Before a user-facing beta:

* [ ] At least 50 real STAR stories have been reviewed by a human evaluator.
* [ ] The evaluation set includes strong, weak, incomplete, padded, team-based and quantified-but-irrelevant examples.
* [ ] The language of each example is recorded; English and Vietnamese quality are reported separately.
* [ ] The rubric defines what a human reviewer considers structurally complete and why.
* [ ] The evaluation records disagreements, false positives, false negatives and examples where a high score is misleading.
* [ ] Score distributions and failure cases are reviewed for systematic language or writing-style bias.
* [ ] Thresholds and weights are adjusted only through versioned changes with regression tests.
* [ ] The owner reviews the evaluation report and explicitly approves beta release.
* [ ] The UI labels the score as beta until the owner approves removing that label.

The 50-story threshold is a minimum evaluation sample, not a statistical guarantee. If results are inconsistent or reveal material bias, beta remains blocked.

Interview answers require their own representative evaluation set before their quality is claimed to be calibrated. The STAR-story count alone does not validate the interview scorer.

## 8. Package 3a — `score-resume` security gate

**Not authorized for implementation or production release by this plan alone.**

Before approval, a separate security review must confirm:

* [ ] The function authenticates the caller and derives identity from a verified JWT.
* [ ] The caller can only process a resume they are authorized to access.
* [ ] The function computes the score server-side and does not trust client-provided scores or arbitrary user identifiers.
* [ ] Service-role credentials remain server-side and are never returned to the client.
* [ ] Request size, rate limits, retries, duplicate requests and failure handling are controlled.
* [ ] Resume text and sensitive data are not written to application logs unnecessarily.
* [ ] Database grants, RLS, ownership checks and permitted write paths are verified.
* [ ] Tests cover unauthenticated calls, cross-user access, invalid payloads, duplicate submissions and server errors.
* [ ] Deployment, monitoring and rollback procedures are reviewed separately.

## 9. Package 3b — Trust Score security and data-integrity gate

**No trigger changes, production migrations or Trust Score release until separately approved.**

Acceptance criteria:

* [ ] The source and ownership of each input are verified.
* [ ] Only eligible deterministic scores with approved types and versions are used.
* [ ] Legacy AI-generated scores are retained as history but excluded from the current deterministic Trust Score.
* [ ] The formula's behavior for missing, stale, invalid or differently versioned inputs is explicitly defined.
* [ ] A missing input does not silently become zero or produce a misleadingly comparable aggregate.
* [ ] The database trigger and all score-writing paths are reviewed for authorization, consistency and unintended updates.
* [ ] Tests cover deletion, clearing memory, legacy-only users, mixed versions, duplicate records, invalid records and recovery after failure.
* [ ] Staging tests demonstrate the intended result before any production change.
* [ ] Rollback and post-deployment verification are documented and approved by the owner.
* [ ] The product does not describe Trust Score as verified human trustworthiness, honesty or hiring suitability merely because its components are deterministic.

## 10. Resume Scan/JD Match — explicitly deferred

* [ ] No migration of `scanHistory[0].score`, Dashboard numbers or Career Roadmap values in this implementation.
* [ ] No change to existing Resume Scan or JD Match scoring behavior as part of Packages 2a/2b.
* [ ] No reuse of historical AI scores as deterministic scores.
* [ ] A separate plan must define the metrics, data contract, migration behavior and UI semantics before implementation.

## 11. Merge gates

### Gate A — Pure scoring modules

Packages 2a and 2b may be merged independently when:

* All unit tests and language-specific fixtures pass.
* The shared scoring contract is approved.
* Score versioning, missing-data rules and evidence output are documented.
* No database, production data or unrelated scoring behavior changes are included.
* The full existing test suite and build pass.

### Gate B — Server/API changes and UI

Packages 2c and 2d require:

* Gate A passed.
* API response and persistence contracts reviewed.
* AI numeric scores removed from the relevant user-facing flows and not reused as deterministic inputs.
* Legacy behavior and data preservation verified.
* UI and integration tests pass for success, insufficient data, unsupported language and processing errors.
* No unrelated Resume Scan/JD Match migration included.

### Gate C — Beta enablement

Requires:

* Human calibration report and language-specific results reviewed.
* Beta label visible.
* Monitoring, rollback and owner approval recorded.
* No unresolved critical correctness, security or misleading-score issue.

### Gate D — Resume writer and Trust Score

Packages 3a and 3b require separate security and database reviews, explicit owner approval and staging evidence. Passing Gates A–C does not authorize these packages.

## 12. Required PR evidence

Every PR must include:

1. Scope and packages changed.
2. Score contract and version affected.
3. Tests run and actual pass/fail results.
4. English/Vietnamese coverage, where applicable.
5. Example inputs and outputs, including missing-data cases.
6. Confirmation that legacy scores and unrelated Resume Scan behavior remain unchanged.
7. Security or database impact statement.
8. Rollback plan for changes that affect deployed behavior.

**Merge rule:** passing tests is necessary but not sufficient. No PR may expand its scope into `score-resume`, Trust Score triggers, production schema/data changes or Resume Scan/JD Match migration without the corresponding separate approval.
