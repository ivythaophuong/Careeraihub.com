# Stage 1 measurement protocol (Resume Context)

Status: protocol for the owner's guided runs. Design: `DESIGN-resume-context.md`. Owner decision 2026-10-11 (Q4): **5 runs per feature**.

## What is measured
Per feature label, per run: `input_tokens`, `output_tokens`, `thinking_tokens`, `duration_ms`, `has_pdf`, `resume_kind`, `resume_chars`, outcome, attempt and provider. Counts only; no resume text is logged.

## Rules
- Use **one synthetic English CV** kept outside the repository, never a real person's CV. Run PDF-only features also with the same content as pasted text, to compare the two paths.
- 5 runs per feature is a **small sample**. Report minimum, median and maximum per feature, not an average, and say so. Thinking tokens vary from call to call.
- Count calls per label from the logs after the run. A shared-evidence read for a different purpose is not a duplicate; classify each call site by purpose first (Stage 1 report).
- Do not change code or settings between runs.

## Feature labels (one per call site)
| Label | Where it comes from | Resume part |
|---|---|---|
| `onboarding_pdf_extract` | App.jsx, only when pdf.js extraction fails | pdf |
| `onboarding_profile` | App.jsx, after upload | text, up to 4 000 chars |
| `scan_template_parse` | Resume Scan | text, up to the template limit |
| `scan_jd_match` | Resume Scan | digested text |
| `ats_parse` | ATS Builder | text, up to 5 000 chars |
| `ats_bullet_rewrite` | ATS Builder, Bullets tab | digest, up to 3 000 chars |
| `jd_analyze` | JD Analyzer | text or pdf |
| `cover_letter` | Cover Letter | text or pdf |
| `cover_letter_tone` | Cover Letter, tone change on an existing letter (only the letter is sent) | none |
| `mock_questions` | Mock Interview, start | text or pdf |
| `score_interview_evaluate` | Mock Interview, each answer (server) | text up to 6 000 chars |
| `salary_script` | Salary Prep, negotiation | text or pdf |
| `salary_market`, `skills_gap`, `ai_coach`, `memory_plan` | no resume | none |
| `score_star_review` | STAR Builder (server) | none |
| `mock_evaluate_legacy`, `star_review_legacy` | old browser-side path, only when server scoring is off | legacy |

## After the runs
Export the logs of `ai`, `score-star` and `score-interview` for the run window and run `node scripts/usage-report.mjs <file>`. Cost stays `price_unknown` until `PRICE_TABLE` is filled from provider pricing pages (a separate step).
