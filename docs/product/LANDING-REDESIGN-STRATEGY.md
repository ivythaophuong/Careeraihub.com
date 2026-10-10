# Landing page: strategy for a professional page that does not look AI-generated

Status: **proposal for the owner's review, 2026-10-10. Nothing in sections 3 to 7 is built.**
Evidence: screenshots of the live page taken with a real Chrome on 2026-10-10 (1440 px wide) and the source of `src/features/Landing/LandingPage.jsx` (about 4,200 lines). Labels: **Verified**, **Opinion**, **UNKNOWN**.

## 1. What makes the page read as machine-made (Verified on the screenshots, with the cause)

| # | Sign | Where | Why it hurts |
|---|---|---|---|
| 1 | A gradient headline in pink to purple to orange ("To Get Hired.", "proof,", "answered.") and a neon pink button on near-black | hero, closing section, FAQ | The default look of generated pages; it says "template" before the words are read |
| 2 | Headlines that sound big and say nothing: "Your career intelligence compounds over time", "Four layers. One unified identity.", "The future of hiring is proof, not keywords." | sections 2, 3 and the closing block | No reader can say what the product does after reading them |
| 3 | A grammar slip in the main headline: "From Invisible To Get Hired." | hero | A visible error on the first line |
| 4 | A fake product dashboard with perfect numbers (Trust Score 87, 95% / 92% / 88% match, "Top 8%"), real company names and logos (Grab, Shopify, Gojek) and a message from a named recruiter | hero card (labelled "Example" in tiny type) | Not the product; looks invented because it is; uses third-party brands |
| 5 | Stock faces for invented people | hero card | Reads as generated |
| 6 | Cards of four ticked bullets each, and a ticker of small stat pills | sections 3, top bar | A pattern repeated by every template |
| 7 | Contradictions on one screen: ticks next to "(planned)" and "Planned: not live" | sections 2 and 3 | After the 2026-10-10 honesty fixes the page now admits half the features are not built, but the hero still sells them |
| 8 | Broken details in the demo cards: "Excellent" overflowing its ring, "Feedback" and "Great structure!" colliding, large empty panels | section 3 | Looks unfinished |
| 9 | **The real product is never shown.** No screenshot of the CV check, the score or the fixes | whole page | The strongest proof the product has is missing |
| 10 | Positioning that does not match what works: the hero promises "verified profile" and "get discovered by recruiters"; what works today is a CV check, an ATS Readiness result, AI help with fixes, and interview and STAR practice | hero | Visitors arrive expecting one thing and meet another |
| 11 | "Singapore's verified career platform" pill | hero | No verification exists; Verified claim on the first screen |
| 12 | A 4,200-line file with many unused older sections | code | Old copy (prices, testimonials, counters) can return by accident; hard to keep consistent |

## 2. The principle (Opinion)

**Show the real product, say what it does in plain words, and let evidence replace adjectives.** A page looks human-made when it is specific, restrained and slightly opinionated, and when every claim can be checked. The honest product here is stronger than the fake dashboard: it explains its own score.

## 3. Positioning to write the page around

One promise that is true today: **"Check your CV in seconds. See what is missing, and why."**
Supporting facts that are true and checkable (each one needs its screenshot or a test):
- The ATS Readiness result is computed by fixed rules: same CV, same score, with the evidence for each part. (Built.)
- It shows what the reader found, including "the text we read", so mistakes are visible. (Built.)
- English and Vietnamese section headings are read. (Built; the reader quality gate decides how strongly this can be stated.)
- AI explains problems and suggests rewrites, and never changes the score. (Built.)
- Practice for STAR stories and interviews. (Built.)
- Employer sharing, credential checks: **not on this page until they exist**, or in a clearly separate "What we are building" section with dates the team will keep.

## 4. Page structure (five sections instead of eleven)

1. **Hero:** the promise, one sentence below it, and the product itself as the main object: either the CV check right in the page (drop a CV, see a result; see the "check first" design) or one real screenshot of a result. One primary button.
2. **How it works, in three steps with real screenshots:** Check, Understand (the evidence), Improve (AI fixes you accept or reject).
3. **How we score (the differentiator):** a short, honest explanation of the rules-based score, what it measures and what it does not (the sentence already written for the info button), with a link to a full "How scoring works" page. Few products dare to show this.
4. **Who it is for / built for Southeast Asia:** specifics (English and Vietnamese CVs, local formats). No invented numbers.
5. **Questions and a final button.** Short FAQ (data, cost, what AI is used for). A real contact address.

Optional and only when real: a short founder note ("why we built this", written by the owner, signed), a "what changed this month" list (the repository history makes this easy), and quotes from named users who agreed.

## 5. Visual system (Opinion)

| Aspect | Today | Direction |
|---|---|---|
| Colour | Near-black, neon pink, purple, orange | One restrained accent on a calm base; light theme by default for a CV tool (it is a document product); dark as an option |
| Type | Inter plus a monospace for small labels, gradient headline | One family, two weights, a clear scale; no gradient text; sentence-case headlines |
| Imagery | Stock faces, invented dashboard | Real product screenshots in a consistent frame; no faces, no third-party logos |
| Motion | Scroll reveals, ticker, counters | Almost none; a short fade at most; respect "reduce motion" |
| Density | Four-bullet cards, pills, badges | Fewer elements, more space, one idea per section |
| Icons | Mixed emoji and line icons | One simple line set, used sparingly |
| Language | English only | English and Vietnamese versions of the page (the audience is Southeast Asia) |

## 6. Copy rules (the tell-tale words)

Avoid: unlock, supercharge, revolutionise, unified, ecosystem, infrastructure, "AI-powered" as a lead adjective, "the future of", triplets of abstract nouns, exclamation marks, "seamless". Prefer: a verb and an object ("Upload your CV", "See what we found"), numbers only when measured, the user's words ("CV", "interview"). Every sentence passes a test: *could a competitor say it too?* If yes, rewrite it with something only this product does.

## 7. Work plan

| Phase | Content | Output | Gate |
|---|---|---|---|
| L0 | Truth pass | Done: prices, invented stats, integration and "free forever" claims removed; a test keeps them out | Merged |
| L1 | Quick fixes that need no redesign | Fix the hero headline grammar; remove the "verified career platform" pill; fix the demo-card layout defects; replace the hero dashboard with a real screenshot of the ATS Readiness result | Owner reviews screenshots |
| L2 | Copy and structure | A copy deck for the five sections in English, then Vietnamese; wireframes | Owner approves the wording (and a person with legal or brand judgement for claims) |
| L3 | Visual system | Tokens (colour, type, spacing), components, light theme; accessibility check (contrast, keyboard, reduced motion) | Contrast and keyboard tests |
| L4 | Build | New small page replacing the old file; delete the unused sections; mobile first (the mobile page is 6,549 px tall today) | Visual checks on desktop and mobile; page weight and Lighthouse numbers recorded |
| L5 | Learn | Five real visitors from the target group do a task ("find out what this does and check a CV") while the owner watches; adjust. Events as in `PRICING-AND-CREDITS-STRATEGY.md` | Findings written down |

L1 can start now and does not depend on the other phases. L3 and L4 should wait for L2: the wording decides the layout, not the other way round.

## 8. Decisions needed from the owner
1. Is the promise "Check your CV in seconds. See what is missing, and why." the one to lead with?
2. Should the first page show the CV check itself (the "check first" design) or a screenshot?
3. Light theme by default for the page? (Opinion: yes.)
4. Vietnamese version of the page: at launch or right after?
5. Who writes or approves the founder note, and are there real users who agreed to be quoted?
6. Which of the unbuilt features (employer sharing, credential checks) may be mentioned at all, and under what heading?
