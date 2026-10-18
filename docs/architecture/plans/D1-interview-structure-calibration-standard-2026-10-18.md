# D1: how the interview Structure Score is calibrated before anyone sees it

Status: **STANDARD PROPOSED for the owner's approval. Nothing here is deployed; the product still scores nothing by rules.** Written 2026-10-18 after an outside review of `PLAN-voice-and-deterministic-first-2026-10-18.md`, which asked for a concrete evaluation standard before any wiring or voice work.
Labels: VERIFIED (read in the repo or run) · PROPOSED (a number or rule the owner must approve) · UNKNOWN · APPROVAL.
Builds on: `ACCEPTANCE-deterministic-practice-scores.md` (owner decisions and Gates A to D), `supabase/functions/_shared/structure/`, ADR-013.

## 1. Three questions kept apart

A correct answer to one does not prove the others.

| # | Question | How it is answered | Where |
|---|---|---|---|
| Q1 | **Is the measurement reliable?** Does the Structure Score reflect how well an answer is built? | This document (D1): humans rate, the harness compares, per language | here |
| Q2 | **Is the AI guidance trustworthy?** Useful, no invented facts, no claims the answer does not support, no number | Guard tests on AI output (section 6) | here, section 6 |
| Q3 | **Is the voice pipeline safe?** Accurate enough, private, within budget | The voice brief and the spike (V1) | `DECISION-voice-practice-2026-10-18.md` |

Passing Q3 (a good transcript) says nothing about Q1, and a high Q1 says nothing about Q2.

## 2. What the Structure Score means, and does not

| Term | Meaning |
|---|---|
| **Structure Score** | How far the answer meets the structural features the rules define: length, words shared with the question, specific details, who acts, situation/task/action/result cues, hedging. A signal of **form**. |
| **AI guidance** | Written strengths, gaps and suggestions. No number. |
| **Interview performance** | How good the answer really is. **Not measured by the Structure Score** and not claimed by the product. |

The scorer can be wrong in both directions: a short answer that hits the point can score low; a long answer full of cue words can score high and still miss the question; natural Vietnamese phrasing may not fit rules written first for English. Hence the beta label and the sentence "it measures how the answer is built, not how good it is, not whether it is true, not your competence or fit for a job", already required by the acceptance document.

## 3. What is true today (VERIFIED, run on 2026-10-18)

- The scorer is pure code and is **not used by the app, the Edge Functions or the database**. Its language gate `ENABLED_LANGUAGES` is **empty**: with the product's own settings it returns `unsupported_language` for **every** answer, English included. This is by design (a language is enabled only after it passes its acceptance tests).
- The calibration harness (`scripts/calibration/`) therefore switches both languages on **for the run only** and never touches the gate.
- An informal look at five invented answers with both languages on (not a measurement, n = 5): the Vietnamese answers scored 63, 83, 78 and, written without diacritics, 40; a strong English answer scored 58. One of them (83) came from a Vietnamese answer that began with a block of capital letters, so the score is sensitive to how the text is written. This is the reason to measure, not a finding.

## 4. The D1 standard (PROPOSED: the numbers are starting points, none is measured)

**4.1 Rubric.** Reviewers rate the **structure** of the answer, not whether it is true or the person is good, with one label: `complete` (context, own actions, and a result or consequence are all present and clear), `partial` (some are present, or they are vague), `incomplete` (most are missing, or it only repeats the question). The written rubric with two examples per label and per language is part of the review pack, reviewed by the owner before any rating.

**4.2 Ground truth.** At least **2 independent reviewers** per answer, who do not see the score. The label is the majority. If every reviewer differs the answer is recorded as a **disagreement** and left out of the accuracy numbers, but **counted and reported**. A single reviewer never makes a label that counts. Reviewers' agreement is reported (percent and Cohen's kappa); if it is low, the rubric is the problem and the run does not count.

**4.3 Evaluation set (per language, English and Vietnamese apart).** At least **50 answers with an agreed label** for each language (the 50 reviewed STAR stories do not count for interview answers). It must include: strong, weak, incomplete, padded, team-based ("we"), quantified but irrelevant, very short but on target, long and unfocused, natural phrasing, English words inside Vietnamese text, and answers with and without diacritics (spoken answers will arrive as transcripts with their own errors: the set should include transcript-like text once V1 can produce it).

**4.4 Metrics, reported per language, never one blended average.**
- Reviewer agreement (pairwise percent, kappa).
- Spearman rank correlation between the score and the human label.
- **Misleading high:** human `incomplete` answers the rules score 80 or more (the harm that matters most).
- **False fail:** human `complete` answers the rules score below 50.
- The answers the rules did not score (insufficient data, unsupported language, error), the disagreements, the single-reviewer rows: all counted and shown.
- The ids of every misleading high and false fail, so each can be read.
- The gap between the two languages.

**4.5 Release criteria for moving from owner-only evaluation to a beta (PROPOSED).** For each language, all of: at least 50 agreed answers; pairwise reviewer agreement at least 70 percent; Spearman at least 0.5; misleading-high rate at most 10 percent; false-fail rate at most 10 percent. The owner reads the report, including bias by language and writing style, and approves in writing. Weights and thresholds change only through versioned changes with regression tests (`structure.test.js`). The UI stays labelled beta until the owner removes the label. These numbers are my proposal: the owner may set them differently; they are in `scripts/calibration/interviewCalibration.js` as `CRITERIA` with `status: 'proposed'`.

Verdicts the harness can give: `insufficient_sample` (not enough agreed answers in some language: no pass, no fail), `not_met`, `met`. It never gives `met` on a small sample.

## 5. Data plan: two modes, kept apart

| Mode | What | Data kept |
|---|---|---|
| **Normal use** | The product as promised: no audio and no answer text on the server (ledger D-3). | A hash and the length of an answer, scores and feedback only. |
| **Calibration (not product data)** | Answers collected **for the rating exercise only**: written or recorded by consenting volunteers (the owner, friends, paid reviewers) or invented, with a separate written consent that says the purpose, who sees it, how long it is kept and how to have it deleted. | A **private folder outside the repository and outside the product database**, with a retention date. No identity in the rows. Real users' answers are **never** moved there because they used a feature, including voice. |

Consequence for voice: the V1 spike checks the technical path (permission, transcript, errors, cost, latency). It is **not** a source of calibration data unless a separate calibration consent exists for that recording. The owner can record consenting samples for the comparison of speech providers.

## 6. Guard tests for the AI guidance (Q2)

`factGuard`, `numberGuard` and `claimGuard` exist (VERIFIED). Before the guidance is shown next to a Structure Score, a test set must cover, in English and Vietnamese:
1. A figure in the guidance that is not in the answer.
2. A claim the answer does not support ("you have not shown leadership" when the answer has too little to judge).
3. A conclusion stated with more certainty than the evidence allows.
4. Advice unrelated to the answer.
5. Vietnamese text a check may misread (diacritics, English terms inside Vietnamese, units).

Rule for the guidance: when the evidence is not enough, say what is missing and ask for more detail; do not infer. The guidance carries no number.

## 7. Cost has three layers, and only the third is a limit

1. **Free:** the rules step needs no model.
2. **Early stop:** an answer that is too short, silent or in an unsupported language never reaches the AI.
3. **A limit on the whole session:** total audio seconds, requests, input size, retries and concurrency, enforced on the server by the usage ledger. Layers 1 and 2 do not replace layer 3. The ledger limits tokens, requests and concurrency today; audio seconds need a small additive SQL change before voice is used widely (voice brief, V6). The price figures in the voice brief are estimates until a real session is measured.

## 8. Order of work (adjusted after the review)

| Step | Work | Needs |
|---|---|---|
| **P0** | This standard approved by the owner; the harness merged; the review pack (rubric, templates) prepared; the owner reads the code path of `mock_sessions` and every place that reads a score before anything is wired | Owner |
| **P1** | **D1 run:** collect the set under the calibration mode, two reviewers, run the harness, write the report. In parallel **D2**: an owner-only panel that shows the rules next to the existing AI feedback, flag off, changes no score and stores nothing | Reviewers, consent, owner |
| **P2** | **V1 voice spike** on its own, owner's account: quality of Vietnamese transcripts, latency, errors, request limits, real cost, two providers on the same consented sample | Owner's decisions V1 to V7 |
| **P3** | D3 and V2: API contract and states, resource limits, user notice, consent, retention, provider terms, legal review | Owner, legal |
| **P4** | D4 (Gate C): beta only when calibration, security, privacy and cost limits are all met; in stages, not for everyone at once | Owner |

**Decision X stays out of this phase:** replacing the AI number in `mock_sessions`, and so the Trust Score, with the Structure Score is a separate decision with its own ADR, a backward-compatibility plan and tests of every consumer of the score.

## 9. Not verified

How accurate the rules are on any real answer (no calibration set exists yet); how they behave on speech transcripts; the speech providers' Vietnamese accuracy; whether the proposed numbers in 4.5 are the right ones.
