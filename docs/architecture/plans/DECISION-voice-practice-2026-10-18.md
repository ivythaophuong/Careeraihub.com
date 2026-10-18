# Decision brief: voice practice for the Mock Interview (provider, cost, storage)

Status: **DECISION BRIEF. No code, SQL, secret or deploy accompanies it.** Written 2026-10-18 for the product owner (Ivy). It answers the three open points of `SPEC-mock-interview-journey.md` section 8 (Phase 3): the speech-to-text provider, the cost, and what is stored. ADR-012 says the provider is **not** to be chosen by the implementer: this brief gives options and a recommendation, the owner chooses.
Labels: VERIFIED (read in the repo or on a provider page) · THIRD-PARTY (from a price-comparison site, not the provider; check before relying) · PROPOSED · UNKNOWN · APPROVAL.
Standing decisions that apply: D1 transcript first (judge the content, no pronunciation or pace scoring); D4 no audio and no answer text on the server (ledger decision D-3 = C); scoring and the Trust Score stay as they are; voice is an option, never a gate.

## 1. What is already true (VERIFIED in the repo)

- Today the app has **no voice code**: no recording, no speech recognition, no audio upload. The Voice button is disabled and says so.
- The two AI providers already in the chain, OpenAI (main) and Groq (backup), both offer speech-to-text. No new vendor, key or contract is needed for either (the keys are Edge Function secrets already).
- Every function that spends AI money goes through the usage ledger (`ai`, `score-interview`, `score-star`). A new transcription function would need the same gate. The ledger counts **tokens**; audio is billed in **seconds**, so a new unit is needed (section 5).
- The Edge Functions cap a request body at 12 MB today (the `ai` function, for resume PDFs). Whether the platform accepts a larger body is UNKNOWN; a 3 minute voice answer is about 1 to 4 MB, so it fits.

## 2. Where does speech become text? (decision V1)

| Option | How | For | Against |
|---|---|---|---|
| **A. The browser's own recognition** (Web Speech API) | No server work; the browser does it | Free, nothing to build on the server | The audio goes to the **browser vendor's** servers (commonly documented for Chrome and Safari; THIRD-PARTY, verify), a third party the privacy policy does not name; not in every browser (Firefox lacks it); accuracy and language support vary; no usage control |
| **B. A server function that calls a speech-to-text provider** (recommended) | The browser records, sends the audio to a new `transcribe` Edge Function, which calls the provider and returns text; the audio is dropped | One known provider chain, already in the privacy policy; the same sign-in, rate limit and ledger as every other AI call; works in every browser that can record | A new function to build, test and pay for |
| **C. On the device** (a speech model running in the browser) | Nothing leaves the device | Best privacy | The model is tens to hundreds of MB, slow on phones, hard to keep accurate; a later project |

**Recommendation: B.** It is the only option that keeps both the privacy promise and the cost under control.

## 3. Which provider, and what does it cost? (decision V2)

All prices are USD. They are for transcription only; the feedback on the transcript is the existing, very cheap text call (below 0.001 per answer at the production price table, which was read on 2026-10-15).

| Provider and model | Price | Source | A 10 minute practice session (5 answers of about 2 minutes) |
|---|---|---|---|
| Groq `whisper-large-v3-turbo` | **0.04 per audio hour** (10 second minimum per request) | VERIFIED on Groq's model page (price); limits are THIRD-PARTY | about **0.007** (using the 10 s minimum: still under 0.01) |
| OpenAI `gpt-4o-mini-transcribe` | about 0.003 per minute | THIRD-PARTY (not read on OpenAI's page) | about **0.03** |
| OpenAI `whisper-1` or `gpt-4o-transcribe` | about 0.006 per minute | THIRD-PARTY | about 0.06 |

What this means: on OpenAI, voice would be the **most expensive step** of a session (about 0.03, against roughly 0.002 to 0.003 for the questions plus five written feedbacks, so about 10 times more; estimate) and still small. With the current OpenAI spending cap of 5 USD a month, OpenAI transcription alone would allow roughly **160 full voice sessions a month** (estimate); Groq would allow far more. These are estimates, not an invoice.

Data terms, from the providers' own pages (read 2026-10-15, the same facts the privacy policy quotes): OpenAI states API data is not used for training unless the customer opts in and keeps abuse-monitoring logs for up to 30 days; Groq states it does not retain inference data by default. **UNKNOWN:** whether Groq's no-training terms cover the free tier, and whether OpenAI's 30 day logs include audio. A voice recording is more personal than text, so this matters more here than for CVs.

**Recommendation (PROPOSED):** Groq first, OpenAI as the fallback, for these reasons: the lowest price, "no retention by default" matches the promise we make, and the chain mechanism already exists. The alternative, OpenAI first, is simpler to explain in the policy (one main provider) but costs about 4 times more. Needs the owner's choice.

## 4. What is stored? (decision V3)

PROPOSED, consistent with D4:

| Item | Handling |
|---|---|
| The audio | Held in the browser's memory while recording and until the transcript returns; then dropped. Never in `localStorage`, `sessionStorage` or the database. Not kept by our function either. |
| The transcript | Shown to the person to **correct before it is graded**. After that it is treated exactly like a typed answer: sent for feedback; on the server only a hash and its length are kept (ledger D-3). The draft stays in the tab (`sessionStorage`) like a typed draft. |
| Feedback and score | As today. |
| Logs | The `[usage]` line gets a new feature name and the audio length in seconds; no audio, no text, no user id. |
| Voiceprint | We do not build or keep one. Stated in the privacy text. |

The privacy policy (and the Terms) must change **before** this ships: voice is sent to a provider; say which, say it is not kept by us, and say what the provider states. A recording of a voice can count as sensitive biometric data in some of the markets served (Vietnam, Singapore, Malaysia): UNKNOWN, needs the legal review.

## 5. Consent, limits and the ledger (decisions V4 to V6)

- **V4 Consent.** The first time, before the microphone is requested, a plain dialog: "Your voice recording is sent to our speech provider to be turned into text. We do not keep it. You can type instead at any time." The microphone permission itself is the browser's. Denied permission leaves the text path working.
- **V5 Limits.** PROPOSED: one answer at most 3 minutes (the recording stops by itself, matching the timed challenge), at most 5 answers a session, a short preparation time before recording (30 seconds, optional). These are starting points; no timing data exists.
- **V6 Ledger.** The ledger today limits tokens, requests and concurrency. Audio is paid by the second, so a limit key `max_audio_seconds_per_day` needs a small additive SQL change (a new key accepted by `ai_policy_limits_valid` and a `seconds` column or a convention in `reserved_tokens`). Not needed for a first spike with one account; needed before wide use. APPROVAL at that time.

## 6. Build order if the owner agrees (each step needs its own approval to merge or deploy)

1. **Spike behind a flag**, one answer, only for the owner's account: a recorder, the `transcribe` function (provider chain, ledger gate, no storage), the transcript box for correction, then the existing feedback. Tests: permission denied, recorder error, provider failure and retry, nothing stored, ledger rows. Flag off by default (`VITE_VOICE_PRACTICE` for the web, `VOICE_TRANSCRIBE=on` for the function).
2. Privacy text and consent dialog, reviewed.
3. Preparation time, auto-stop and timed answers in voice.
4. Full simulation (chained questions) on top.

Rollback for the spike: turn the two flags off. Nothing is stored, so nothing needs to be deleted.

## 7. What the owner needs to decide

| # | Decision | Recommendation |
|---|---|---|
| V1 | Where speech becomes text | **B**, a server function |
| V2 | Provider order | **Groq first, OpenAI fallback** (or OpenAI first for a simpler policy at about 4 times the cost) |
| V3 | Storage | **No audio kept; transcript handled like a typed answer; only a hash on the server** |
| V4 | Consent dialog before the first recording | **Yes**, wording to be reviewed |
| V5 | Limits: 3 minutes an answer, 5 answers a session | **Yes**, as starting points |
| V6 | Ledger unit for audio seconds | **Later**, before wide use |
| V7 | Start the spike for the owner's account only | **Yes** |
| V8 | Legal review of the voice paragraph of the privacy text | **Required before any other user** |

## 8. Not verified

- OpenAI's own price page and file limits (only third-party comparisons were read); Groq's current rate and file-size limits beyond the price.
- Whether Groq's free tier carries a no-training promise; whether OpenAI's abuse logs include audio.
- The size limit of an Edge Function request on this platform.
- Accuracy for Vietnamese, English with a Vietnamese accent, and noisy rooms: no measurement exists. The spike should record a small, consented sample from the owner to compare Groq and OpenAI before choosing the order.
