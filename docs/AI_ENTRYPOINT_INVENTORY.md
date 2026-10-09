# AI entry point inventory

Branch `integration/ats-builder-p4-score`, HEAD `c0463ec`, read 2026-10-09. Method: `grep -rn "callLLM("` over `src/`
(non-test), then each call site and its prompt were read. Companion to [DETERMINISTIC_FIRST_AUDIT.md](DETERMINISTIC_FIRST_AUDIT.md).
Statuses: CONFIRMED / PARTIALLY CONFIRMED / UNKNOWN / NOT IMPLEMENTED. No model was called.

The count differs from `AI_ARCHITECTURE_CONTRACT.md` §4 ("27 call sites"): this grep finds **26** `callLLM(` expressions.
Of these, 2 are unreachable (dead block in `ResumeScan.jsx`) and 2 have no caller (`resumeParser.js`), leaving **22 reachable**.
The contract's count method is not stated, so the 1-site difference is unexplained (UNKNOWN).

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
| 1 | `App.jsx:363` | `RESUME_EXTRACT_PROMPT` (`:36`): resume → JSON, only when `pdf.js` text extraction throws | PDF base64 | 3000 | yes | text for onboarding | `memory.resumeText` | – | A (extraction) | yes, rare |
| 2 | `App.jsx:599` | `currentRole, yearsExp, topSkills, headline` | first 4000 chars | 800 | no | profile card, target role prefill, Dashboard `yearsExp` | `resumeProfile` (localStorage) | – | B | yes |
| 3 | `ResumeScan.jsx:400` | `parseForTemplate`: resume → structured JSON for PDF templates | first 4000 chars | 3000 | no | template data | none | – | B (duplicate of #11) | yes |
| 4 | `ResumeScan.jsx:456` | JD match: `matchScore`, bars, `jdKeywords`, issues with `fix` rewrites | digested resume (≤6000) + JD (≤4000) | 1500 | no | score, bars, rewrites; keywords overridden by `checkKeywords` | `jd_analyses` row + `memory.jdAnalyses` | `neutralizeInventedFigures` on `fix` | B | yes |
| 5 | `ResumeScan.jsx:1232` | legacy Deep Scan with PDF | PDF | 8192 | yes | – | – | – | – | **no** (inside `{false &&`, `:1291`) |
| 6 | `ResumeScan.jsx:1234` | legacy Deep Scan with text | resume text | 8192 | no | – | – | – | – | **no** |
| 7 | `AICoach.jsx:117` | chat; system context built by `buildSystemPrompt(memory, form)` injected as first turn | memory summary + history | 600 | no | chat reply | `memory` chat history | none | C | yes |
| 8 | `ATSBuilder.jsx:511` | per-gap improvement suggestion | gap title/description/notes | 600 | no | `card.aiSuggestion` | in-session | none | C | yes |
| 9 | `ATSBuilder.jsx:980` | `parseResume`: structured parse **and** `atsScore`, `scoreBreakdown`, issues | first 5000 chars | 4000 | no | profile, ATS score card, issue list | `memory.parseProfile` | none | B (score = A) | yes |
| 10 | `ATSBuilder.jsx:1451` | bullet rewrite "stronger, more quantified" | user bullets + digested resume | 4000 | no | before/after list | none | **none** | C | yes |
| 11 | `ATSBuilder.jsx:2154` | OCR fallback: PDF → plain text | PDF | 2000 | yes | `resumeText` | `memory.resumeText` | – | A | yes, when `pdf.js` text is empty |
| 12 | `ATSBuilder.jsx:2161` | `SCAN_PROMPT` on PDF-derived text: `atsScore`, `parameters`, `gaps` | full text | 8000 | no | scan score, kanban cards | `resume_scans`, `scanHistory` | none | B (score = A) | yes |
| 13 | `ATSBuilder.jsx:2180` | same on pasted text | full text | 8000 | no | same | same | none | B | yes |
| 14 | `ATSBuilder.jsx:2264` | `buildRebuildPrompt`: rewrite resume as HTML applying accepted edits | full text + edits | 4096 | no | new resume HTML | in-session / version store | none | C | yes |
| 15 | `ATSBuilder.jsx:2269` | `buildAnalysisPrompt`: re-score original vs rebuilt | both digested | 1024 | no | `newScore`, params, added keywords; fallback `atsScore + doneCards*5` (`:2277`) | in-session | none | A | yes |
| 16 | `JDAnalyzer.jsx:40` | `buildJDPrompt`: `matchScore` 0-100, requirements, strengths, gaps, hidden keywords; "untrusted data" preamble | JD ≤12000 + resume text or PDF | 2500 | yes | whole analysis | `jd_analyses` (only if `matchScore` not null) | none (code `normalizeJDResult`) | B | yes |
| 17 | `CoverLetterGen.jsx:33` | `buildCoverLetterPrompt`: "use ONLY facts in the resume", tone rules, untrusted-data preamble | JD, role, resume text or PDF | 2500 | yes | letter, subject, selling points | `cover_letters` | none | C | yes |
| 18 | `HiringManagerSim.jsx:51` | `buildQuestionsPrompt`: 5 persona questions | role + resume text or PDF | 2500 | yes | question list (`normalizeQuestions`) | in-session | – | C | yes |
| 19 | `HiringManagerSim.jsx:67` | `buildEvaluationPrompt`: answer score + feedback | question, answer, resume | 1800 | no | score (clamped in code), verdict by `verdictFor`, feedback | `mock_sessions` (avg only) | `findUnsupportedNumbers` warnings | B | yes |
| 20 | `MemoryDashboard.jsx:59` | personalized plan incl. `overallProgress` "0-100 score based on activity" and `status` | `buildMemoryContext(memory, form)` | 1500 | no | progress bar, plan | in-session | none | A for progress, C for plan | yes |
| 21 | `SalaryCoach.jsx:82` | market salary ranges by level and employer type | role, market, level | 900 | no | range table, `pct` bars | `memory.salaryMarket` cache | none | A/sourced data needed | yes (contract §3 says the Market tab is switched off by `MARKET_DATA_ENABLED = false`; the flag was not located in this pass: UNKNOWN which screen reaches `:82`) |
| 22 | `SalaryCoach.jsx:290` | `buildSalaryPrompt`: negotiation script; math done in code (`negotiationMath`) | situation, offer, target, resume or PDF | 3000 | yes | script, tactics | none | `findUnsupportedFigures` | C | yes |
| 23 | `SkillsGap.jsx:72` | skills list with level/status and recommendations; market numbers removed | role, market, scan summary, JD titles | 1500 | no | skills table | `memory.skillsGap` | none; rule `ai-market-numbers` | B | yes |
| 24 | `STARBuilder.jsx:43` | `buildStarPrompt`: section scores + polished story | user's S/T/A/R | 2500 | no | scores (clamped), `overallScore` in code, rewrite | `star_stories` | `findInventedNumbers` | B | yes |
| 25 | `resumeParser.js:40` | `extractResumeFromPdf` | PDF | 8192 | yes | – | – | – | – | **no caller** |
| 26 | `resumeParser.js:54` | `extractResumeFromDocx` | text | 8192 | no | – | – | – | – | **no caller** |

Prompts live inline in the files above except: `star.js` (`buildStarPrompt`), `interview.js` (`buildQuestionsPrompt`,
`buildEvaluationPrompt`), `salary.js` (`buildSalaryPrompt`), `coverLetter.js`, `jdAnalysis.js`, `atsBuilderUtils.js`
(`buildRebuildPrompt`, `buildAnalysisPrompt`). The prompt text of `buildSystemPrompt` (AI Coach) and
`buildMemoryContext` (Memory) was not read: UNKNOWN content, so what personal data they send is UNKNOWN.

## 3. Same input sent to the model more than once (CONFIRMED)

The resume text can be sent by #2 (onboarding), #3, #9, #12/#13, #16, #17, #18, #22 and #23 independently. There is no
cache by `content_hash` (`resumeFacts.js` computes one, nothing uses it). Cost impact: UNKNOWN (no metering).

## 4. Non-LLM backend dependencies

| Function | Purpose | Caller | Auth | Evidence |
|---|---|---|---|---|
| `jobs` | Adzuna proxy | Job Search, Landing (guests) | none for guests | `supabase/functions/jobs/handler.js`, tests |
| `verify-cert` | fetch allowlisted certificate pages, decide `verified` | VerifyCreds for coursera, udemy, accredible, edx, freecodecamp, kaggle (`VerifyCreds.jsx:241`) | signed-in user | `verify-cert/handler.js`, 22 tests |
| Credly | direct browser fetch of `credly.com/badges/<id>.json`, not through the function | VerifyCreds | none | `VerifyCreds.jsx:247-266` |
| Supabase REST | `user_memory`, `resume_scans`, `applications`, `star_stories`, `cover_letters`, `jd_analyses`, `mock_sessions`, `negotiation_practice`, `insights`, `profiles`, `candidate_trust_profiles`, `employers`, `employer_members`, `job_listings` | `useMemory.js`, `App.jsx`, TrustMatch, EmployerPortal | user JWT | schema and RLS UNKNOWN |

## 5. Findings specific to AI entry points

1. **Models asked to compute what code can compute** (#9, #12, #13, #15, #20; #2 for `yearsExp`). #9 prompt itself tells the
   model that five sub-scores "should aggregate to the overall atsScore" (`ATSBuilder.jsx:1016`).
2. **Two different prompts produce an "ATS score" for the same module** (#9 and #12/#13), and #15 re-scores with a third.
3. **Rewrite prompts without a guard**: #10 ("more quantified … Never use placeholders"), #14, #17. Only #4, #19, #22, #24
   apply figure checks, and those cover figures only, not ownership or scope inflation (contract; `VERIFICATION_STATUS`).
4. **Prompts that wrap the resume as untrusted data**: #16 and #17 only. The others interpolate resume text directly.
5. **Temperature is provider-dependent** (see §1), so identical input can vary by run and by provider.
6. **Silent failure**: #4 ignores an unparsable response (`ResumeScan.jsx:483`); #10 and #8 swallow errors (`catch { /* silent */ }`).
7. **PDF base64 to the provider** in 8 places (#1, #5, #11, #16, #17, #18, #22, #25). Frequency and provider retention terms: UNKNOWN.
