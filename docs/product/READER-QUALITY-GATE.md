# Reader quality gate (before the free CV check is shown to the public)

Status: **proposal, thresholds to be approved by the owner BEFORE any annotated results are looked at.** Written 2026-10-10 after an external review of the flow design asked for a pre-registered quality gate.
Why: the first thing a visitor sees would be the reader's result. If the reader misses an ordinary heading (it missed "WORKING EXPERIENCE" until 2026-10-10) the first impression is wrong, and a wrong result shown with confidence costs more trust than it earns sign-ups.

## 1. The tool (built)

`src/ingestion/readerEvaluation.test.js` runs every file in `tests/fixtures/documents/real/` (local only, git-ignored, never committed: the repository is public) through ingestion, fact extraction and the ATS Readiness score, and prints counts only, never text:

```
READER_REPORT=1 npx vitest run src/ingestion/readerEvaluation
```

If `tests/fixtures/documents/real/expected.json` exists (also local only) every file is compared with a human annotation:

```json
{ "cv_01.pdf": { "name": true, "email": true, "experience": true, "education": true, "skills": true, "bulletsMin": 3, "datedMin": 2, "readable": true } }
```

Keys are optional. `readable: false` is for files the reader must refuse (scans, corrupt, password-protected): they must never receive a score.

## 2. First observation on the four open-licensed public templates already in the folder (2026-10-10, counts only)

| File (layout) | Experience found | Bullets / dated roles | Email | Score shown today |
|---|---|---|---|---|
| libre_cv_2col (two columns) | yes | 14 / 2 | yes | 72 (measurable impact 7) |
| modern_2col_icons_table_tikz (icons, table) | **no**, although an Experience heading was recognised | 0 / 0 | yes | **100** (only 1 of 3 checks assessed) |
| sfiucr_1col_table (academic, table) | **no** | 0 / 0 | **no** | 25 |
| swe_1col_icons_table (icons, table) | **no**, although an Experience heading was recognised | 0 / 0 | yes | **100** (only 1 of 3 checks assessed) |

What this shows (Verified for these four files only; four files prove nothing about rates):
1. **Table and icon layouts: the Experience section is recognised but no roles, bullets or dates come out of it.** This is the same failure the owner saw on a real professional CV.
2. **A score of 100 was shown when only one of three checks could be assessed.** The score is the weighted mean of the checks that were assessed, and completeness alone can reach 100. Fixed the same day in the ATS Builder screen: a result built from fewer than all three checks is now labelled "Partial result: based on N of 3 checks" and is no longer shown as a green "Strong Resume".

## 3. Test set to build (kept outside the repository)

At least **30 anonymised CVs** (annotate every one; the gate below needs at least 20 annotated), chosen to be hard on purpose and recorded with their layout:

| Group | Minimum |
|---|---|
| Plain one-column Word/PDF | 5 |
| Two-column / sidebar (Canva-style, Overleaf) | 6 |
| Tables and icon fonts | 5 |
| Unusual headings (for example Career Highlights, Professional Background) | 4 |
| Dates in several styles (Jan 2021 - Present, 01/2021 - nay, 2019-2021) | 4 |
| Vietnamese CVs | 4 |
| Unreadable on purpose (scan without text, corrupt, password-protected) | 2 |

Rules: anonymise names, emails, phones, addresses and links; clear author metadata; use only CVs whose owner agreed; do not use a CV you have no right to copy (see `tests/fixtures/documents/real/README.md`). A person who did not write the extraction rules does the annotation.

## 4. Pre-registered gate (proposed numbers, owner to approve or change before the data are scored)

| Measure | Pass when |
|---|---|
| Name, e-mail, experience, education and skills found exactly where the annotation says they are | at least **95%** of readable annotated files |
| Bullets and dated roles at least as many as the annotation's minimum | at least **90%** of readable annotated files |
| An unreadable file receives a score | **never** (0 files) |
| A result with fewer than all checks assessed is shown as a normal score | **never**: it must say "partial" and why |
| The same file read twice | identical result, always |
| Network | the check makes **no request that carries CV text** (test the real page in a browser's network log before saying "your CV stays on your device") |

These numbers are the assistant's proposal, not a standard. If the first measurement misses them, fix the reader (heading names, table handling) or narrow what the page claims; do not lower the numbers afterwards to fit.

## 5. What the reviewer asked for that is not covered here
- The sign-up carry-over (move the CV from the page to the account only after confirmation, handle a failed save, no duplicate, no CV in logs): designed in `FLOW-REVIEW-AND-TRY-FIRST-DESIGN.md` step B3, to be tested when built.
- The A/B test: fix the primary metric, duration and sample size from a measured baseline before starting; there is no baseline in the repository today.
