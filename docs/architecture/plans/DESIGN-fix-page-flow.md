# DESIGN: the Fix page (fix one resume issue in the context of the resume)

Status: **design only, not approved.** No code, scoring, AI, storage or SQL change. Written 2026-10-12 for the product owner.
Labels: **[VERIFIED]** read in source · **[PROPOSAL]** a design choice · **[UNKNOWN]** not verified.

## 1. The problem
"Fix in Builder" (ATSBuilder.jsx, the Fix button of an issue) sends the user to the Builder step and adds a "Fixing: <title>" note above the form. The Builder is a two-column page whose right column stacks templates, downloads, the ATS panel, the Suggestions panel (one card per issue) and, last, the live A4 preview, which ends up below the fold [VERIFIED from a screenshot of the product owner's browser]. The user reads the issue in one place, edits in another, and cannot see the resume. The old Builder is otherwise kept: only this flow changes.

## 2. The idea chosen
**Fix in context, with a live preview of the change.** One issue at a time, on its own page: the resume is the main element, the place to fix is marked, the card beside it holds the reason, the AI draft and an edit box, and the marked passage in the resume shows what the user types before anything is saved ("Preview of your change, not saved").

Taken from the mockups: resume first, side card, a position in the list ("Issue 2 of 5"), a chooser for several matches, a link-out for issues that belong to another module, tabs on a narrow screen. Not taken: the floating AI box over the document (it hides the text to fix), a word-processor toolbar (out of scope), two full documents side by side (heavier than a live preview of one passage), and the ATS panel, templates and downloads on this page.

## 3. What already exists and is reused [VERIFIED]
`src/features/ATSBuilder/applyIssue.js` and `components/BuilderIssuesPanel.jsx` already do the hard parts; the Fix page is a new presentation of them, not a new engine.
- `locateAll(data, before)` finds the quoted `before` text in the **summary and the experience bullets**, ignoring differences in spaces, quotes and dashes; it returns every place. One place: apply. Several: the user chooses. None: nothing is guessed.
- `applyIssue` neutralises figures in the draft that the resume does not contain (`factGuard.neutralizeInventedFigures`): they become `[X]`, and the panel says "Replace [X] with your real figure, or remove it".
- `claimGuard.claimWarnings` adds warnings for claims beyond the figures; the button then reads "Apply — I confirm this is true".
- `undoApply` finds the inserted text by content, not position. Status is read from the current text: Applied, Open, Changed by you. **The panel never says "Resolved"**, and neither may the Fix page.
- `exportGuard.confirmExport` asks before a file with `[X]` left is exported.
- The working copy is the Builder `data`, kept in the browser (`localStorage`, `builderDraftKey`), and the applied records under `builderAppliedKey`. It is not in the database [VERIFIED]. It is lost if the user clears the browser data or changes device.

## 4. Scope: which issues use the Fix page [PROPOSAL]
| Issue | Where it goes |
|---|---|
| `before` is found in the summary or a bullet (1 place) | Fix page |
| found in several places | Fix page, with the chooser first |
| no `before`, not found, or about Contact, Education or Skills (the locator reads only the summary and bullets) | the existing "Fix in Builder" step flow, unchanged |
| `module` = scan (needs a job description) | a link to the JD scan, no edit box |
| no AI issues at all (the AI call failed or returned none) | the page is not offered; the user is told why. See the degradation plan (separate) |

## 5. The flow
```
Upload & Parse results (the issue list, each issue shows Open / Applied / Changed by you)
   │  Fix            "Fix These Issues" = the first issue not yet applied
   ▼
Fix page, issue i of N ─ Skip ───────────────► next issue (this one stays Open)
   │  Save & next ───────────────────────────► next issue (this one is Applied)
   │  Back to list ──────────────────────────► the list (saved changes kept, the edit in the box is asked about first)
   ▼ after the last issue
Summary: "N issues reviewed: A applied, O open, C changed by you"  →  Back to list | Open the Builder
```
Controls: one primary (**Save & next**), then **Use suggestion**, **Skip**, **Back to list**. No separate arrows, X and Cancel (they mean the same thing as Back to list).

## 6. The page
Desktop: the resume about 60% and the card about 40% (a starting point, not a requirement), the resume scrolls the marked passage into view. Narrow screen: two tabs "Resume | Fix"; "Save & next" keeps the user on the Fix tab, and "Show in resume" jumps to the Resume tab.

The card, in reading order:
1. Position and severity ("Issue 2 of 5 · High").
2. Title and why it matters (the issue `description`, as the AI wrote it; the page adds no claim about score gain).
3. **Edit box**, filled with the user's current text of that bullet. Their original is shown only after they change it ("Original: …").
4. **AI draft**, labelled "AI draft". If it holds figures the resume does not contain, it is shown the way it would be saved: with `[X]` marks and the warning "These figures are not in your resume: 30%. Put your real figure, or remove it."
5. **Use suggestion** copies the (guarded) draft into the edit box. It never saves. If the draft has `[X]` or claim warnings, it is the quiet button and "Edit myself" is the primary; the label keeps the existing wording "I confirm this is true". Confirming is the user's own statement, the product does not verify it.
6. **Save & next**. If `[X]` is left in the box the page says so and the issue stays Open (it is not "applied with a blank"); the export check remains the last guard.

Marked passage: an outline and the label "To fix", not colour alone.

## 7. States
| State | Behaviour |
|---|---|
| One place found | marked, edit box ready |
| Several places | a list first ("Acme, bullet 2", the labels `locateAll` already gives); choosing one marks it |
| Not found | the resume without a mark and the existing text "Could not find that text in your resume any more"; actions: Back to list, and "Edit this step" |
| No draft | the AI draft block is hidden; the edit box stays |
| Draft with new figures | see 6.4 and 6.5 |
| The user edited the draft | their text is the value; "Use suggestion" asks before replacing it |
| Saved | status Applied, the preview shows the saved text, "Undo" stays available for this issue |
| Save fails (the browser blocks storage) | the text stays in the box, a retry is offered [the code today ignores a storage error: the change would live for this visit only] |
| Skipped | stays Open in the list |
| Last issue | the summary in section 5, never "all fixed" |
| Another module needed | a card with a link to it |

## 8. What is not decided / not known
- **How to mark and live-preview the passage inside the rendered resume** [UNKNOWN]. The resume is drawn by five React templates from `data`. The preview can be re-rendered from a copy of `data` with the edited text (pure, cheap). Marking the passage needs either template support or marking the rendered text after the render. **A short technical spike must confirm this before the design is final.** Fallback: no mark, the card shows "Company, bullet n" and the page scrolls to that section.
- Edit the whole bullet or only the quoted words: `applyIssue` replaces only the quoted passage inside the field. The edit box should hold the whole bullet with the quoted words marked, and a save would write that field. This needs a small new function; it is not in the engine today.
- A pagination-based "Page 2" in the match list: not offered, the preview has no real pages [UNKNOWN].
- A character counter: not shown unless a real limit exists [UNKNOWN].
- Browser Back: not supported (the app has no router). In-app Back to list only.
- Where the list lives after a fix: the Upload & Parse results, because that is where the Fix button is today.
- Persistence: the working copy lives in the browser [VERIFIED]. This design does not change that.

## 9. Tests to write first
1. Entry: Fix on an issue found in one bullet opens the Fix page, not the Builder step; an issue about Education or Skills, or not found, keeps the old flow; "Fix These Issues" opens the first issue not applied.
2. The edit box starts with the current text, not the draft; Use suggestion fills the box and saves nothing.
3. A draft with a figure that is not in the resume shows `[X]` and the warning; the primary button is not "Use suggestion".
4. Save & next writes only the chosen field and leaves every other field unchanged; Undo restores the original; the status comes from the text.
5. Several places: the chooser appears and nothing is saved until one is chosen. Not found: no mark, no save.
6. The summary never says "fixed all" and counts Applied, Open and Changed by you.
7. The preview shows the text typed, before saving, labelled as not saved.
8. Narrow screen: the Resume and Fix tabs; the card is never placed above a hidden resume.
9. Keyboard: every action reachable, a visible focus, the marked passage not only coloured.
10. The Builder outside the Fix page is unchanged (the existing ATSBuilder tests pass).

## 10. Out of scope
Scores, scoring text, the AI call and its prompt, stored data, SQL, the templates themselves, inline editing inside a template, a word-processor toolbar, the degradation plan for an AI outage (own design), and the Reader.

## 11. Decisions for the product owner
1. Accept the scope in section 4 (the Fix page only for issues found in the summary or a bullet).
2. Accept the controls in section 5.
3. Authorise the short spike in section 8 (mark and live preview) before any build.
4. Accept that saving with `[X]` left keeps the issue Open.
