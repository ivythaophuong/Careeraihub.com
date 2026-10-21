# Landing page copy deck (phase L2), draft for the owner's review

Status: **draft, 2026-10-21. Nothing here is built or approved.** Written for the owner to read, cut and approve line by line before any code. Language: English (owner, 2026-10-19).

Sources: the strategy text the owner pasted on 2026-10-21 (another assistant's), `docs/product/LANDING-REDESIGN-STRATEGY.md` (its copy rules: section 6), `docs/product/LANDING-CLAIMS-AUDIT.md`, ADR-011, ADR-013, ADR-015 (proposed), and the code.
Labels: **Verified** = read in code or a document in the repository. **Owner** = only the owner can supply or approve it. **UNKNOWN** = not found.

## 1. What changed from the pasted text, and why

| Pasted text | This deck | Reason |
|---|---|---|
| Generic lines ("Practical tools for your next career move", "Explore Career Tools") | Each tool is named with what it does and what you get | The strategy's own test: could a competitor say this sentence too? The pasted hero fails it. The real product was never shown |
| Buttons "Explore Resume Tools / Career Readiness / Plan your next move" | Buttons name a live tool and open it | A button must lead to something that works today (section 5) |
| "Built in the open" | "Built step by step" | "In the open" reads as open source. UNKNOWN whether that is intended |
| Founder biography with a name, MBA and roles | A placeholder only: **Owner writes it** | Nothing in the repository verifies it. A personal claim stays unpublished until the person who owns it approves each sentence |
| Advisor section | Left out | Nobody has confirmed the role in writing (the pasted text says the same) |
| "Track sign-ups and activation" | Not on the page | No web analytics code was found on 2026-10-21. It is a build item (ADR-015 item 7) |

## 2. Words to avoid (from the strategy, section 6)
unlock, supercharge, revolutionise, unified, ecosystem, infrastructure, "AI-powered" as the lead adjective, "the future of", seamless, exclamation marks, three abstract nouns in a row. Prefer a verb and an object ("Upload your CV", "See what we found").

## 3. The copy

### 3.1 Hero (choose one; the owner decides)

| | Headline | Sub-line | Note |
|---|---|---|---|
| **H-A** (the owner's earlier slogan, branch `feat/landing-hero-left`) | Your career is always evolving. Your tools should evolve with it. | A set of practice tools for your CV, your interviews and your salary talk, in one place. | Verified: the slogan exists in that branch. It is broad; the sub-line carries the specifics |
| **H-B** (from the pasted text) | Your next chapter starts with knowing where you stand. | See what a reader finds in your CV, practise the interview, and know what to work on next. | "Knowing where you stand" must not promise a score or a rating (ADR-013 removed the aggregate Trust Score and the readiness number). The sub-line avoids both |
| **H-C** (from the strategy of 2026-10-10) | Check your CV in seconds. See what is missing, and why. | The result comes from fixed rules: the same CV gives the same result, with the evidence. AI explains and suggests fixes; it never sets the result. | Verified in ADR-011 and the landing claims audit ("rule-based ATS readiness check"). The most concrete line |

Primary button: **Check my CV** (opens the Resume Builder / ATS check). Secondary: **See how it works** (scrolls to section 3.3). Under the buttons: "Free while we build. No card needed." (Verified: the owner's decision of 2026-10-10, and the truth-pass page says "Free while we build").

Eyebrow above the headline: "AI career tools for Singapore" (replaces "verified career platform"). **Owner:** is "for Singapore" the right scope?

### 3.2 The problem (short)
> **Your career is connected. Your tools are not.**
> A CV is one part of the story. Preparing for an interview, telling your experience clearly, seeing where your skills fall short and deciding what to do next are linked, yet the tools for them are scattered. CareerAiHub is an early-stage product that puts these steps in one place, and shares your CV between them so you do not start from zero each time.

| Claim | Evidence |
|---|---|
| "shares your CV between them" | Verified in code and by the local browser test (`tests/e2e-local/flows.mjs`, group F1: the saved resume reaches the Mock Interview, JD Analyzer, Cover Letter and Salary Prep). Before 2026-10-20 a pasted resume did not reach four of them (fixed in PR #199) |
| "early-stage" | ADR-015 item 2 (proposed) |

### 3.3 What you can do (each card: what it does, what you get, a button)

| Card | Text | Button | Evidence |
|---|---|---|---|
| **Check your CV** | A rule-based check of how a reader sees your CV: sections found, numbers in your bullets, consistent dates. You see the text we read, so mistakes are visible. | Check my CV | Verified: landing claims audit ("ATS Readiness check ... rule-based"); the Dashboard tile "Rule-based check". The wording about sections, numbers and dates is the Dashboard's own top action text |
| **Improve it with AI** | AI points out weak lines and suggests rewrites. You accept or reject each one. It never changes the result of the check. | Open the Resume Builder | Verified: ADR-011; strategy section 3. The wording "accept or reject" is **PROPOSED**: check it against the Resume Builder before approving |
| **Practise the interview** | A mock interview of five questions written for the role you enter, with feedback on every answer. Keep your best answers as STAR stories. | Start a practice interview | Verified: the screen text "A 5-question mock interview written for you, with honest feedback on every answer"; STAR Bank in the sidebar |
| **Prepare a salary talk** | Enter the offer you have and the number you want. Practise the conversation with an AI coach and get a script. No market figures are claimed. | Open Salary Prep | Verified: landing text "Prepare for a negotiation using the numbers you enter ... Market salary benchmarks from verified sources are being prepared and are not available" |
| **See your skills gap** | Compare your skills with a role you choose. | Open Skills Gap | Sidebar badge "New". **Owner:** the exact behaviour is not re-checked in this draft; check before approving |

Not offered as cards: voice practice (limited to one account, privacy text under legal review), TrustMatch (badge "Planned"), Verify Creds (badge "In dev"), Career Roadmap (badge "New"; check before adding). If the owner wants a "what we are building" strip, it lists these under a heading that says they are not available yet.

### 3.4 How it works (three steps, with real screenshots)
1. **Check.** Add your CV and see what the reader finds.
2. **Understand.** See the evidence behind each point, not a verdict.
3. **Improve.** Fix with help from AI, then practise the interview.

Screenshots: real captures of the CV result and the interview feedback, taken from a test account with a synthetic CV (never a real person's CV). **Owner approves each screenshot.**

### 3.5 Our approach (from the pasted text, tightened)
> **AI should help you move forward. It should not make the decision for you.**
> - **The result comes from rules, and AI explains it.** The same CV gives the same result. AI writes the explanation and the suggestions. (ADR-011)
> - **Evidence over assumptions.** You can see what we read from your CV and why a point was raised.
> - **Proof over claims.** We have no ratings, user counts or partner logos on this page because we do not have evidence for them yet.
>
> Career outcomes depend on many things. Feedback here supports your preparation. It does not predict or guarantee a result.

| Claim | Evidence |
|---|---|
| "same CV, same result" | Verified: the strategy's section 3 and the deterministic scorer (ADR-011). **Not verified for every tool**: it applies to the CV check, not to AI feedback in the interview. The text must say "the CV check" if kept as written |
| "you can see what we read" | Strategy section 3: "shows what the reader found, including the text we read" (Built) |

### 3.6 Early stage (replaces "Built in the open")
> **An early product, built step by step.**
> CareerAiHub is at an early stage. We are building the tools, learning from people who try them, and fixing what does not work. We do not promise shortcuts or guaranteed outcomes.
> [Read our story]  (shown only when the Our Story page exists)

### 3.7 Join (two short paths)
- **Try it.** "Use the tools and tell us what is useful and what is not." Button: Check my CV. Feedback route: **Owner** decides (an email address is the only verified contact: `hello.careeraihub@gmail.com`, commit 9906830).
- **Work with us.** "Interested in a pilot or in sharing expertise? Write to us." Button: Write to us (mailto). A Partnership page is added only when the owner can handle the requests.

### 3.8 Footer
CareerAiHub. Privacy · Terms · Contact. "AI feedback supports preparation. It does not guarantee employment or hiring outcomes."
**Owner:** the legal entity name for "© ...". UNKNOWN; not guessed.

## 4. Our Story page (outline only; the owner writes it)

Outline from the pasted text, kept because it is a good shape: the question that started the project; why a connected approach; who is building it; what the owner believes; what comes next; a button to try the tools and a way to get in touch.
Not written here: the founder's name, qualifications and history. **Owner:** write them in your own words; each sentence must be true and approved by you. Avoid "expert", "serial entrepreneur", "industry-leading".

## 5. Buttons and where they lead (checked against code on 2026-10-21)

| Button | Leads to | Status |
|---|---|---|
| Check my CV | Resume Builder (`ats`) | Live (sidebar badge "Live"); for a guest it asks to sign in or use the free check: **Owner** confirms the guest path |
| Open the Resume Builder / Salary Prep / Skills Gap | `ats`, `salary`, `skillsgap` | Live or "New" in the sidebar |
| Start a practice interview | Interview Coach, Live Session | Live. Today some buttons land on the Overview instead (audit finding F-8, not yet fixed) |
| See how it works | Scroll anchor | Built with the page |
| Read our story / Write to us | Our Story page / `mailto:` | Story page does not exist yet; the mailto address is verified |

## 6. What this deck does not settle (Owner)
1. Which hero (H-A, H-B or H-C).
2. The scope word in the eyebrow ("for Singapore").
3. Founder text, legal entity, advisors (none published without written confirmation).
4. Whether to show a "what we are building" strip with TrustMatch and Verify Creds under a clear "not available yet" heading (ADR-013 item 6 forbids calling them verified).
5. The Terms text does not mention payment. The owner decided on 2026-10-10 that the product is free and nothing is charged; the legal wording is the owner's (and counsel's) to write.
6. Web analytics: build it or not, and what the Privacy text says (ADR-015 item 7).

## 7. Not run
No design, screenshot or code was produced from this deck. No claim above was tested with real users. The owner's review is the gate; after approval comes a small build with the claims test already in place.
