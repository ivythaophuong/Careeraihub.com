# Structure scores (Gate A: pure scoring modules)

Deterministic scores for a STAR story and for interview answers. They measure the **form** of the text: length, who acts, something countable, context, vague or hedging wording. They do **not** measure whether the text is true, good, a sign of competence or hiring suitability. No model, network, database or browser is involved (a test checks the imports).

Owner's acceptance criteria and merge gates: `docs/architecture/plans/ACCEPTANCE-deterministic-practice-scores.md`. This folder is Gate A only. Nothing here is used by the app, the Edge Functions or the database yet; no language is enabled (`languageGate.js` is empty), so every call returns `unsupported_language` until the owner enables a language after its human review.

## Contract (`contract.js`)

Every result: `score_type`, `score_version`, `status`, `score`, `language`, `evidence`, `notes` (STAR also `sections`).
- `status` is `scored`, `insufficient_data`, `unsupported_language` or `processing_error`. `score` is an integer only when `scored`; otherwise `null`. A processing error is never a score.
- `evidence` lists every check with its weight, outcome (`pass`, `partial`, `fail`, `not_evaluated`) and the counts it looked at.
- Results of different types or versions are not comparable (`comparable()`); the session score leaves out answers scored under another version.

## Rules

| Piece | Rule |
|---|---|
| STAR aggregation | All four sections must have at least 3 words. If any is missing the result is `insufficient_data` and no score is given; the other sections' weights are never inflated. Weights 0.15 / 0.15 / 0.40 / 0.30 (a test checks they equal `starScoring.js`) |
| STAR checks | Situation: length, context (time, place, scale), vague words. Task: length, stated responsibility, vague words. Action: length, who acts (I against we), vague words. Result: length, countable result, vague words |
| Interview answer checks | length (0.10), words shared with the question (0.20, weak signal; parroting cannot score high), specific details (0.25), who acts (0.15), STAR cue phrases (0.15, optional: a relevant answer without STAR can score well), hedging and filler (0.15) |
| Session score | Mean of the answers that were `scored`. Skipped, too-short, unsupported-language, failed and other-version answers are counted in the evidence and left out; never counted as 0. No scored answer: `insufficient_data` |
| Language | Detected from function words (`and`, `the`, `và`, `của`...); English words inside a Vietnamese sentence do not matter. Mixed full sentences, other languages and non-Latin scripts are `unsupported_language`. A language that is detected but not enabled is also `unsupported_language`: Vietnamese is never scored with English rules |
| Vietnamese | Diacritics kept (text is NFC-normalised, not stripped). "chúng tôi" is team wording, not "tôi". Length bands are multiplied by 1.4 because Vietnamese is written in syllable-words |
| Integrity signals | Not inputs. Extra fields such as paste counts change nothing (a test checks it) |

## Versions

`rules.js` holds the weights, bands and thresholds; the word lists are in `lexicon.en.js` and `lexicon.vi.js`. `rulesFingerprint(scoreType)` hashes all of them. `structure.test.js` pins the version and fingerprint of each score type: if you change any weight, threshold, list, tokenisation or language rule, that test fails until you bump `SCORE_VERSIONS` and update the pinned fingerprint on purpose. Versions are `1.0.0` and have not been used by any stored data.

## What is not done (later gates)

- No human review or calibration (needs 50 real STAR stories, reviewed per language); thresholds and word lists are first guesses and the score must be labelled beta when it is ever shown.
- No server function, UI or database use (Gate B). No change to Resume Scan, JD Match, Trust Score or any trigger (Gate D).
- Limits: a person can raise the score by adding a number or an "I"; lists are short and miss many phrasings; text typed in Vietnamese without diacritics is not recognised as Vietnamese.
