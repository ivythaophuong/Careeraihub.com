# R1 proposal: the `ai` Edge Function is an open proxy for any signed-in user

Status: **proposal only. Nothing applied, no code, SQL, secret or deploy.** Written 2026-10-13 for the product owner (Ivy). Part of `MOCK-INTERVIEW-E2E-PHASE0-AUDIT-2026-10-13.md` (sections 14 and 16).
Labels: VERIFIED (source or owner-read live data), INFERRED, UNKNOWN, PROPOSED, APPROVAL.

## 1. Exposure, with evidence

| Fact | Evidence |
|---|---|
| Sign-up is open and needs no email confirmation (`disable_signup:false`, `mailer_autoconfirm:true`) | public `/auth/v1/settings`, 2026-10-13 |
| `ai` accepts any prompt up to 200 000 chars, 20 messages, optional 10 MB PDF, up to 8192 output tokens | `ai/handler.js` `LIMITS`, `validate` |
| Only per-user limit: 20 requests/min per instance, in memory, per account | `createRateLimiter` |
| No per-user daily or token budget anywhere | grep of `ai`, `score-*`; no ledger table (Phase 1 tables list) |
| Live chain is Gemini then Groq (two keys) | secret names, owner screenshot |
| Per call the server can start at most 2 provider attempts; client may retry once; so up to 4 provider calls per user action | `providerChain`, `callLLM` |
| Failed or timed-out attempts record no tokens | `providers.js:232`, seen in real logs (503 lines) |
| Real traffic today is tiny (about 1 request per hour; one user in the log sample) | dashboard list, `[usage]` sample |
| Provider prices are not in the repo; provider-side plan or spend caps: UNKNOWN | `PRICE_TABLE` empty; no billing view read |

So the path is **easy to reach** (free instant accounts), **unmetered per user**, and **bounded only by per-minute rate × number of accounts**. Whether anyone has abused it: UNKNOWN (one log sample, no history). Dollar exposure: UNKNOWN (no prices, no spend cap seen).

## 2. Who legitimately uses `ai` (impact table)

All 17 labels come from the client (`callLLMFor`); the server cannot trust the label. Sizes are from call sites; "not read" means I did not open the call to find its limit.

| Label (file) | maxTokens | PDF | Typical input | Breaks if prompt cap is cut? |
|---|---|---|---|---|
| mock_questions (HiringManagerSim) | 2500 | yes | resume text or PDF + role | PDF path would break if PDFs were banned |
| mock_evaluate_legacy | 1800 | no | only when `VITE_SERVER_SCORING=false` | dead in production (S4 blocks its save) |
| star_review_legacy (STARBuilder) | 2500 | no | one story | legacy path |
| ai_coach (AICoach) | 600 | no | up to the bounded history window | no |
| memory_plan (MemoryDashboard) | 1500 | no | memory summary | no |
| jd_analyze (JDAnalyzer) | 2500 | yes | resume + JD | PDF path |
| scan_template_parse, scan_jd_match (ResumeScan) | not read | no | resume (capped 5000 to template max) | possibly for long JDs |
| ats_parse (ATSBuilder) | 4000 | no | resume capped at 5000 chars; observed 1.5k to 1.7k input tokens, 3k to 4.7k total | no |
| ats_bullet_rewrite | 4000 | no | resume context + bullets | no |
| cover_letter (CoverLetterGen) | 2500 | yes | resume + JD | PDF path |
| cover_letter_tone | 1500 | no | one letter | no |
| skills_gap (SkillsGap) | not read | no | scan summary + role | no |
| salary_market (SalaryCoach) | not read | no | situation | no |
| salary_script | 3000 | yes | situation + resume | PDF path |
| onboarding_pdf_extract (App.jsx:365) | 3000 | yes (only way) | PDF | **cannot work without PDF** |
| onboarding_profile (App.jsx:601) | 800 | no | resume text capped at 4000 chars | no |
| unlabelled: `resumeParser.extractResume*` | 8192 | possible | – | **no caller anywhere** (defined only in `resumeParser.js`): dead code |

Consequences: every legitimate call is far below the server's maximums (prompt 200 000 chars, output 8192 tokens). The largest legitimate output in the code is 4000 tokens (ATS) and 3000 (onboarding PDF, salary script). The PDF is required by onboarding, JD analyzer, cover letter, salary script and Mock Interview question generation (as fallback when no text exists). So **banning PDFs or closing `ai` would break these features**; lowering ceilings to values near the table is compatible with all of them.

## 3. Options

| | What | SQL | Closes the exposure? | Breaks legitimate use? | Notes |
|---|---|---|---|---|---|
| M0 | Do nothing, rely on low traffic | no | no | no | not acceptable once sign-up stays open and an abuser needs only a curl loop |
| M1 | Server-side allowlist of labels with per-label ceilings; unknown label gets the strictest | no | **no**: attacker sends the loosest label | no if ceilings ≥ table | reduces damage from accident and from naive abuse only; label is spoofable. Do not present as a control |
| M2 | Lower global ceilings (`maxTokensCap`, `maxPromptChars`, `maxMessages`) | no | partly: bounds the worst single call | **possible** for long JDs or very long CVs; must be measured | needs wider `[usage]` data than the sample I have |
| M3 | Atomic per-user daily/token budget in a ledger, checked before the provider call | **yes** | **yes**, for accounts; many accounts still multiply it (needs signup friction, M5) | no, if numbers come from measured usage | the real fix; design in the SQL proposal |
| M4 | Split `ai` into per-feature functions and close the open one | no SQL | yes, structurally | large regression risk across 15+ call sites | too large for an interim step |
| M5 | Make sign-up cost something: turn on email confirmation, optionally CAPTCHA | **dashboard setting** (not code) | reduces account farming | changes onboarding for every new user | an owner product decision; affects conversion; outside this feature |
| M6 | Provider-side spend caps / quotas in the Gemini and Groq consoles | no | **yes for money**, regardless of our code | no | an owner action; I cannot see or set it. UNKNOWN whether it exists |

## 4. Recommendation (PROPOSED, in this order; each needs APPROVAL)

1. **M6 first, today, owner action:** check that Google AI (Gemini) and Groq have a hard monthly spend or quota limit and an alert. It is the only control that bounds money without any code and cannot be bypassed from our side. I cannot verify it. If the keys are on a free tier, say so (the provider simply returns 429 when exhausted, and our fallback would show "busy").
2. **M5 as an owner decision**: whether email confirmation should be required at sign-up. It is the cheapest way to make account farming costly, but it changes onboarding. I only report it; I do not recommend it blindly.
3. **M2 only after a wider `[usage]` pull**: download the last 7 days of `ai` logs, group by `feature`, look at p50/p95/max of input and output tokens and of chars, and the share of calls near any proposed ceiling. Until then no number is chosen. The sample so far has one feature and one user.
4. **M3 inside the session/ledger SQL proposal**, with explicit handling of in-flight requests, failures, retries, unknown outcomes and cost that is incurred without a returned result (reconciliation Approach B, ADR-012). The unknown-outcome rule must be written before any limit number is.
5. **M1 only as a clean-up**, not as protection, and never advertised as such.

I do **not** propose to close `ai`, ban PDFs or lower ceilings now.

## 5. What would show an attack today (read-only, owner)

- Supabase Auth, Users: number of sign-ups per day, many addresses at similar times or from throwaway domains.
- `ai` logs, 24 h to 7 days: count of `[usage]` lines per `user_ref`; any single `user_ref` with many calls; any `feature` that is `unknown` or `app` (not from our client); calls with `has_pdf:true` and large `resume_chars`.
- Provider consoles: daily token and spend graph versus the usage lines.

If any of these shows a spike, the first move is M6/M5 and rotating nothing yet; a key rotation is only for a leaked key (`docs/DEPLOY_AND_ROTATE_KEYS.md`).

## 6. Not decided here (APPROVAL / UNKNOWN)

M5 (email confirmation) · any ceiling number · M6 status and limits · whether free-tier provider quotas already act as the cap · the price table (needs the owner reading the providers' pricing pages and dating it) · whether `ats_parse` and others should move to dedicated functions (M4).

## 7. Evidence used

`supabase/functions/ai/handler.js`, `providers.js`; `src/lib/ai.jsx`, `aiFeature.js`; call sites listed in section 2; public Supabase auth settings; owner-read function list, log lines `[usage]` (6 calls, 1 user, `ats_parse`), secret names; Phase 1 SQL table list. No request was sent to `ai`, no account was created, no exploit was attempted.

## 8. Owner answers (2026-10-13)

- Both providers (Gemini, Groq) are on the **free API tier** (owner statement; not verified by me). Approved: the steps in section 4 as written (M6 check done, M5 left to the owner as a dashboard decision, M2 after a wider log pull, M3 inside the SQL proposal, M1 clean-up only).
- Effect on the exposure: with a free tier, abuse is more likely to cost **availability** than money. A flood by many accounts exhausts the shared free quota and every real user gets 429 ("The AI provider is busy"), including Mock Interview and ATS. INFERRED from how free tiers behave; the exact quotas and whether a billing account is attached to the Google project are UNKNOWN. **Please confirm no billing account is linked to the Gemini key's Google project**: if one is, the free-tier ceiling no longer bounds money.
- Per-user limits (M3) therefore protect the shared quota, not just money. This raises the value of M3 and of M5; it does not change the order.

### 8.1 Gemini plan checked by the owner (2026-10-13)

Google AI Studio shows the API key's project on **Free tier** (owner reading; no billing account attached, no key value seen). So for Gemini the free quota is the ceiling: abuse cannot create a Google charge, it can exhaust the quota and make real users see "busy" (availability risk, as section 8). Groq plan: not yet checked.

### 8.2 Groq plan checked by the owner (2026-10-13)

Groq console shows the free tier (owner reading, no card details seen). Both providers are therefore on free plans: **no provider charge is possible from abuse of `ai`; the exposure is availability** (shared free quota exhausted, every user sees "busy", fallback chain exhausted). This makes M6 (provider spend caps) moot for money today and raises the value of per-user budgets (M3) and sign-up friction (M5). If either plan is upgraded later, the money exposure returns and M6 must be set first.

### 8.3 Owner decision on M5 (2026-10-13): turn on email confirmation at sign-up (not yet done)

Code check before the switch (`src/components/OriginalFeatures.jsx:116-124`): when sign-up returns no session, the modal throws "Registration started. Please check your email for confirmation." and shows it in the **error style** (red). It works but reads as a failure; sign-in before confirming returns Supabase's "email not confirmed" error. Preconditions to verify in the dashboard, one at a time, **before** enabling: (1) a working custom SMTP sender (the built-in Supabase sender is limited, as I recall from the documentation: not verified here; if it only reaches team members or a few messages per hour, enabling confirmation would block real users), (2) Site URL and redirect URLs point to the live site (a wrong Site URL sends the confirmation link to the wrong host), (3) the confirmation template. Existing accounts are not affected by the switch. Reversible in the same dashboard page.

### 8.4 Email confirmation: not enabled (2026-10-13)

Custom SMTP is **off** (owner). The owner had toggled something on and then turned **Confirm email** back off (owner: "done"; which of the two toggles it was is not recorded). Public settings re-read afterwards: `disable_signup: false`, `mailer_autoconfirm: true`, i.e. sign-up works as before, no confirmation required. M5 is therefore **deferred**, not decided against: it needs a working custom SMTP sender first (provider choice and domain setup are the owner's), then the Site URL check, then a test sign-up with a non-owned `+tag` address, then the switch. Until then the exposure in section 1 stands.

### 8.5 Log sample, last hour, 2026-10-13 17:10 to 17:21 local (owner paste; not the 7-day pull)

Three `ai` calls (10:12:57, 10:14:37 and 10:20:14 UTC), one `user_ref` (`46c062f9…`, different from the 2026-10-12 sample's user), `feature: "unknown"`, `resume_kind: null`, input about 1.44k to 1.45k tokens, output 340 to 370 tokens. **All three: Gemini answered 503 after 3.8 to 6.8 s, then Groq (`openai/gpt-oss-120b`) succeeded in 1.3 to 1.7 s as the fallback.** Reading (INFERRED): (1) Gemini was unavailable for the whole sample, so the free Groq quota carried the traffic; fallback is doing real work; (2) `feature: "unknown"` means the caller sent no valid feature label: either the live site bundle was built before the labelling commit (`e0236d6`, 2026-10-11; the live build is `deploy/s4-on-fix-session` plus later swaps: UNKNOWN which commit) or a direct API caller. Who made these three calls: UNKNOWN until the owner says whether they were her own tests. (3) A failed Gemini attempt cost 4 to 7 s of waiting per call, and recorded no tokens (as expected). This pull has 3 calls only; the 7-day pull is still outstanding.

Owner answer (2026-10-13): the three calls in 8.5 were her own tests on the live site. So no unknown caller is indicated; `feature: "unknown"` is then most likely the live bundle being older than the labelling commit (INFERRED, not verified). Re-read of public auth settings after her message that she had "enabled email": `mailer_autoconfirm` is still `true` (confirmation still off). What exactly she enabled (custom SMTP or another toggle): not yet recorded.
