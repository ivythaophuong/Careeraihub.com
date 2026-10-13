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

## 6. Decisions for the product owner
1. Accept the principles in section 3 (no AI draft for dates and contact).
2. Order of slices: A, B, then C for one kind first. Which kind first: Skills, Dates, or Education/Contact?
3. Skills as chips (proposed) or one comma text box.
