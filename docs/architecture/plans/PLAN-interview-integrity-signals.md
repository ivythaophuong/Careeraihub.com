# Plan: integrity signals for mock interviews (paste, tab switches, follow-up questions)

Status: **design for the owner's review. Nothing here is implemented or approved.** Written 2026-10-09 after an external review proposed anti-cheating measures for the interview coach.
Evidence classes as in `docs/architecture/EVIDENCE_RESULTS_2026-10-09.md`. Today's behaviour is in section 1; everything else is a proposal.

## 0. What we can and cannot claim

The external review says the score "cannot be cheated" and the proof is "undeniable". We will not claim that.

- A signal sent by the browser is reported by the browser. A person with technical skill can fake it. A person can also read an AI answer on a phone and retype it; that looks like typing.
- So signals reduce casual cheating and give context. They do not prove authorship. Wording everywhere must say what was observed ("pasted text: 80% of this answer"), never what we conclude ("cheated", "fraud", "verified real").
- No automatic penalty in version 1. A signal can have an innocent cause (notes pasted from the user's own draft, dictation, screen readers, an input method editor). A wrong label on a real person harms them.

## 1. What exists today (REPOSITORY, verified)

- `HiringManagerSim.jsx`: the user types an answer in a textarea (min 40 chars). No timer, no paste or focus events, no voice. Questions come from the `ai` function and are not signed.
- `score-interview` (live since 2026-10-09): grades each answer on the server, returns a signed receipt; saving a session recomputes the average from signed scores and writes `mock_sessions` with the service role. The browser can no longer write the table (`server-only-score-writes.sql`, applied).
- The score is `PRACTICE_SCORE`: an AI opinion about the user's own text. It says nothing about who wrote the text.

## 2. Signals

### 2.1 Reported by the browser (untrusted, advisory). Counts and timings only, never the content of keys

| Signal | How | Notes |
|---|---|---|
| `pasted_chars`, `paste_events` | `onPaste` and `input` events with `inputType = insertFromPaste / insertFromDrop` | `pasted_share = pasted_chars / answer_length` |
| `tab_hidden_count`, `tab_hidden_ms` | `visibilitychange` | opening another tab is normal for some; it is context, not proof |
| `typing_ms` | first input to submit | |
| `chars_per_second` | answer_length / typing_ms | thresholds are UNKNOWN until real data exists |
| `input_kind` | `typed`, `dictation_or_ime`, `mixed` | **Vietnamese users type with Telex/VNI input methods that fire composition events; mobile dictation inserts text in bursts. Both must not count as paste.** Tests with composition events are required |

### 2.2 Measured by the server (trusted)

| Signal | How |
|---|---|
| `time_to_answer_ms` | the server records when it issued the question and when the answer arrived |

Today the question list is created by the browser through `ai`, so the server has no issue time. Fix: a `start` action in `score-interview` that generates the questions, signs them (user, time, question text) and returns them. This also removes the "user can practise on questions of their own choosing" limit recorded in `score-interview/README.md`.

### 2.3 Follow-up question ("hỏi xoáy")

After a normal answer the server asks one deeper question about a claim in that answer (a number, a tool, a decision). The user answers; the server grades both and keeps a `depth_score`.
- The server picks 2 of the 5 questions at random at `start` and does not reveal which, so the user cannot prepare only for those.
- Cost and delay: 2 extra AI calls on 2 questions per session. UNKNOWN until measured.
- The follow-up grade is a normal `PRACTICE_SCORE` part; it is not an authenticity verdict.

## 3. Storage (needs SQL run by the owner)

`mock_sessions.integrity jsonb` and `mock_sessions.integrity_version int`. Written only by the Edge Function (the browser has no write privilege on the table). Example, per session: totals and per-answer entries of section 2 plus `depth_score` and `signals_source: "browser_reported" | "server_measured"` for each field. The raw numbers are stored; labels are derived when read, with versioned thresholds, so a threshold can be corrected without rewriting history.

Receipts: the signals sent with `evaluate` are part of what the receipt signs, so they cannot be changed between answering and saving.

## 4. Who sees what

| Audience | Version 1 |
|---|---|
| The user | Sees their own signals next to the answer ("You pasted 80% of this answer"), with an explanation and no penalty. Purpose: honest practice |
| Recruiters | **Nothing.** Practice scores are already excluded from the consent scope (`NOT_SHARED`). Exposure needs: the consent flow live, a new consent part, and legal review of the labels |
| Trust score | Unchanged in version 1. Any later effect must be announced to users beforehand, be reversible and be reviewable by them |

## 5. Privacy and wording

- Tell users before they start ("we record whether text was pasted and whether you left this tab; we do not record what you type or use camera or microphone"). Add it to the Privacy Policy (already flagged for review).
- Retention: UNKNOWN, owner to decide (suggest 12 months with the session).
- A timer is optional and off by default: it can disadvantage people with disabilities and non-native speakers.

## 6. Phases

| Phase | Content | DB change | Depends on |
|---|---|---|---|
| I1 | Browser signals (2.1) sent with `evaluate`, signed in the receipt, stored in `integrity`, shown to the user | yes (columns) | owner approves wording |
| I2 | `start` action: server-issued signed questions and `time_to_answer_ms` | no | I1 |
| I3 | Follow-up questions on 2 random questions | no | I2, AI cost check |
| I4 | Recruiter display | consent part | consent flow live, legal review |
| I5 | Voice answers (latency, speaking rate, filler words) | maybe | separate project: microphone permission, speech-to-text, privacy |

## 7. Tests required before each phase ships

- Paste of 300 characters is counted; typing the same text is not; Telex/VNI composition and dictation are not counted as paste.
- Changing any signal after `evaluate` invalidates the receipt (403).
- A session with all signals present and one with none both save and give the same score (signals never change the score in version 1).
- The browser cannot write `integrity` (privilege test on the replica).
- Wording check: no string in the UI says "cheat", "fraud", "fake" or "verified".

## 8. Decisions needed from the owner

1. Version 1 shows signals to the user only, no score effect. Agree?
2. Wording of the notice and of the labels (needs a person with legal or HR judgement).
3. Retention period.
4. Is a timer wanted at all, given accessibility?
5. Follow-up questions: 2 of 5 (suggested), or every question (more cost, more delay)?
