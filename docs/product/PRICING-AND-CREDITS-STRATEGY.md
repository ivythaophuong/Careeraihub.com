# Pricing and credits: where they appear and how a preview checkout stays honest

Status: **proposal for the owner's review, 2026-10-10. Nothing in sections 3 to 7 is built.** What is done: the landing page no longer shows any price, and its claims are corrected (`LANDING-CLAIMS-AUDIT.md`).
Evidence labels: **Verified** (read in code or measured), **Opinion** (the assistant's judgement), **UNKNOWN** (not checked, or no data in the repository).

## 0. Decisions confirmed by the owner (2026-10-10, later)

1. Prices in **USD**. **Weekly plans are included** alongside monthly ones.
2. **Credits really work**: a user can claim the voucher and spend it on real AI actions. A voucher that does nothing is not allowed.
3. The goal of credits and plans is **stickiness and learning**: do people find the product useful enough to come back and keep using it? Revenue is not the goal of this phase.
4. **No payment system now.** No card form, no charging.
5. The landing page shows no prices; "Free forever" wording is removed (credits and plans are planned).

What this changes in this document: section 9 questions 1, 2 and 4 are answered. Credit amounts, tier contents and voucher size and expiry stay open until step C1 has measured the real cost of each AI action.

## 1. The owner's decision (2026-10-10)

- Keep the price points in the product: Lite and Pro, weekly and monthly (the owner's figures: 2.99 and 5.99 per week, 11 and 19 per month; the pairing Lite = 2.99 / 11 and Pro = 5.99 / 19 and the currency are assumptions to confirm).
- No pricing on the main landing page. Prices appear inside the product, after the user has experienced it.
- While payments are not open, choosing a plan shows a message that the user has received a free credit voucher.

## 2. The condition that makes this honest (Opinion, and the part to get right)

A "voucher" is a promise. It is honest only if **it does something**: credits must exist, show a balance and be spent by real actions. Today **no credit, plan or usage-limit system exists** (Verified: nothing in `src/` or `supabase/`; `proModal` is set but never shown). So the voucher cannot be shown until a minimal credit system is built. That system is also what the product needs anyway: AI actions cost money and the free AI tiers ran out during testing (Gemini and Groq answered 429 on 2026-10-09).

Rules for the preview screen (all are about not misleading people):
1. Before the click, the plans screen says: **"Payments are not open yet. Nothing will be charged."** Not after.
2. There is **no card form**, no field that looks like one, and no "Subscribe" wording that suggests a purchase.
3. After the click: "No payment was taken. Thank you for telling us which plan you would choose. We added N credits to your account. They expire on DATE and have no cash value."
4. The prices shown are described as planned and subject to change.
5. The voucher is granted once per account (recorded in a ledger, so reloading or clicking again does not add more).

## 3. Where pricing appears (the strategy)

| Moment | What the user sees | Why |
|---|---|---|
| Landing page, sign-up, onboarding | **No price.** One promise: start free | A price before value is an anchor with nothing behind it |
| First result (ATS Readiness shown at once) | Nothing about money. The rule-based checks are free | This is the product's best moment; keep it clean |
| First AI action (for example "Find issues & enhance") | A small **credits chip** in the header (balance) and one line: "AI actions use credits. Rule-based checks are free" | The user learns how value and cost relate, right when they use AI |
| After a high-value step (fixes applied, PDF downloaded) | A quiet card in the Next steps list: "Get more credits" | Intent is highest after something worked |
| Balance at or below a threshold | An inline card, not a blocking pop-up: "You have N credits left" with Plans | Gives time to decide |
| Balance zero, user asks for an AI action | A plain screen: AI actions need credits; rule-based checks stay free; Plans | The paywall only touches the part that costs money |
| Account menu | **Plans and credits** page: balance, history, plans | Always findable, never pushed |

Principle: **free = rules, paid = AI cost.** It matches the Deterministic First direction (deterministic features cost almost nothing to run) and keeps the free product useful and honest.

## 4. The plans screen (preview)

- Header banner: "Preview. Payments are not open yet. Nothing will be charged."
- Cards: Free (starter credits; all rule-based tools), Lite, Pro, with a weekly / monthly switch and the price per period shown plainly. What each paid tier includes (credits per period, any features) is **UNKNOWN until the owner decides**.
- Button label: "Choose Lite" opens the confirmation in section 2 (no payment form).
- A second, separate, **optional** question, not tied to the voucher: "Would you pay this price?" (yes / maybe / no) and "what would you change?".

## 5. Measurement caveat (Opinion)

If a click on a plan gives free credits, almost everyone will click: the click then says little about willingness to pay. Treat it as a **weak signal of preference** only. Better signals, in order: credits spent and return visits after the voucher (use), the answer to "would you pay this price?" asked without a reward, how often users run out of credits and come back to Plans. Record the plan, period, price shown and time of each choice (table `plan_interest`) so results can be read later; do not describe them as demand.

## 6. The credit system (Opinion; to be reviewed for security before build)

- **Ledger, not a counter.** Tables `credit_ledger` (user, signed amount, reason, reference, time) and a balance computed from it. Only the server writes (the browser has no write privilege, the same pattern as the S4 score tables). Reasons: `voucher_preview`, `ai_action`, later `purchase`, `refund`.
- **Spend atomically** in one database function that checks the balance and inserts the ledger row, with a unique reference per action so a retry or a double click never charges twice. Spend after the AI call succeeds; a failed call costs nothing.
- **Where credits are spent:** the Edge Functions that call a model (`ai`, `score-star`, `score-interview`). Rule-based scoring costs 0.
- **Credit prices need measured costs.** The `ai` function can log tokens used per call (counts only, no content) so the cost of each action (scan, fix, rewrite, interview answer) is known. Starter credits, voucher size and plan credit amounts should be set from that data, not guessed. Provider prices were not checked on 2026-10-10 (UNKNOWN).
- **Abuse:** one voucher per account; email-verified accounts only; daily caps on AI actions; watch for many accounts from one source. Exact limits are a decision.
- Free credits cost real money. The maximum exposure is (users x starter credits x cost per credit); set a global budget alarm.

## 7. Legal and trust points (UNKNOWN: needs a person with the right expertise)

Terms must state: no payment is taken now, planned prices may change, voucher terms (expiry, no cash value, once per account), and what happens to credits if plans change. The Privacy Policy must mention the stored plan choices. Consumer rules on vouchers, price display, currency and tax in Singapore and Vietnam were not researched.

## 8. Build order (each step shippable)

| Step | Work | Needs SQL run by the owner |
|---|---|---|
| C1 | Log tokens used per AI call (counts only); read the real cost per action over a week of use | no |
| C2 | Credit tables, spend function, ledger; balance endpoint; replica test and a security review | yes |
| C3 | Debit credits in `ai`, `score-star`, `score-interview` behind a flag; balance chip; low and zero states | no |
| C4 | Plans screen with the preview confirmation, voucher grant (once per account), `plan_interest`; Terms and Privacy text | yes |
| C5 | Funnel events (plans viewed, plan chosen, voucher used, credits spent, credits exhausted, return on day 7) | no |
| C6 | Real payments, refunds, tax, receipts | separate project |

## 9. Decisions needed from the owner
1. Currency (USD, SGD or local) and whether prices are shown in one currency.
2. Weekly plans as well as monthly? (A weekly price for a job search is a bet; the weekly figures are untested here, UNKNOWN.)
3. What each tier contains (credits per period, features), and the starter credits and voucher size and expiry.
4. Agree to the honesty rules in section 2, including "Payments are not open yet" before the click?
5. Agree that the plan click is a weak signal and that a separate, unrewarded "would you pay" question is asked?
6. Who reviews the Terms and Privacy wording?
