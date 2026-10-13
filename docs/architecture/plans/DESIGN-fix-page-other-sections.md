# DESIGN: the Fix page for the sections it does not cover yet

Status: DRAFT for the product owner. No code is written. Only what is verified in source is stated as fact; the rest is UNKNOWN or a proposal.

## 1. What is covered today [VERIFIED in source]
- `fixTargets` (fixPage.js) finds the quoted text only in the summary (`at.kind = 'summary'`) and in bullets (`at.kind = 'bullet'`, `exp` + `bullet`). `rawField`, `writeField` and `isDrawn` know only these two kinds.
- `data-fix-at` marks exist only for `summary` and `b:<job>:<bullet>`, in the five templates.
- `stepForIssue` (issueStep.js) sends everything else to the step form: 1 Contact, 2 Experience, 3 Education, 4 Skills, 5 Summary.
- The shape of the Builder data (builderText.js): job = `{ title, company, period, bullets[] }`; education entry = `{ degree, institution, year }`; `skills` is a list of strings; contact fields are plain strings; `awards` and `extras[]` exist.

## 2. What is not covered
| Issue type | Today | Why it differs from a bullet |
|---|---|---|
| Dates / period (`period`, education `year`) | step form | A date is a fact. The AI must never invent one. There is no sentence to rewrite. |
| Skills | step form | A list, not a sentence. An AI draft would add skills the user may not have. |
| Education | step form | Three short fields per entry. |
| Contact | step form | Fixed fields (email, phone, link, location). |
| A missing section (for example no summary) | step form with a Use suggestion card | There is nothing to quote or mark. |
| No quoted text | step form | Nothing to find. |

How often each type occurs in real analyses is UNKNOWN: no sample of real AI issues is in the repo, and none may be added (real CVs are not committed).

## 3. Principles (from the standing rules)
1. Code decides what it can: a missing field, a date that does not parse, a duplicate skill, an email that is not an email are found by code, not by the AI.
2. The AI may suggest wording only where there is wording (a summary, a bullet). For dates and contact it suggests nothing: it asks the user for the real value.
3. Unknown stays unknown: a missing date is "not given", never a guess.
4. Anything the AI proposes that is not in the resume is labelled a suggestion, and a figure or name not in the resume is `[X]`.

## 4. Proposal, one slice at a time (each a small PR, tests first)
**Slice A: the field model.** Extend `at` with `period:<job>`, `year:<entry>`, `edu:<entry>:degree|institution`, `skills`, `contact:<field>`, and make `fixTargets`, `saveFix`, `issueStatus` and the marks work on them. Pure functions, no screen. Tests first.

**Slice B: marks.** Add `data-fix-at` to the date, education, skills and contact blocks in the five templates, so the right part of the resume is highlighted. Test: every template renders each mark.

**Slice C: the card, by kind.**
- Dates: the box starts with what the resume has; a hint says what is missing ("no end date"); no AI draft; Save & next.
- Skills: the current list as chips; Add a skill (a text box) and Remove; the AI's suggested skills are shown as "Suggested, add only what you have" and added one at a time, never all at once.
- Education and Contact: the fields of that entry, no AI draft except to show the issue's text.
- Missing section: the same card with an empty box and the suggestion folded, as for the summary.

**Slice D: routing.** `stepForIssue` keeps deciding by code; the Fix page opens for the new kinds only when the target is found, and the step form stays the fallback.

## 5. Not decided / UNKNOWN
- Which of these types matters most to real users (no data).
- Whether skills should be chips or a comma text box (a usability question; a 3-person test would answer it).
- Whether a date issue should offer a code check (for example "end date before start date") as its own deterministic finding.

## 6. Decisions (product owner, 2026-10-13)
1. Principles in section 3: approved.
2. Order: A, B, C, D, with Skills first, then Dates, then Education/Contact. Not all kinds in one slice.
3. Skills: chips plus a box that adds one skill.
4. No code until the data contract and the way entries are identified are written down (section 7) and the tests for them exist.
5. The first Skills slice is manual editing only. AI skill suggestions come later (section 8).

## 7. How an entry is identified [VERIFIED in source: ATSBuilder.jsx]
- Jobs and education entries have an `id`: the parser gives `id = index` when it builds the draft, an added entry gets `Date.now()`, the sample uses 0, 1... Lists are rendered with `key={job.id ?? i}`. The Builder has no reorder or drag code (none found), but entries can be added and removed, so positions can shift while ids stay.
- Bullets and Skills have no id. Bullets are addressed by `exp` index + `bullet` index today (the existing `at`). Skills are plain strings.
- Consequence for the model: new targets for jobs and education should carry the entry `id`, resolved to a position at read time, and fall back with a clear error when the id is gone. The existing summary and bullet targets are not changed. Skills are addressed by their normalised text (NFC, trimmed, case-insensitive), not by position.
- UNKNOWN: whether two entries can share an `id` after parsing and adding (parser ids are 0..n-1, `Date.now()` ids are large, so a clash looks unlikely but is not tested). Slice A starts with a test that finds out.

## 8. Three kinds of finding (so the card is honest about who knows what)
| Kind | Who decides | Example |
|---|---|---|
| A fault code can see | code | empty skills list, a skill repeated after normalising, an email that is not shaped like one, an end date before the start date |
| Information that is missing | the user supplies it | no end date, no phone |
| Content the user must confirm | the user | a skill the AI suggests, the exact degree |
Code never rewrites an email or a date into a different value; it reports and asks.

## 9. Slices and pull requests
- PR A: field model, pure functions, tests first, no screen. Acceptance: each `at` names exactly one field of one entry; `saveFix` writes only that field; `issueStatus` is computed from the saved data, not from a button; a missing field or deleted entry gives a clear fallback; the summary and bullet targets behave as before.
- PR B: template marks, only when the model is stable; all five templates.
- PR C1: Skills, manual edit.
- PR C2: Dates, show what the resume has, mark a missing or invalid date, never invent one.
- PR C3: Education and Contact, with the fallback of each.
- PR D: routing, open the Fix page only for a valid target, otherwise the step form.
- Later: AI skill suggestions, shown as "Suggested by the AI", never added automatically, added one at a time after the user confirms, never shown as verified.

## 10. Skills acceptance checklist (PR C1)
1. The Skills target is found and maps to the right data.
2. Adding a skill adds exactly one item.
3. Removing a skill leaves the others unchanged.
4. Spaces and duplicates are handled the same way every time.
5. No AI-suggested skill is added.
6. After saving, the issue status is recomputed from the saved data.
7. All five templates still draw correctly, and the summary and bullets are not affected.
8. Tests cover an empty list, bad data and a target that no longer exists.
