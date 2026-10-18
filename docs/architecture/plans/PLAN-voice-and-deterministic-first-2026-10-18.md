# Plan: deterministic first, then AI, and voice as one more way to get the text

Status: **PLAN for the product owner's review. Nothing here is built, applied or deployed.** Written 2026-10-18. It joins two tracks that were drawn separately: the **deterministic practice scores** (`ACCEPTANCE-deterministic-practice-scores.md`, `PLAN-deterministic-practice-scores.md`, ADR-013) and **voice practice** (`DECISION-voice-practice-2026-10-18.md`, `SPEC-mock-interview-journey.md`).
Labels: VERIFIED (read in the repo, run, or measured) · OWNER (decided by the owner) · PROPOSED · UNKNOWN · APPROVAL.

## 1. The question

"How do we make the Mock Interview as deterministic as possible, and use AI only after that? Is there a better way?" Voice is the new input; the answer must hold for typed and spoken answers alike.

## 2. Context: what is true today

| Fact | Status |
|---|---|
| A **deterministic Structure Score for an interview answer** exists: `supabase/functions/_shared/structure/interviewStructure.js` (pure JS: no model, network or database). Checks: length, words shared with the question (weak signal), specific details, who acts (I or we), situation/task/action/result cues, hedging words. English and Vietnamese lexicons, a language gate, four result states (`scored`, `insufficient_data`, `unsupported_language`, `processing_error`), and a missing input is never turned into 0. | VERIFIED |
| It is **not used by the app, the Edge Functions or the database** (nothing outside its own folder and tests calls it). Gate A of the owner's acceptance document is done; Gates B to D are not started. | VERIFIED |
| Today the **AI sets the 0 to 100 score** of each interview answer; `score-interview` signs it in a receipt and saves the average to `mock_sessions`, which the Trust Score trigger reads. | VERIFIED |
| There is **no voice code** (no recording, no speech recognition, no audio upload); the Voice button is disabled. | VERIFIED |
| Guards that run **after** the AI exist: `factGuard`, `numberGuard`, `claimGuard` (invented figures and claims in AI suggestions). | VERIFIED |
| Every AI call goes through the usage ledger (`ai`, `score-interview`, `score-star`), in observe mode. | VERIFIED |

Owner decisions that bind this plan (from `ACCEPTANCE-deterministic-practice-scores.md` section 1 and 5, ADR-012, ADR-013, the 2026-10-15 journey decisions):
- **OWNER** AI feedback is **text only**. No AI-generated 0 to 100 score in the user-facing experience. The user-facing name is **Structure Score**. It measures structure, not truthfulness, competence or hiring suitability.
- **OWNER** English and Vietnamese are supported **only after each passes its own acceptance tests**. The score stays **beta-labelled** until the owner approves. Interview answers need **their own** evaluation set; the 50 reviewed STAR stories do not validate the interview scorer.
- **OWNER** During the voice and journey work, **scoring and the Trust Score are not changed**; any change to them is a separate decision (ADR-013).
- **OWNER** No audio and no answer text on the server (ledger D-3 = C). Transcript first for voice (D1). The speech provider is chosen by the owner, not the implementer (ADR-012).

## 3. The solution: a deterministic-first pipeline

One pipeline for every answer. Voice only changes where the text comes from.

```
 input        typed text                         spoken answer
                 |                                    |
 0  device       length, empty check        record, length, silence check (in the browser, free)
                 |                                    |  too short or silent: ask again, nothing is sent
 1  text         ------------ (voice only) speech-to-text, one call, temperature 0, audio dropped
                 |
 2  rules        Structure Score = scoreInterviewAnswer(question, answer)   [code: instant, free, repeatable]
                 |   not enough text or unsupported language -> a plain message from code, NO AI call
 3  AI           written strengths, gaps, a stronger structure   [text only, labelled "AI-generated guidance"]
                 |
 4  rules        guards on the AI text: no invented figures or claims   [factGuard, numberGuard, claimGuard]
                 |
 5  screen       two panels, visibly different: "Structure Score (rules, beta)" with its checks and evidence;
                 "AI guidance" with no number
```

Why this is the most deterministic version:
- **The number comes from code.** Same answer in, same score out, with the evidence of every check shown. The AI never sets a score (the owner's rule).
- **AI is called only when it can add something**, and only after the rules have said the answer is long enough and in a supported language. That also saves money, and voice is the expensive step (about 10 times a written feedback, estimate), so a failed or silent recording must never reach it.
- **The AI output is checked by code afterwards**, so it cannot add a figure the person never said.
- **Voice adds no new judgement.** Speech-to-text produces text; after that the path is the same as for typed text (decision D1).

Is there a better way? Three things that look attractive and are not:
1. **One model that listens and judges** (audio in, feedback out): dearer, slower, not repeatable, and it cannot be split into a rule part and an AI part. Not recommended.
2. **Scoring pace, fillers or confidence from the transcript:** speech-to-text models often drop "um" and "uh" when they write, so counting fillers from the text is unreliable. Speaking pace (words divided by seconds) is computable, but only as information, not a score, until it is calibrated (D1).
3. **Replacing the AI score for everyone at once:** it changes `mock_sessions` and so the Trust Score. That is a separate decision with its own gates (section 5).

## 4. What has to be true before the Structure Score is shown to users

Gate B and Gate C of the owner's acceptance document, restated as work:
1. **A calibration set for interview answers**, English and Vietnamese kept apart: real answers (with consent, no identity), each reviewed by a human with a written rubric; strong, weak, incomplete, padded, team-based, "quantified but irrelevant". Report false positives and negatives and any bias by language or style. The owner reads the report and approves beta.
2. **The API contract**: `score-interview` returns the Structure Score and its evidence next to the AI text, and **no AI number**; what is saved, and how the old AI-scored sessions stay distinguishable ("Earlier AI estimate", ADR-013 Q-D).
3. **The UI**: two distinct panels; the four states shown accurately (null, insufficient data, unsupported language, processing error); the beta label; the sentence that it measures structure only. Automated tests check there is no AI number on screen.
4. **Monitoring and a rollback**, recorded.

Until those pass, the Structure Score may be shown only to the owner's own account as a **pre-release evaluation**, clearly labelled.

## 5. The plan

Two tracks that meet at the transcript. Every step needs its own review; nothing merges or deploys without the owner's yes.

| Step | Track | Work | Done when | Needs |
|---|---|---|---|---|
| D1 | Deterministic | **Calibration harness and set**: a script that runs `scoreInterviewAnswer` over a reviewed set and prints agreement, false positives and negatives per language; a template for the human rubric; the owner (or a reviewer) supplies the real answers | A report for English and one for Vietnamese | The owner's data and reviewer; consent for real answers |
| D2 | Deterministic | **Owner-only evaluation panel** in the Mock Interview text mode: run the rules next to the existing AI feedback, show the checks, change no score, save nothing | The owner sees the rules on her own answers; tests for all four states | Owner approval to merge; a flag, off by default |
| V1 | Voice | **Spike behind a flag, owner's account only:** recorder, `transcribe` function (provider chain, ledger gate, nothing stored, audio dropped), transcript box to correct, then the same path as typed text (step 2 onward). Records a small consented sample to compare Groq and OpenAI on Vietnamese | A spoken answer produces a correctable transcript, the rules panel and the AI guidance; nothing is stored; ledger rows exist | Owner's decisions V1 to V7 of the voice brief |
| D3 | Deterministic | **API contract and UI** for the beta (section 4, points 2 and 3), still beta-labelled | Gate B | Owner approval; D1 reports |
| V2 | Voice | Consent dialog, privacy and terms text, legal review of the voice paragraph | Text approved | Legal review (V8) |
| D4 | Deterministic | **Beta enablement** (Gate C) | Owner approves beta | The calibration report |
| V3 | Voice | Preparation time, auto-stop at the limit, timed answers by voice | Tests | V1, V2 |
| V4 | Both | Full simulation (chained questions), one summary and next step | Per the journey spec, phase 4 | V3, the ledger session record |
| X | Decision | Whether the Structure Score replaces the AI number in `mock_sessions` and the Trust Score | A separate ADR | Owner; ADR-013 |

Order I recommend: **D1 and V1 in parallel** (the harness needs real answers and the spike produces some), then D2, then D3, V2, D4. Voice reaches other users only after V2 and D4.

## 6. Cost and risk

- Spoken answer cost per 10 minute session (estimate): about 0.007 USD with Groq `whisper-large-v3-turbo` (price read on Groq's page), about 0.03 with OpenAI `gpt-4o-mini-transcribe` (third-party price, not read on OpenAI's page). The written feedback is below 0.001 per answer. The rules step costs nothing.
- Risks: the rules read a transcript that may lack punctuation or have recognition errors (UNKNOWN until D1 and V1 measure it); Vietnamese accuracy of the speech provider is unmeasured; the rules score is a signal of form that a person can game by learning the checks (so it stays labelled as structure, not quality); voice recordings may be sensitive biometric data in some of the markets (legal review).
- Rollback: every step sits behind a flag that is off by default; nothing stores audio; the rules panel stores nothing.

## 7. Not verified

OpenAI's own price page; Groq's free-tier training terms; whether the OpenAI abuse logs include audio; how well the rules score transcripts; the accuracy of the speech providers on Vietnamese; the request size limit of an Edge Function.
