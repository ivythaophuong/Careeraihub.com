# AI entry point inventory

Branch `feat/deterministic-score-engine-p0-p4`, HEAD `2e43e14` (includes the merge of `main` that removed the dead scan flows), read 2026-10-09.
**Re-verified on this HEAD** after the branch changed during the audit: a first pass was made on `c0463ec`, where
`ATSBuilder.jsx` and `ResumeScan.jsx` still contained the Kanban scan and the Deep Scan (about 1 800 more lines); every row
below was re-read on the current tree. Method: `grep -rn "callLLM("` over `src/` (non-test), then each call site and its prompt.
Companion to [DETERMINISTIC_FIRST_AUDIT.md](DETERMINISTIC_FIRST_AUDIT.md).
Statuses: CONFIRMED / PARTIALLY CONFIRMED / UNKNOWN / NOT IMPLEMENTED. No model was called.

The grep finds **17** `callLLM(` expressions. 2 have no caller (`resumeParser.js`) and 1 is behind a disabled flag (#13), so
**14 are reachable**. `AI_ARCHITECTURE_CONTRACT.md` §4 counts 27 and predates the dead-flow removal, so its table is partly stale
(its ATS Builder scan, re-score and `+5/card` rows no longer exist in code).

## 1. Call path (CONFIRMED)

```
component → callLLM(messages, maxTokens, pdfBase64?)            src/lib/ai.jsx:64
          → POST {SUPABASE_URL}/functions/v1/ai  (user JWT)     ai.jsx:26-57 (timeout 100 s, 1 retry)
          → Edge Function handler: auth via /auth/v1/user, rate limit, validation   supabase/functions/ai/handler.js
          → one provider chosen by server secrets, one request, no failover          providers.js:25-31,99-118
          → { text } → caller parses with extractJSON (ai.jsx:75) or uses the text
```

| Property | Value | Evidence |
|---|---|---|
| Providers | anthropic, gemini, openai; chosen by `AI_PROVIDER` if keyed, else first keyed in that order | `providers.js:5-6,25-31` |
| Default models | `claude-sonnet-5-5`, `gemini-3.8-flash`, `gpt-4o-mini`; `AI_MODEL` honoured only if it matches the chosen provider's family | `providers.js:5,10-14` |
| Model chosen by client? | No | `handler.js` (`resolveModel(provider, setting(env,'AI_MODEL'))`) |
| Sampling | Gemini `temperature: 0.1`; OpenAI and Anthropic bodies set none | `providers.js:45,73,85` |
| Output cap | `maxTokens` per call, hard cap 8192 | `handler.js` `LIMITS.maxTokensCap` |
| Prompt cap | 200 000 chars, 20 messages; body 12 MB; PDF base64 10 MB | `handler.js` `LIMITS` |
| Rate limit | 20 / min / user / function instance, in memory | `handler.js` `createRateLimiter` |
| Retry | client: 1 retry on 429, ≥500, timeout, network | `ai.jsx:9-10,19-20,49-54` |
| Fallback provider | NOT IMPLEMENTED (`AI_FALLBACK` appears only in docs) | grep |
| Truncated / blocked reply | HTTP 422, not retried | `handler.js` `statusFor` |
| Provider 401/403 | returned as HTTP 500, which the client retries | `handler.js:89`, `ai.jsx:20` |
| JSON validation | `extractJSON` only; returns `{error:true,msg}`, never throws; no schema check | `ai.jsx:75-95` |
| Logging / cost / token usage | `console.error` only; no usage metering | `handler.js` |
| Deployed function equals repo | UNKNOWN | not readable from the repo |

## 2. Call sites

Columns: **Tok** = `maxTokens`; **PDF** = may send the whole PDF as base64; **Guard** = invented-figure guard applied to
the output; **Class** = target class from the contract (A replace with code, B code foundation + AI interprets, C AI
appropriate); **Reach** = reachable from the UI (CONFIRMED by reading the caller).

| # | File:line | Purpose / prompt | Input sent to the model | Tok | PDF | Output used for | Persisted | Guard | Class | Reach |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `App.jsx:363` | `RESUME_EXTRACT_PROMPT` (`:36`): resume → JSON, only when pdf.js text extraction throws | PDF base64 | 3000 | yes | text for onboarding | `memory.resumeText` | – | A (extraction) | yes, rare |
| 2 | `App.jsx:599` | `currentRole, yearsExp, topSkills, headline` | first 4000 chars | 800 | no | profile card, target-role prefill, Dashboard `yearsExp` (`Dashboard.jsx:344`) | `resumeProfile` (localStorage) | – | B | yes |
| 3 | `ResumeScan.jsx:158` | `parseForTemplate`: resume → structured JSON for PDF templates | first 4000 chars | 3000 | no | template data | none | – | B (duplicate of #4 and #2) | yes |
| 4 | `ResumeScan.jsx:214` | JD match: `matchScore`, bars, `jdKeywords`, issues with `fix` rewrites (prompt forbids added figures/ownership) | digested resume (≤6000) + JD (≤4000) | 1500 | no | score, bars, rewrites; keyword lists overridden by `checkKeywords` (`:243`) | `jd_analyses` row (`:251`) + `memory.jdAnalyses` | `neutralizeInventedFigures` on `fix` (`guardIssues`, `:66`) | B | yes |
| 5 | `AICoach.jsx:117` | chat; system context built by `buildSystemPrompt(memory, form)` injected as first turn | memory summary + history | 600 | no | chat reply | chat history in memory | none | C | yes |
| 6 | `ATSBuilder.jsx:93` | `parseResume`: structured parse **and** `atsScore`, `scoreBreakdown` (5 dims), issues | first 5000 chars | 4000 | no | profile, ATS score card (`:219,323,346,421,456`) | `memory.parseProfile` (`:1175`) | none | B (score = A) | yes |
| 7 | `ATSBuilder.jsx:564` | bullet rewrite "stronger, more quantified" … "Never use placeholders" | user bullets + digested resume | 4000 | no | before/after list | none | **none** | C | yes |
| 8 | `JDAnalyzer.jsx:40` | `buildJDPrompt`: `matchScore` 0-100, requirements, strengths, gaps, hidden keywords; "untrusted data" preamble | JD ≤12000 + resume text or PDF | 2500 | yes | whole analysis | `jd_analyses` (only if `matchScore` not null) | none (code `normalizeJDResult`) | B | yes |
| 9 | `CoverLetterGen.jsx:33` | `buildCoverLetterPrompt`: "use ONLY facts in the resume", tone rules, untrusted-data preamble | JD, role, resume text or PDF | 2500 | yes | letter, subject, selling points | `cover_letters` | none | C | yes |
| 10 | `HiringManagerSim.jsx:51` | `buildQuestionsPrompt`: 5 persona questions | role + resume text or PDF | 2500 | yes | question list (`normalizeQuestions`) | in-session | – | C | yes |
| 11 | `HiringManagerSim.jsx:67` | `buildEvaluationPrompt`: answer score + feedback | question, answer, resume | 1800 | no | score (clamped in code), verdict by `verdictFor`, feedback | `mock_sessions` (average only) | `findUnsupportedNumbers` warnings | B | yes |
| 12 | `MemoryDashboard.jsx:59` | personalized plan incl. `overallProgress` "0-100 score based on activity" and `status` | `buildMemoryContext(memory, form)` | 1500 | no | progress bar, plan | in-session | none | A for progress, C for plan | yes |
| 13 | `SalaryCoach.jsx:82` | market salary ranges by level and employer type | role, market, level | 900 | no | range table, `pct` bars | `memory.salaryMarket` cache | none | A / needs sourced data | **no while `MARKET_DATA_ENABLED = false`** (`salaryLevel.js:24`; the market tab renders only when true, `SalaryCoach.jsx:503,533`) |
| 14 | `SalaryCoach.jsx:290` | `buildSalaryPrompt`: negotiation script; math in code (`negotiationMath`) | situation, offer, target, resume text or PDF | 3000 | yes | script, tactics | none | `findUnsupportedFigures` | C | yes |
| 15 | `SkillsGap.jsx:72` | skills list with level/status and recommendations; market numbers removed | role, market, scan summary (`memory.scanHistory[0].result.summary`), JD titles | 1500 | no | skills table | `memory.skillsGap` | none; rule `ai-market-numbers` | B | yes |
| 16 | `STARBuilder.jsx:43` | `buildStarPrompt`: section scores + polished story | user's S/T/A/R | 2500 | no | scores (clamped), `overallScore` in code (`star.js:59`), rewrite | `star_stories` | `findInventedNumbers` | B | yes |
| 17 | `resumeParser.js:40,54` | `extractResumeFromPdf` / `extractResumeFromDocx` | PDF / text | 8192 | yes (PDF) | – | – | – | – | **no caller** (grep) |

Removed since the first pass and therefore **not** in this table (commits `b92bab6`/`e7df3a5` via `main`): ResumeScan Deep Scan
(2 sites), ATS Builder Kanban scan with its per-gap suggestion, PDF/text scan, rebuild and re-score (6 sites) and the
`+5 per card` fallback score.

Prompts live inline in the files above except: `star.js`, `interview.js` (`buildQuestionsPrompt`, `buildEvaluationPrompt`), `salary.js`,
`coverLetter.js`, `jdAnalysis.js`. The prompt text of `buildSystemPrompt` (AI Coach) and `buildMemoryContext` (Memory) was not read:
what personal data they send is UNKNOWN.

## 3. Same input sent to the model more than once (CONFIRMED)

The resume text can be sent by #2 (onboarding), #3, #6, #4, #8, #9, #10, #14 and #15 independently. #2, #3 and #6 are three
different structured parses of the same text. There is no cache by content hash (`resumeFacts.js` computes `content_hash`, nothing
uses it). Cost impact: UNKNOWN (no metering).

## 4. Non-LLM backend dependencies

| Function | Purpose | Caller | Auth | Evidence |
|---|---|---|---|---|
| `jobs` | Adzuna proxy | Job Search, Landing (guests) | none for guests | `supabase/functions/jobs/handler.js`, tests |
| `verify-cert` | fetch allowlisted certificate pages, decide `verified` | VerifyCreds for coursera, udemy, accredible, edx, freecodecamp, kaggle (`VerifyCreds.jsx:241`) | signed-in user | `verify-cert/handler.js`, 22 tests |
| Credly | direct browser fetch of `credly.com/badges/<id>.json`, not through the function | VerifyCreds | none | `VerifyCreds.jsx:247-266` |
| Supabase REST | `user_memory`, `resume_scans`, `applications`, `star_stories`, `cover_letters`, `jd_analyses`, `mock_sessions`, `negotiation_practice`, `insights`, `profiles`, `candidate_trust_profiles`, `employers`, `employer_members`, `job_listings` | `useMemory.js`, `App.jsx`, TrustMatch, EmployerPortal | user JWT | schema and RLS UNKNOWN. **No live code inserts into `resume_scans`** (grep; also stated in `docs/SYSTEM_MAP.md`) |

## 5. Findings specific to AI entry points

1. **Models asked to compute what code can compute**: #6 (`atsScore`; the prompt tells the model the five sub-scores "should aggregate
   to the overall atsScore", `ATSBuilder.jsx:129`), #12 (`overallProgress`), #2 (`yearsExp`). #4 and #8 also return a model `matchScore`.
2. **One AI "ATS score" remains** (#6), shown in the Upload & Parse tab. The deterministic score (`ATSBuilder.jsx:85`) is computed and
   only logged (`:87`).
3. **Rewrite prompts without a guard**: #7 ("more quantified … Never use placeholders") and #9. Only #4, #11, #14, #16 apply figure
   checks, and those cover figures only, not ownership or scope inflation (contract; `VERIFICATION_STATUS`).
4. **Prompts that wrap the resume as untrusted data**: #8 and #9 only. The others interpolate resume text directly.
5. **Temperature is provider-dependent** (§1), so identical input can vary by run and by provider.
6. **Silent failure**: #4 ignores an unparsable response (`ResumeScan.jsx:241`, `if (!parsed.error) {…}` without else); #7 swallows errors.
7. **PDF base64 to the provider** in 5 reachable places (#1, #8, #9, #10, #14) plus #17, which has no caller. Frequency and provider
   retention terms: UNKNOWN.
8. **The AI scan score no longer exists, and nothing replaced it as a data source.** Dashboard, Roadmap, Readiness, Radar and #15 read
   `memory.scanHistory`, which is only loaded from `resume_scans` rows (`useMemory.js:62,86`); no live code creates new ones.
