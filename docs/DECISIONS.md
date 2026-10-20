# Decisions

Only decisions with evidence in code, comments, docs or git history. Dates are commit dates. Where the reason is inferred, it says so.

## ADR-001: The browser never calls an AI provider; everything goes through the `ai` Edge Function
- **Evidence:** commit 60a2ef6 (2026-10-02) "call AI through Supabase Edge Functions, stop shipping API keys"; `src/lib/ai.jsx` header comment; `docs/DEPLOY_AND_ROTATE_KEYS.md` (the keys had been copied into the served JavaScript, so any visitor could read them); `tests/security/noSecretsInClient.test.js`.
- **Consequence:** the server picks the provider and model, so a client cannot choose an expensive one (`handler.js` comment).

## ADR-002: Sign-in is checked with the auth server, not the gateway
- **Evidence:** `authenticate()` comment in `ai/handler.js`: the gateway accepts the public anon key as a valid JWT, so the function asks `/auth/v1/user` who the caller is. `verify-cert` does the same.

## ADR-003: Scores must not be trusted from the browser
- **Evidence:** commit 9dcdf5b (2026-10-05) "data integrity and honest scores (Phase 0)"; `docs/database/README.md`: score columns locked, trigger `recompute_trust_score` writes them.
- **Open:** three input tables still take browser-sent scores (documented "Known gap").

## ADR-004: Employers see candidates only when verified
- **Evidence:** same SQL/README: `employers.verified_at`, set only by an admin in the SQL editor.

## ADR-005: `verify-cert` only fetches allowlisted platforms
- **Evidence:** commit 34b3a4d (2026-10-05); header of `verify-cert/handler.js` (exact hostname match, HTTPS, every redirect hop re-checked, time and size caps, sign-in required).

## ADR-006: A failed load must never lead to an overwrite of saved memory
- **Evidence:** `useMemory.js` comment on `critical` tables: if `user_memory` cannot be read, writing stays locked, because the next save would replace the user's data with an empty object. `updateMemory` merges patches for the same reason.

## ADR-007: Keyword matching and figure checks are done by code, not by the model
- **Evidence:** `resumeDigest.js` header and `checkKeywords` comment (the AI proposes, code decides; terms not in the JD are dropped); `factGuard.js` / `numberGuard.js` (figures not in the user's text become `[X]`).
- **Limit:** they do not detect ownership or scope inflation (stated in their own comments).

## ADR-008: Truncation is never silent
- **Evidence:** `resumeDigest.js` header and `describeCuts` ("was condensed … before the AI read it").

## ADR-009: Host port 8081 stays published on all interfaces
- **Evidence:** commit be2d818 (2026-10-02) and the comment in `docker-compose.yml`: Nginx Proxy Manager forwards to the server's public IP on 8081; changing it to `127.0.0.1` would take the site down unless NPM is re-pointed first.

## ADR-010: Database changes are applied by hand and recorded in `docs/database/`
- **Evidence:** `docs/database/README.md` ("The repo has no SQL migrations"). **This is a gap, not a design goal.** Reason for choosing it: UNKNOWN.

## ADR-011: The score a user sees is computed by code; the model explains but never sets the number (owner decision, 2026-10-09)
- **Decision:** the score in ATS Builder (shown as "ATS Readiness", never as "ATS score": the owner decided on 2026-10-10 to keep the ATS name because users recognise it, and the screen says what it is not, because the owner's research report of 2026-10-10 (kept locally, not committed) found that no major ATS publishes one universal score) is `computeDeterministicScore` (src/scoring/); this reverses the earlier decision (commit c0463ec) to hide it. The model still extracts the resume fields and writes the issue list, and is told not to output a score. STAR and interview scores will be split into a structure score computed by code and AI feedback labelled as an estimate; the trust score will use only the computed parts. Details and open points: `docs/architecture/plans/PLAN-deterministic-practice-scores.md`.
- **Evidence:** `ATSBuilder.shownScore.test.jsx` (shown number is the computed one, ignores a stored model score, same input gives the same score, unreadable text shows no score, not 0); `docs/AI_ARCHITECTURE_CONTRACT.md` section 1.
- **Limit:** the computed score measures three things only (completeness, quantified bullets, date consistency). It is not a prediction of how any particular ATS will rank the resume. Resume Scan's JD-match score and the Dashboard/Roadmap numbers that read it are still model-made (not yet changed).

## ADR-012: Server-side limits for the Interview Coach / Mock Interview, and no browser behaviour signals (owner decisions, 2026-10-11)
- **Decision:**
  1. **Order of work** (PR sequence in `docs/audits/INTERVIEW-CONSTRAINTS-PHASE0-AUDIT.md` section 10): PR 1 documents only; PR 2 adds an overall deadline for the provider fallback chain and merges the usage metering (C1, log only); no limit value is set before real usage is measured.
  2. **Timeout accounting is "Approach B":** a concurrency slot may be released only when the server knows it has stopped holding the request; the cost reservation is kept as a separate resource until the provider outcome is reconciled or its upper bound expires. Releasing everything on an application timeout ("Approach A") is not allowed if it can exceed the approved cost budget. Nothing is built yet.
  3. **Practice scores and the trust score: (a) + (c).** (a) Consent-screen wording is changed only after it is verified accurate; today it is accurate for the new read path (`employer_view_candidates`) and not for the Employer Portal's direct read of `candidate_trust_profiles`, so it is not changed now and the consent screen is not released as a guarantee. No text may suggest that practice scores no longer affect `trust_score` while the trigger still uses them. (c) The claim that recruiter access is controlled waits until consent-only read access is deployed and tested. Changing the trigger (b) is not decided.
  4. **No paste, tab-focus or other browser behaviour signals** are collected or used to infer cheating or lower a score. `docs/architecture/plans/PLAN-interview-integrity-signals.md` is superseded in part: the server-issued, signed `start` action and server-measured time are kept as design options.
- **Evidence:** `docs/audits/INTERVIEW-CONSTRAINTS-PHASE0-AUDIT.md` (sections 6, 7, 11). Facts there are tagged CODE, TEST, DB, ESTIMATE or UNKNOWN.
- **Limits:** a usage ledger exists on production and the gate observes only (`docs/database/README.md`, 2026-10-18): no limit value is set, nothing is refused, and there is no quota or entitlement; the `ai` function is still an open proxy for any signed-in user (finding R1). Speech-to-text provider, audio storage and recording limits are not decided; a provider is not to be chosen by the implementer.

## ADR-013: Trust score, practice scores and legacy scores (owner decisions, 2026-10-11)
- **Status of this ADR:** records owner decisions **in principle**. **Nothing here is implemented.** No code, SQL, data or configuration change accompanies it. The consent-only recruiter access SQL (`docs/database/proposed/2026-10-09-consent-only-recruiter-access.sql`) is **not applied** (the policy it drops, "recruiters can read visible profiles", still exists in production on 2026-10-11), so **consent controls are not active** and must not be described as active.
- **Decision:**
  1. **Q-A: A1.** The aggregate Trust Score is removed from every surface recruiters see. No new 0 to 100 aggregate is introduced. A list of evidence coverage without a number (A2) is a later option and only after the CV reader passes its quality gate.
  2. **Q-B: B2, default not shared, not built yet.** Practice scores are shown to a recruiter only if the candidate allows it; the level allowed is "structure score plus a plain-language checklist of passed and not passed checks", never answer text, transcripts or AI feedback. Until it is built, the effective rule is that practice scores are not shared. Precondition proposed: the score is no longer set by AI (Structure Score past its calibration gate, labelled beta). The consent screen wording must change when this is built (it currently says practice scores are not shared; ADR-012 decision 3 still applies).
  3. **Q-C: four score states, in principle.** `scored`, `insufficient_data`, `unsupported_language`, `processing_error` (as in `supabase/functions/_shared/structure/contract.js`); `score` is a number only when `scored`; "no result yet" is the absence of a record; a missing component is never turned into 0 and weights are never redistributed. `insufficient_evidence` is not added. The states must be applied consistently from scorer through storage and API to the interface; today only the scorer defines them and nothing outside `structure/` imports it.
  4. **Q-D: legacy scores are kept and read-only in meaning.** Shown as "Earlier AI estimate", excluded from every new aggregate. Provenance: `resume_scans` already has `score_type` and `score_version` (null means AI-scored before); a similar pair of nullable columns is proposed for `mock_sessions` and `star_stories`, written only by the server; only `scored` results are stored. Eligibility for new calculations: `score_type` in an allowlist defined in code and a `score_version` present, never a string comparison of versions. Old STAR stories can be re-scored from their stored text only on the candidate's request, as a new record that does not overwrite the old score; old interview and ATS scores cannot be recomputed (answers and resume text were not stored). Any SQL needs separate approval, a local test on the replica first, and is additive and reversible. **The exact columns and allowlist still need review before SQL is approved.**
  5. **Q-E: four activity counts replace misleading dashboard scores.** Saved practice sessions; STAR stories with all four sections present; CV preparation checklist items passed; preparation steps done. They measure structure and activity only: "all four sections" is structural completeness (the definition of a valid section must be specific; the structure scorer's threshold, `MIN_SECTION_TOKENS`, is an uncalibrated first guess), and a checklist item passed does not mean a figure is true or the CV fits a job. Missing or unreadable data is shown as "not assessed", never 0. No "Metric Density". No claim of progress, trustworthiness or readiness from activity alone. The Roadmap milestone "Practice score 65+" is not replaced by an arbitrary count threshold: first decide which concrete preparation action the milestone stands for.
  6. **Standing rule (already decided):** no employer is verified (`employers.verified_at` stays null for all) until (a) consent-only access is applied, tested and the consent flag is on, or (b) the owner has decided in writing which scores recruiters may see.
- **Evidence:** `docs/audits/TRUST-SCORE-TRACE.md` (formula and zero for missing data read from the production function 2026-10-11; ATS component has no live writer; 0 verified employers, 6 profiles of which 1 visible, 0 consents); `docs/audits/AI-ROLE-AUDIT.md`; `docs/architecture/plans/DECISION-trust-score.md` (the five decisions and their status); `docs/architecture/plans/REVIEW-trust-evidence-architecture.md` (options, tests, sequence).
- **Limits:** the production flag value of the running build is unknown; consent table RLS policies were not read; no RLS test was run. Zero verified employers is a current condition, not a lasting protection.
- **Sequence (proposed, each step separately approved):** relabel and hide in the interface; apply and test consent-only access; replace dashboard indicators; decide the trigger and `candidate_trust_profiles`; then wire the Structure Score through its gates.

## ADR-014: Voice practice: transcript first, one information-only speech figure (owner decisions, 2026-10-20)
- **Decision:**
  1. Voice practice is English only. Speech becomes text on the server (`transcribe` function: Groq first, OpenAI as fallback); no audio is kept (voice brief V1 to V3). The spike is limited to the owner's account by `VOICE_TRANSCRIBE` and `VOICE_ALLOWED_USER_IDS` (V7).
  2. Voice adds **no score and no judgement**. The text goes through the same path as a typed answer (voice brief D1).
  3. The first and only speech figure is **Estimated Speaking Rate (WPM)**: words x 60 / seconds, from the raw transcript and the length of the whole recording (`src/lib/speakingRate.js`). It is information only: no good/bad wording, no colour band, no target range, no AI, no storage, nothing sent to a recruiter or to the grading prompt, and no number when the transcript or the length is missing. It is shown as an estimate because silence is counted and the transcript may miss words.
  4. Deferred, each needing its own evidence and approval: long-pause detection (feasibility on real audio first), filler words (speech-to-text often drops them, so a count from text is unreliable), tone, energy and pronunciation (need audio analysis by another provider), recruiter-facing voice analytics.
- **Evidence:** `docs/architecture/plans/DECISION-voice-practice-2026-10-18.md`; `supabase/functions/transcribe/README.md`; the user story D1 given by the owner on 2026-10-20.
- **Limits:** no measurement of WPM against hand-timed samples exists (backlog D1.2); no minimum recording length is set, so a very short clip gives a noisy figure; the usage ledger does not cover audio seconds; the privacy text does not yet mention voice and needs legal review before any user other than the owner.

## Superseded: ADR for hiding the computed score (commit c0463ec) is reversed by ADR-011.

## Not yet decided (no evidence of a choice)
- Per-task model choice, a prompt registry, observability tooling, cost limits. (Provider failover now exists: `callWithFallback` in `supabase/functions/ai/providers.js`.)
