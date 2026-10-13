# DESIGN: a guided journey for a first-time user of the Resume Builder (design only)

Status: **DRAFT for the product owner, written 2026-10-13.** The product owner asked to start it ("Bắt đầu 4 bước"). No code, scoring, AI, storage or SQL change. Nothing here is built until the decisions in section 7 are made.
Labels: **[VERIFIED]** read in source or seen in a screenshot of this session · **[PROPOSAL]** a design choice · **[UNKNOWN]** not verified.
Related: `DESIGN-builder-restructure.md` (the calmer Builder; it chose "four stages: upload, audit, edit, export" and a separate audit screen) and `DESIGN-fix-page-flow.md`. This document does not repeat them: it adds the part that tells a new user where they are and what to do next.

## 1. The problem
A new user sees four tabs (Upload & Parse, Builder, Templates, Version History) and, in the Upload tab, a score card, a breakdown and a list of issues, with no sign of an order to follow [VERIFIED, screenshots]. Words such as "Builder", "ATS Readiness" and "Suggestions" are the product's own and are not explained [VERIFIED in the labels; whether a first-time user finds them hard is **UNKNOWN**: it was said by the product owner twice and has never been observed with other people]. How many users stop, and where, is **UNKNOWN**: there is no analytics on it.

## 2. What already exists [VERIFIED in source]
| Stage | Where it is today | What moves the user on |
|---|---|---|
| 1. Add the resume | Upload & Parse tab (upload, paste, or "Load from memory") | the AI analysis, or the saved profile |
| 2. See what to improve | the same tab: ATS READINESS card, Score breakdown, "Issues to fix" | a "Fix in Builder" button on each issue, and a "Fix These Issues in Builder" button |
| 3. Improve | the Fix page (one issue at a time, with the resume beside it), and the Builder step form for the issues the Fix page does not cover | Save & next, Leave it for now; at the end "Open the Builder" and "Choose a template that suits you" |
| 4. Choose a layout and download | the Templates tab: step 1 of 2 pick a layout (with "Next: download or save"), step 2 download PDF or Word, save a version | Next, Download, Save this version |

So the journey is mostly there. What is missing is that nothing says "you are at stage 2 of 4" and that each screen has more than one equally loud way forward.

## 3. The proposal [PROPOSAL]
### 3.1 A progress strip
A strip of four named stages above the tab bar. It shows **where the user is** and **which stages they have already been to in this visit**; each stage can be clicked to go there. It is decided by code from where the user is, never by what the AI says, and it never says a stage is "done" or "complete": that would be a claim about the resume that the product cannot make.
| Stage | The user is in it when |
|---|---|
| 1 Add your resume | on the "Your resume" tab and no profile is loaded |
| 2 See what to improve | on the "Your resume" tab and a profile is loaded |
| 3 Improve | on the Fix page, or on the Builder (edit) tab |
| 4 Choose a layout and download | on the Templates tab or the Version History tab |
A stage the user has been in during this visit is shown as "visited" (a mark that does not depend on colour alone), the one they are in as "you are here", the others plainly. The strip changes nothing about the tabs: the tabs stay, so an experienced user is not slowed down.
**Why not "done":** the product does not keep whether an issue was left aside (only what was saved), nor whether a file was downloaded [VERIFIED: the records hold only saved changes; no download event is stored]. So "done" could not be computed, and a guess is not allowed. "Visited" is exactly what the page knows.

### 3.2 One main button per screen
Each stage has exactly one pink button that moves the user to the next stage, with the same wording pattern "Next: ...":
- Stage 1: the analysis button, then "Next: see what to improve" once a profile is loaded.
- Stage 2: "Next: improve it" (opens the Fix page on the first issue that is not applied; with no issues it says so and offers "Next: choose a layout").
- Stage 3: the Fix page's own Save & next stays; at the end of the issues the one main button is "Next: choose a layout".
- Stage 4: "Next: download or save" (already there), then the downloads.
Other actions on the screen (leave it for now, open the Builder, back) stay but are not pink. The pink colour is used once per screen, as the product already requires.

### 3.3 Plain labels
Proposed replacements (all are **proposals** for the owner to accept or change; none is a claim):
| Now | Proposed | Why |
|---|---|---|
| Upload & Parse | Your resume | says what it is for, not how it works |
| Builder | Edit your resume | a verb the user understands |
| Templates | Layout & download | what the user does there |
| Version History | Saved versions | plain |
| ATS READINESS | ATS check | shorter; "ATS" stays because job seekers meet it elsewhere. Whether to explain it in one line is a question for the test |
| Issues to fix | What to improve | softer, and not a promise that it can all be fixed |
| Suggestions (panel) | AI drafts | matches the rule "AI draft", "Use suggestion" |
The words banned by the product rules stay banned (auto-fix, real-time AI, apply automatically, fix all, optimized, a grade word or a colour by value on a score, conversion claims).

### 3.4 What it does not change
Scoring, the AI call, what is stored, the exports, the Fix page cards, and the dark theme and tokens. The strip and the labels are interface only.

## 4. Slices [PROPOSAL], one small pull request each, tests first
1. **Stage logic, no screen:** a pure function from where the user is (the tab, whether the Fix page is open, whether a profile is loaded) to the stage they are in, and one that adds a stage to the set of visited ones. Tests: each row of the table in 3.1, an empty state, bad input, and that nothing ever returns "done".
2. **The strip:** the component and its place above the tab bar; keyboard reachable, a mark that does not depend on colour alone, a narrow-screen layout (checked at 390 px). Tests: the right stage is marked, a click goes back, the screen reader name says "step 2 of 4".
3. **One main button per screen:** the wording in 3.2 and the single pink button. Tests: one primary button per stage, and the owner's banned words are absent.
4. **The labels:** 3.3, with every existing test that reads a label updated in the same PR.
5. **A check with people** (section 5), before any further change.

## 5. How to find out whether it helps [PROPOSAL; owner decides]
Nothing in the product measures this today. A small observation test is the cheapest honest way:
- 3 people who have not used the product, each on their own CV (never put a real CV into the repository or the chat).
- One task: "get a version of your resume you would send." No help unless they have been stuck for two minutes.
- Record, with a note and a stopwatch: how long to the first fix saved; where they hesitated or asked "what is this"; which words they did not understand; whether they found the download.
- Do it once on the current version (the baseline) and once after slices 1 to 4. With three people it shows problems, it does not measure a rate; no percentage is reported and none may be used in the product's copy.

## 6. Risks and unknowns
- **UNKNOWN:** whether four stages fit every user: someone who only wants a new layout starts at stage 4. The strip must let them go there directly (the tabs do).
- A user who edits in the Builder step form moves between stages 3 and 2 often; the stage is read from the state each time, so the strip follows them, but how it feels is **UNKNOWN** until tried.
- Renaming tabs changes the words in tests, in the sidebar help text and possibly in the landing page; a search for each old label is part of slice 4.
- The saved layout choice and the Fix page view choice are kept as they are.

## 7. Decisions for the product owner
1. Accept the four stages, and the rule that the stage is decided by code from where the user is and that the strip says "you are here" and "visited" but never "done" (3.1).
2. Accept "one main button per screen" and its wording (3.2).
3. Accept, change or reject each proposed label in 3.3 (a short answer per row is enough).
4. Whether to run the 3-person test (section 5) and who the three people are; it can be done before slice 2 to set the baseline.
5. The order: slice 1 and 2 first (the strip alone, labels unchanged) is the smallest step that can be seen; or start with the labels (slice 4), which is the smallest code change.
