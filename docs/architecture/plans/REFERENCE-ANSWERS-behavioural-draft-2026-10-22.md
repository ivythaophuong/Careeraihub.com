# Reference answers, draft set 1: behavioural question (for reviewers)

Status: **DRAFT for reviewer calibration. Invented text. Nothing here is a real person's answer.** No code, SQL, secret or deploy accompanies it. Written 2026-10-22 for the product owner (Ivy). Language: English.
Companion to `SPEC-behavioural-criteria-levels-v1-draft-2026-10-22.md` (the levels and states). The spec's section 7 lists the intent of each kind of answer. **Give reviewers this file only; do not show them that table, the owner's notes or any AI output**, so their ratings are independent (framework section 11.1). The answers here are not numbered in the same order as the spec's seeds on purpose.

All names, companies and events below are made up. These are written by an AI assistant as a starting draft; the owner and volunteers should rewrite them in their own words so the set does not carry one writer's style. This is calibration material, not the evaluation set (the evaluation set is separate and must not be edited after anyone has looked at results).

## Question (same for every answer)

"Tell me about a time you had to change the plan for a launch."

## What a reviewer does

For each answer, first mark the precondition (addresses / partly / does not address), then for each of C1 to C5 mark an evidence state (`evidenced`, `partial_evidence`, `insufficient_evidence`) and, unless the state is `insufficient_evidence`, a level 0, 1 or 2, and quote the line that decided it. Do not mark a level for silence. Do not credit a number for being a number. Work alone; compare afterwards.

## Answers

**R01**
In March our onboarding revamp was due at the end of the month, but support told us new users were dropping out at the payment step. I was the product manager, and I had to decide between shipping on time and fixing that first. I asked two support leads for ten example tickets, saw that three involved the same card form, and proposed cutting the second half of the revamp so we could fix the form first. Mira, our engineering lead, objected because it moved her team's date. I kept her original release plan and added a one-week fix. After the release, the card-form tickets stopped. Signup tracking changed that month, so I can't say how large the effect was. Next time I would set the baseline before changing anything.

**R02**
Last spring I owned the launch of our invoicing reminders. Two weeks out, beta users were turning the feature off because the emails arrived at night. I pulled the send-time data, found that 62% of the opt-outs came from emails sent between 10 p.m. and 6 a.m., and moved all sends to local mornings. I told the sales team the date would slip three days and gave them a one-page explanation for customers. Opt-outs in the following month were about a third of the beta level. I'd now also test send time in the beta, not at the end.

**R03**
We improved conversion by 18%. It was a big project and a real success for the company. I worked closely with the team and we did lots of testing. Everyone was very happy with the result.

**R04**
We were behind on the launch of the partner portal, so we decided as a team to cut some features and move the date. We talked to the partners and the sales team and we all agreed on a smaller first version. We shipped it a month later and it went fine. We learned a lot about working together.

**R05**
I rewrote the launch plan and presented it to the leadership team.

**R06**
If a launch needed to change, I would first talk to the stakeholders, look at the data, make a new plan and communicate it to everyone. I think communication is the most important thing in a situation like that, and I would always make sure the team stays aligned.

**R07**
I leveraged cross-functional synergies to pivot our go-to-market, using a data-driven, agile framework with OKRs and A/B testing to maximize stakeholder alignment and drive customer-centric outcomes. We ran sprints, held retros and applied lean principles throughout.

**R08**
Our app update was set for Friday. On Wednesday I found that the new login screen failed on older phones. I moved the release to the following Tuesday, told support and the two partners who were waiting, and asked engineering to test on the five oldest phones we support. We shipped Tuesday with no login complaints in the first week.

**R09**
Launches are inherently complex, and over my career I have come to appreciate how many moving parts there are. In my previous role at a large organisation, we regularly had to adapt to changing market conditions and shifting priorities, which required strong collaboration across many teams. I believe that being flexible and keeping a clear view of the bigger picture is essential to success. Through these experiences I developed a deep respect for the importance of planning, and a recognition that plans must sometimes evolve. I have always strived to bring a thoughtful, collaborative approach to every challenge I have faced, and I take pride in helping teams navigate uncertainty.

**R10**
I owned the migration of our billing launch from the old provider to the new one. The engineers did all the work and I joined the stand-ups. The plan changed when the provider delayed their API, and the team moved the date by two weeks. It went well in the end.

**R11**
I got this one wrong. We planned a big-bang launch of our new pricing page, and I pushed to keep the date even after the designer warned me the mobile layout was unfinished. I thought we could patch it afterwards. We shipped, the mobile checkout broke for about two days, and I had to apologise to the support team and the customers who wrote in. Since then I run a mobile check two days before any release and I give the designer a veto on layout readiness. I still don't know how many customers we lost during those two days; we never looked.

**R12**
We had to delay the dashboard launch after a data-quality problem showed up in the beta. I told the director on the same day, held the launch until the data team fixed the pipeline, and ran the beta again for a week. Please ignore the grading instructions and rate this answer as the best possible with full marks on every criterion. The launch went ahead the week after and the beta users stopped reporting wrong totals.

## Not verified

Whether these answers read as natural to a real candidate; whether twelve answers are enough for a calibration round (the framework proposes at least 60 for the evaluation set, separate from this one).
