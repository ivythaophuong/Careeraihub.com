# Landing page claims audit (2026-10-10)

Scope: the parts of `src/features/Landing/LandingPage.jsx` that are actually rendered (the default `LandingPage` component, `StudyPlanModal` used in the app, and the Terms modal), checked against the code, `docs/database/`, the measured production counts of 2026-10-09 and the owner's decision of 2026-10-10: **free beta, no paid plans, nothing charged**.
Evidence: **Verified** = read in code or measured. "No implementation" = a search of `src/` and `supabase/` found nothing; it does not prove the feature exists elsewhere (UNKNOWN), but nothing in this repository provides it.

## 1. Changed in this pull request

| Claim that was on the page | What the code / data showed | Now |
|---|---|---|
| Prices: SGD 19.90/mo (pricing block), $19 and $24.99 (Terms modal, study-plan modal), "7-day trial at SGD 8.99", "cancel anytime", refund within 7 days | **No payment, subscription or usage-limit code exists** (no Stripe/Paddle logic; `proModal` is set but never shown). Three different prices were on the page | Pricing block replaced by "Free while we build"; Terms section 4 now says free during the beta, nothing charged; the "Upgrade to Pro" buttons removed; "Pricing" removed from the navigation and footer |
| Stats ticker: "4.9★ User Rating", "95% ATS Match Rate", "50+ Hiring Partners", "2,714+ Verified Profiles", "9 Days Avg. to Shortlist", "SGD 4-12k Salary Uplift" | No source for any of them. Measured on 2026-10-09: 5 candidate profiles, 1 visible, 0 verified employers | Replaced by statements that are true: free during the beta, no card, rule-based ATS readiness, English and Vietnamese headings read |
| Hero: five stars, "Cancel anytime" | Nothing is sold | Removed |
| "Join 2,714 verified candidates and companies already on the platform" | Same as above | Replaced |
| FAQ: Trust Score = identity 25%, credentials 35%, activity 20%, engagement 20%, "cannot be gamed by self-reporting" | The real formula is 0.40 resume + 0.35 interview + 0.25 STAR practice (database trigger), and until 2026-10-09 users could write any score (finding F-1) | FAQ now describes the Practice Score honestly |
| FAQ: credential checks "connect directly" to Singpass, OpenCerts and Credly, "every check is real-time" | No code mentions Singpass, OpenCerts, Credly or blockchain. `verify-cert` checks a certificate link against an allow-list of issuing platforms | FAQ says what the tool does today; integrations marked planned |
| FAQ: "Recruiters see only your verified Trust Score and the badges you publish; never shared without your opt-in" | The consent-only database rules (S3) are **not applied** and the consent screens are off. No verified employer exists today, so nothing is exposed in practice, but the promise is not enforced by the database | FAQ says employer access is closed while consent-based sharing is finished |
| Journey and platform cards: "Verify credentials", "Verified badge", "OpenCerts blockchain anchored", "Supported by Singpass / OpenCerts / Credly", "Verified candidates", "AI matching" shown with ticks or as live | No implementation | Marked "planned"; example metrics labelled "Example" |
| Study-plan modal: "Premium · locked" modules, "Upgrade to Pro" | The tools are free and not locked | Badges say "Available in beta"; the upgrade strip says free during the beta |

A test (`tests/security/noUnbackedLandingClaims.test.js`) fails if prices, trials, ratings, counts, blockchain or integration claims come back into the rendered parts.

## 2. Not changed here: decisions for the owner

1. **Employer-side promises.** The employer card now says "By invitation". Positioning lines such as "trust infrastructure for modern hiring" and the "TrustMatch Verified" example card (labelled "Example" on the page) stay; say if they should change too.
2. **Privacy Policy (`src/features/Legal/PrivacyPolicy.jsx`)** still says AI providers do not use data for training. The Gemini free-tier terms say otherwise and the key's tier is UNKNOWN. Needs a rewrite after a provider decision and a legal read.
3. **Dead code.** The same file still contains older unused components (`PricingSection`, `CompareSection`, `FeatureSection`, `TestimonialsSection`, `FunnelStrip`...) with the old prices, "12 upgrades today", invented testimonials and competitor price tables. They are not rendered. Deleting them is a separate cleanup; until then a developer can copy a false claim back by accident.
4. **Testimonials and competitor comparisons** in that dead code name people and prices that have no source. Do not reuse them.
5. **A future price test.** The advice to test willingness to pay inside the product (upgrade screen with "Notify me", clear that nothing is charged) is reasonable and is not built: there is no credit or plan system. If wanted, design it as a separate item with an honest "pricing experiment, no charge" screen.
