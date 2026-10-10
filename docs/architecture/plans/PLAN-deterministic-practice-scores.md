# Plan: deterministic practice scores (steps 2 and 3 of the owner's decision of 2026-10-09)

Status: **plan for the owner's review. Nothing in sections 2 to 5 is implemented.** Step 1 (ATS readiness score computed by code in ATS Builder) is implemented on branch `feat/deterministic-ats-score`, see `docs/DECISIONS.md` ADR-011.
Rule of the project: `docs/AI_ARCHITECTURE_CONTRACT.md` section 1 ("AI MUST NOT calculate a score that code can calculate").

## 1. What changes for each number

| Number | Today | Target |
|---|---|---|
| ATS readiness (ATS Builder) | model | **code** (done in step 1, display only) |
| Resume Scan score and JD match (`scanHistory[0].score`, read by Dashboard and Career Roadmap) | model | step 4 below (not decided) |
| STAR score | model, written by the server since S4 | **structure score by code** + AI feedback labelled `AI_ESTIMATE` |
| Interview answer score and session average | model, written by the server since S4 | **structure score by code** + AI feedback labelled `AI_ESTIMATE` |
| `trust_score` | database formula over the three inputs above | same formula, but fed only by code-computed parts |

## 2. Structure score for a STAR story (code, no model)

Computed per section from the user's own words, then combined with the existing weights (situation 0.15, task 0.15, action 0.40, result 0.30, from `star.js`).

| Check | Section | How |
|---|---|---|
| Length band | all | character count within a band (too short or padded = lower). Bands are UNKNOWN until calibrated on real stories |
| Ownership | action | share of first-person verbs ("I led", "I built") against "we"; counted with a verb list |
| Concrete result | result | contains a quantified number (reuse `bulletHasMetric` from `src/extraction/metrics.js`) |
| Context markers | situation | names a team, time, size or place (pattern list) |
| Vague words | all | density of words such as "stuff", "things", "helped", "tried", from a versioned list |

The score carries `score_type`, `score_version` and the list of checks that produced it ("evidence"), like `scoreResume` does. A section with nothing to check is `null`, not 0.

Honest limit: this measures **form**, not whether the story is good. A person can lift the score by adding a number. That is why the AI feedback stays visible next to it, labelled as an estimate, and why the score is called a structure score.

## 3. Structure score for an interview answer (code, no model)

| Check | How |
|---|---|
| Length band | as above |
| Answers the question | word overlap between question and answer (lexical, versioned stop-word list). Weak signal, low weight |
| Specificity | numbers, proper nouns, tools named |
| Ownership | first person vs "we" |
| STAR cues | presence of situation / action / result cue phrases |
| Hedging and filler | density from a versioned list |

Session score = mean of answered questions (as now). Integrity signals (paste, tab switches, time) stay separate and never change this score in version 1: `PLAN-interview-integrity-signals.md`.

## 4. Trust score

Same database formula (0.40 resume, 0.35 interview, 0.25 STAR). Changes:
1. The three inputs come from code-computed scores only.
2. The resume input needs a **server writer**: today no code inserts `resume_scans` (finding F-12: ATS part is always 0 and the maximum trust score is 60). New Edge Function `score-resume`: takes the resume text, computes `computeDeterministicScore` on the server (the same pure code), writes `resume_scans` with the service role. The browser cannot write that table since S4 slice 3.
3. Score columns record `score_type` and `score_version` (the 2026-10-08 metadata columns on `resume_scans` already exist; the other two tables need the same).
4. **Old rows:** kept as history, marked `legacy`, not used for the current score (owner decision of 2026-10-09). A user with only old rows has `null`, shown as "not enough data".

## 5. Work packages (each independently shippable)

| # | Package | DB change | Notes |
|---|---|---|---|
| 2a | Pure module `starStructureScore` + tests (same input, same output; fixtures in English and Vietnamese) | no | Vietnamese text must be tested: word lists and first-person markers differ |
| 2b | Pure module `interviewStructureScore` + tests | no | |
| 2c | `score-star` / `score-interview` return the structure score as the number; the AI result becomes `feedback` with a label | columns for `score_type`, `score_version` | the server already writes these rows |
| 2d | UI: show the structure score and its checks; AI feedback under a clear "AI estimate" label | no | |
| 3a | `score-resume` Edge Function + ATS Builder / Resume Scan call it after parsing | no | closes F-12 |
| 3b | Trust formula reads only computed parts; legacy rows excluded; `null` rules (plan S5) | trigger update | needs owner SQL run |
| 4 | Resume Scan score and JD match: decide which part is code (keyword overlap against the JD, already partly in `checkKeywords`) | maybe | separate decision; Dashboard and Roadmap read this number |

## 6. Decisions needed from the owner

1. Names shown to users: "Structure score" for STAR and interview, "ATS readiness" for the resume. OK?
2. Should the AI feedback keep a 0-100 number at all? Suggested: **no number**, only text and strengths/gaps, so there are never two competing scores.
3. Language: the first version supports English wording lists; Vietnamese lists in the same release or the next?
4. Package 4 (Resume Scan and the Dashboard numbers): include now or later?
5. Calibration: thresholds (length bands, vague-word weights) are guesses until real stories exist. Agree to label the score "beta" until at least 50 real stories have been checked by a person?
