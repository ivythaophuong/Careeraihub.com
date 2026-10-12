# DESIGN: making the Resume Builder calmer, in steps (design only)

Status: **design only, approved in principle by the product owner on 2026-10-12.** No code, scoring, AI, storage or SQL change.
Labels: **[VERIFIED]** read in source or seen in a screenshot of the product owner's browser · **[PROPOSAL]** a design choice · **[UNKNOWN]** not verified.
Related: `DESIGN-fix-page-flow.md` (the Fix page; its PR may not be merged yet).

## 1. The problem
The Builder shows too much at once. In the product owner's screenshots [VERIFIED]: the right column stacks template tabs, two download buttons, the ATS panel with machine-style lines (`contact.name: present`, `Sections: 100`), a five-card Suggestions panel and, last, the live preview, which starts below the fold; the left column holds a step form with a "Fixing: …" note above it. The same issue appears three times (the note, a suggestion card, a "found by the code checks" item).

Observed bug [VERIFIED from a screenshot, cause not verified]: the issue "Missing professional summary" opened the Builder at step 2 (Experience), not at Summary. The mapping in code is right (`stepIndexFor`: 1 Contact … 5 Summary), so the saved `builderStep` of that issue was most likely 2, a value the AI chose [UNKNOWN: the stored value was not read]. **The AI's step number is not to be trusted to place the user.**

## 2. The input: a redesign deck (10 slides, "CareerAIHub Resume Builder UI UX Redesign")
Taken as **structure only**; its copy and claims are not taken.

Adopted:
| Idea | Where it goes |
|---|---|
| Four separate stages: upload, audit, edit, export | step list in section 4 |
| A separate audit screen for the score and the issues | step 2 |
| A list of CV sections on the left instead of the thin step bar | step 3 |
| A fixed A4 preview that is never pushed below the fold | step 3 |
| Feedback from the AI next to the field it is about | the Fix page; later the editor |
| Hover a field, the matching part of the CV lights up | step 5 |
| An export screen, with a plain-text copy | step 4 |
| A priority tag per issue | uses the existing `severity` |

Not taken, and why:
| In the deck | Why not |
|---|---|
| "Increase candidate conversion", "reduce 70% of redundant actions" | no measurement behind them |
| "Real-time AI Sync", "AI Auto-Fix Active", "Apply automatically", a 1-click apply | AI only drafts; the user decides; a figure the resume lacks becomes `[X]` and is reviewed first |
| A score of 80 labelled "Good", "high compatibility", "5 more small points" | the score is computed by code and says it is not a prediction of an ATS; no grade label, no invented gap |
| "Fix all issues" | the product never says everything is fixed |
| "Add % growth to the PwC projects" | it asks for a figure; the wording must be "add a real figure you have" |
| A draft such as "7+ years" shown inside the live CV as if it were content | an unverified claim must be marked "AI draft, not saved" |
| Light theme, indigo primary, a new font | a brand decision, not part of this work (see section 3) |
| A real person's name and email in the mockups | never put real personal data in the repository; synthetic data only |

Missing from the deck, to be designed: no states for "text not found", "several places", "AI unavailable", "save failed", "no issues"; no narrow screen; the five templates, Version History and the Summary, Awards and extras steps are not shown; hover has no touch equivalent; the marks added so far cover the summary and bullets only.

## 3. Decisions of the product owner (2026-10-12)
1. Take the **structure** of the deck, not its claims or labels.
2. **Keep the dark theme and the current tokens** (`--lp-*`, teal and pink). Only the layout changes.
3. Go in the steps below, one small pull request each, tests first.

## 4. The steps [PROPOSAL]
| # | Step | What changes for the user | Risk |
|---|---|---|---|
| 1 | The Fix page (see `DESIGN-fix-page-flow.md`) | one issue at a time, the resume as the main element | medium |
| 2 | **A separate audit screen** | the score, its breakdown in plain words and the issue list leave the Builder's right column and sit on their own screen between upload and edit; each issue has a Fix button and a priority tag | low: moves existing pieces |
| 3 | **Section list and a calm right column** | a list of sections on the left replaces the step bar; the right column keeps only the live preview and a small toolbar (template, download); score and suggestions are no longer stacked there | medium: layout and the chosen template must be kept (section 5) |
| 4 | **Export screen** | PDF, Word and a plain-text copy together | low |
| 5 | **Hover highlight** | marks for the remaining fields (contact, education, skills) and a hover link between a field and the preview; not on touch screens | medium |

Each step keeps the Builder usable if the next one is never built.

## 5. Rules that apply to every step
- **Words.** Allowed: "AI draft", "Use suggestion", "Review issues", "Add a real figure you have". Not allowed: auto-fix, real-time AI, apply automatically, fix all, optimized, a grade word or a colour by value on a score, a claim about conversion or time saved.
- **Placing the user.** Where an issue is fixed comes from where its quoted text is found in the data (`locateAll`), never from the AI's `builderStep` alone. When there is nothing quoted, the AI's step is shown as "the AI suggests this is fixed in: Summary", and the user can go there; it is not presented as certain.
- **Template.** The chosen template is held one level up and kept when the user moves between screens (decision 5 in the Fix page design).
- **Narrow screens** are designed in each step; the preview is never placed below a long form.
- **When the AI cannot be reached** (for example the browser blocks the call): the audit screen says so in plain words and the deterministic score and checks still show; the message does not say "Parse failed". The fallback that reads the CV without AI is a separate design.
- **Accessibility.** Keyboard reachable, visible focus, a mark that does not depend on colour alone.
- No change to scoring, to the AI call, to what is stored, or to the exports' content.

## 6. Open for the Fix page
- Issues that say a section is **missing** ("Missing professional summary") have no quoted text to find. The Fix page as approved does not cover them; they stay on the existing step flow until a design for them exists (proposed as the next Fix page PR). A possible rule not using the AI's step: when the Summary field is empty, offer the empty Summary field as the place to write; not decided.

## 7. Tests (written first, per step)
Step 2: the audit screen shows the score, the plain-words breakdown and every issue with its priority; the Builder no longer renders the ATS and Suggestions panels in its right column; nothing says "fixed all"; with no AI issues it says why. Step 3: the preview is rendered before the toolbar content in reading order and is not placed below the form on a narrow screen; the section list reaches every step including Summary and Review; the chosen template survives a trip to another screen. Step 4: the three exports give the same text as today. Step 5: each field has a mark; hover and keyboard focus light the same part. Existing ATSBuilder tests keep passing unless a step changes the behaviour they check, and then the change is named in the pull request.

## 8. Not known
- The stored `builderStep` of the issue in the screenshot.
- Whether the plain-text copy already exists.
- Whether four regions (app sidebar, section list, form, A4 preview) fit a 1366 px laptop.
- Whether any of this changes how often users finish fixing issues: there is no analytics on it today.
