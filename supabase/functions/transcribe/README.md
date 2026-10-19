# transcribe (voice practice spike)

Turns one recorded interview answer into text. English only. The browser shows the text in the answer box so the user can correct it; nothing is graded here.

**Status: spike. Off by default.** Decision record: `docs/architecture/plans/DECISION-voice-practice-2026-10-18.md` (owner chose V1 server function, V2 Groq first with OpenAI fallback, V3 no audio kept, V7 owner account only).

## Request and reply

`POST /functions/v1/transcribe` with a signed-in user token and `{ audioBase64, mimeType, durationSec? }` returns `{ text, provider }`.

- Audio types: webm, mp4, ogg, wav, mpeg, m4a. At most 6 MB decoded, 200 seconds.
- Errors: 401 not signed in, 403 flag off or user not on the allowlist, 413 too large, 422 no speech or audio refused, 429 rate limit (10 a minute per user per instance), 502 every provider failed.
- Groq `whisper-large-v3-turbo` first, then OpenAI `gpt-4o-mini-transcribe`. A provider without a key is skipped. Busy, down or key-rejecting providers fall through to the next; a refused recording does not.
- Language is fixed to `en`, temperature 0.

## What is kept

Nothing. The audio is held in memory for the request. The only log line is `[usage] {feature:'voice_transcribe', provider, audioSec, outcome}`: no audio, no text, no user id.

## Secrets and flags (Edge Function side)

| Name | Meaning |
|---|---|
| `VOICE_TRANSCRIBE` | `on` to enable. Anything else answers 403. |
| `VOICE_ALLOWED_USER_IDS` | Comma list of Supabase user ids that may use it. Empty means nobody. |
| `GROQ_API_KEY`, `OPENAI_API_KEY` | Already used by the `ai` function. |

The browser flag is `VITE_VOICE_PRACTICE=true` at build time (public, not a secret).

## Not done yet

- Not gated by the usage ledger (it counts tokens; audio is billed in seconds). Needed before wide use (decision V6).
- Privacy policy and terms do not yet mention voice (decision V8, legal review). Do not enable for other users before that.
- No measurement of accuracy on accented English.

## Deploy and rollback

Deploy: `supabase functions deploy transcribe --project-ref ruibdsvrcctxgxctaxwe`. Rollback: `supabase secrets unset VOICE_TRANSCRIBE` (the function then answers 403), or delete the function.
