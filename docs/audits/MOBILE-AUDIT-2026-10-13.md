# Mobile audit, 2026-10-13 (report only, nothing was changed)

Status: DRAFT for the product owner. Everything below was measured or seen in a screenshot on this day, on `main` at 99f470c (after PR #103).

## How it was measured
- Headless Chrome on a Mac, each screen inside a frame 390 px wide (iPhone size), so the phone layout rules (max-width 768 px) apply.
- "Sideways scroll" = the page is wider than the frame (`documentElement.scrollWidth` greater than the frame width). The element that causes it was listed.
- Screens were opened without a signed-in shell: the Resume Builder through its demo data, the other modules rendered directly with an empty new-user profile. The app's own header, side menu, bottom bar and page padding were NOT part of it.

## What this does not cover (UNKNOWN)
- The signed-in shell on a phone (header, menu, bottom bar, drawer). Spacing at the page edge may differ from the shots.
- Screens with data (a scan result, a finished interview, saved stories), pop-up windows, the employer portal, the legal pages.
- A real phone, and widths below 390.
- Screens that were measured but not looked at one by one: Weakness Radar, Readiness Score, STAR Builder, JD Analyzer, Salary Prep, Regional Guide, AI Memory, Verify Credentials, Skills Gap, Career Roadmap, AI Career Coach. None of them scrolls sideways except JD Analyzer (below).

## Findings (severity is the author's judgement)
| # | Screen | What happens at 390 px | Evidence | Severity |
|---|---|---|---|---|
| M1 | Dashboard | The "This Week" card is pushed past the right edge; the page scrolls sideways to 576 px. | measured + shot | High |
| M2 | Cover Letter, Job Search, JD Analyzer | Text boxes are wider than their card: right edge 401 px (Cover Letter, 2 boxes; Job Search, 3 boxes) and 397 px (JD Analyzer, 1 box). The page scrolls sideways by 7 to 11 px and the boxes touch or cross the card edge. A common cause is likely (box width and padding) but it was not read in the code. | measured + shot (Cover Letter, Job Search) | Medium |
| M3 | Tab rows | A row of tabs runs past the right edge with no sign that it scrolls. Resume Builder: the 4th tab, Version History, is out of view, and when it is chosen its marker is out of view too. Interview Coach: "Live Session" and the rest are cut. | shots | Medium |
| M4 | Fix page, Compare view | Two resumes in a phone-width column are scaled to about 45 percent, so the text cannot be read. Focus (Edit and Resume tabs) is usable. | shot | Low to medium |
| M5 | Template screen | The text says "The page on the right is your own resume", but on a phone the resume is below. | shot | Low (wording) |
| M6 | TrustMatch | In the empty-profile state the profile card at the top is squashed to a thin strip (avatar and name cut). It may come from how the screen was rendered here, so it must be checked in the real app. | shot | UNKNOWN |
| M7 | Landing | In the "92 Excellent" ring of the Resume & ATS card, the word overlaps the ring. | shot | Low |

## What looked right
Landing page (no sideways scroll, readable); ATS Scanner; Resume Builder: Upload, the start chooser, the step form, Templates (both steps) and the Fix page after PR #103 (one pane at a time, resume fits the width). The Builder's top row, the demo banner and the page title did not scroll sideways.

## Suggested order (not decided)
1. M1 and M2 (page scrolls sideways): one small PR each, with a test where it can be tested.
2. M3: one shared fix for the tab rows (a visible cue and the chosen tab brought into view).
3. M4 and M5: after a decision on whether Compare is offered on a phone.
4. M6 and the screens listed under UNKNOWN: check in the real signed-in app first.

## Fix plan (one branch, fix/mobile-layout, one push)
Each step: a test first (it must fail before the change), then the change, then a measurement in headless Chrome at 390 px. A step that cannot be proved is not done.

| Step | Finding | Change | Proof |
|---|---|---|---|
| P1 | M1 Dashboard | The responsive layer collapses `1.4fr 1fr`. DONE (0804677) | 576 to 390 px |
| P2 | M2 inputs wider than their card | On phones (max-width 768 px) inputs, selects and text areas use border-box, so their padding is inside their width | Cover Letter, Job Search, JD Analyzer: the page is 390 of 390 px |
| P3 | M3 tab rows | A shared fix: the chosen tab is brought into view, and a row that scrolls shows a fade at its edge | Resume Builder (Version History), Interview Coach |
| P4 | M5 template wording | The template screen no longer says "on the right" | the existing text tests, updated |
| P5 | M7 ring label | The label no longer overlaps the 92 ring | look at it in Chrome |
| Later | M4 Compare on a phone | Needs a decision: offer Compare only on wider screens, or keep it | not in this branch |
| Later | M6 TrustMatch, and the screens listed as UNKNOWN | Check in the real signed-in app first | not in this branch |
