# Ideas register: Mock Interview blueprints supplied by the owner (2026-10-20)

Status: **IDEAS. Not decisions.** No code, SQL, secret or deploy accompanies this file. Written 2026-10-20 for the product owner (Ivy).
Source: six texts pasted into a working session by the owner. They were written by an external assistant; the owner supplied them as ideas to consider. They were **not** checked against production by their author. Where a text says "decided" or "complete", that is the text's own wording, not an owner decision.
Binding decisions live in `docs/DECISIONS.md` (ADR-011 to ADR-014) and `DECISION-voice-practice-2026-10-18.md`. This register never overrides them: an idea that conflicts with one is listed as a conflict, and only the owner can change the decision, in writing, in an ADR.
Labels: VERIFIED (read in the repo or in production on 2026-10-20) · PROPOSED · UNKNOWN · CONFLICT (against a recorded decision).

## 1. The ideas, one by one

| # | Idea (as supplied) | Where the repo stands (VERIFIED) | Assessment |
|---|---|---|---|
| I1 | Three tiers: audio measured in the browser, speech to text, then an LLM judges the transcript | Built in part: `transcribe` function, `speakingRate.js`, `rhythm.js`, `audioMeter.js`; `score-interview` judges text | Keep. Same architecture the voice brief already chose |
| I2 | Content axis with four criteria and weights (STAR 30, relevance and JD fit 30, persona fit 20, quantified evidence 20), scored by the LLM | No criteria list exists; the prompt gives only five score bands and honesty rules | Keep the **criteria** as a starting rubric to define and test. Drop the **weights** (no evidence) and the LLM-set sub-scores (ADR-011, ADR-013). "Persona fit" as a score penalises a candidate for not matching a role the user picked: use the persona to choose questions and tone, not to score |
| I3 | Communication Mirror: speed, pauses, vocabulary variety, filler words, shown as information only, never a 0-100 score | WPM and rhythm are built (information only, ADR-014). Vocabulary is not built. | Keep as information. Filler words: speech-to-text often drops them, so a count from the transcript is unreliable (UNKNOWN until measured). "Ideal 120-150 WPM" has no source; the user story D1 forbids an unapproved target range. Example fillers were Vietnamese; the platform is English only |
| I4 | Two separate prompts: a live interviewer and an evaluator | Only an evaluator prompt exists; questions are written once at the start | Keep the split. The evaluator prompt as supplied omits the "untrusted data" markers the current prompt has (transcript, JD and CV are user-controlled and could carry instructions). It also asks the LLM to interpret WPM and pauses that code already measures, and to list fillers the transcript no longer contains |
| I5 | Follow-up questions when an answer is vague | Not built. It is phase 4 "Full simulation" of `SPEC-mock-interview-journey.md` | Highest product value in the set. Needs: a per-session spend gate (the ledger gates per request today), two model calls per answer (cost and delay doubled), voice stable first |
| I6 | Paste a job description to shape the questions and the judging | Not an input of the Mock Interview today (only a resume excerpt is) | New feature; the JD is untrusted text and needs the same delimiting. Owner decision |
| I7 | Six personas (adds Agency and Individual/Freelancer) and ten industries plus free text | Four personas in `PERSONAS`; a role text box; no industry field. The reason for the current four is undocumented (commits 840c870, b3c53ec). The ten industries are not named anywhere | Not decided. If wanted: name the ten industries, write one sentence of rationale per persona, and test that questions differ in a useful way |
| I8 | Live room: waveform, countdown, 30 s preparation, pause / redo / finish, the AI reads the question aloud | Waveform, 3 minute ring and retry exist. Preparation time is planned (voice brief V5). Reading the question aloud is not planned | Waveform and ring: done. Spoken questions need a text-to-speech provider and cost: owner decision |
| I9 | Report with three tabs: Overall and STAR, Communication Mirror, AI Rewrite | Per-answer feedback and an outline exist; no session report with tabs | Good shape for the **private** candidate report. Rename "Readiness" (the metric contract forbids it for a practice score). Use qualitative labels with a quoted line from the answer as evidence instead of /10 numbers |
| I10 | Progress over sessions ("6.2 to 8.5") | Sessions are saved; no chart. Only 9 sessions by 6 users exist (production, 2026-10-20) | Reasonable later; needs enough data to mean something |
| I11 | Feed the best interview of the last 30 days into the Trust Score at 30 percent; check CV vocabulary overlap above 70 percent; detect pasted text | **CONFLICT.** The Trust Score formula is different (interview, ATS and STAR parts; see `CONTRACT-interview-metrics-2026-10-19.md`). ADR-012 #4 forbids browser behaviour signals to infer cheating. "Best of" contradicts the first-attempt rule. 70 percent overlap has no basis and would penalise honest, natural speech | Do not adopt |
| I12 | Recruiters see a "Verified Live Interview" badge, the overall and STAR scores and a 20 second audio sample | **CONFLICT.** ADR-013 Q-A removes aggregate scores from recruiter surfaces; Q-B allows only a candidate-approved Structure Score and checklist, never answers or transcripts; voice decision V3 stores no audio; 0 employers are verified; the consent-only SQL is not applied. A practice score is an AI estimate, so "Verified" would be untrue | Do not adopt |
| I13 | The candidate owns recordings and may publish them on the profile | Needs audio storage, a consent flow and legal review, none of which exist | Not now |
| I14 | Co-working lobby with other candidates' cards, a quiet private room, spectators and peer review, later person-to-person practice | No real-time or presence infrastructure found in the code. The "42 people practising now" figure would be invented at today's volume | Defer. If tried later: anonymous count from real data only, opt-in, no names; no spectators; person-to-person is a separate project with moderation |
| I15 | Cost table: Deepgram, Claude 3.5, GPT-4o, Gemini 2.5; one final evaluation call after the interview | The server chooses providers (OpenAI then Groq). Groq transcription price was read on Groq's page; the Deepgram price was not verified. Feedback today is per answer, not once at the end | Do not adopt the vendor list. "One call at the end" changes the experience: owner decision |

## 2. What every adoptable idea still needs

1. **A rubric**: each criterion with written levels and examples (I2, I9). Today the criteria are implicit in the model.
2. **A reference set rated by people**: two independent raters on the same answers, agreement measured. English only. Without it nobody can say whether a score or a rubric works (the same procedure as `D1-interview-structure-calibration-standard-2026-10-18.md`).
3. **A stability test**: the same answer scored several times, spread reported. Not done; the OpenAI sampling setting is UNKNOWN.
4. **Untrusted-data handling** in every new prompt (I4, I6).
5. **Privacy text** that covers voice before any other user sees it (voice brief V8), and a spend gate for audio seconds (V6).

## 3. Suggested order (PROPOSED, each step needs its own approval)

1. Finish the private voice experience already started: rhythm figures (built), vocabulary figures, unlock after a timed round.
2. Write the rubric and the reference-set plan (section 2, points 1 to 3). Run the stability test. Only then redesign the evaluator prompt (I2, I4) and the report (I9).
3. Follow-up questions (I5) once voice and the evaluator are stable and a per-session gate exists.
4. Personas, industries and JD (I6, I7) as separate owner decisions.
5. Anything that touches the Trust Score or what recruiters see (I11, I12, I13): only through ADR-013 Q-B, after the consent-only access is applied and tested and the owner decides in writing which scores recruiters may see.
6. Community features (I14): last, and only with real usage.

## 4. Not verified

- Whether people want the co-working idea (I14), or any of these features: there is no usage research in the repo.
- How consistent the current AI scoring is; how well the rhythm thresholds in `src/lib/rhythm.js` fit real microphones.
- The ten industries; the ranking of personas by usefulness.
