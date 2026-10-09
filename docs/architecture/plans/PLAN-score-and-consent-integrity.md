# Plan: score integrity (F-1), match fields (F-2), stale scores (F-5), consent-only recruiter access (F-4)

Status: **plan for owner review. Nothing in it has been implemented, tested or applied.** Product decisions of 2026-10-09 are recorded in §6; the owner
approved pushing this plan for review, not implementing it.
Evidence: [EVIDENCE_RESULTS_2026-10-09.md](../EVIDENCE_RESULTS_2026-10-09.md) (live catalog, 2026-10-09). Rules these fixes enforce are the
owner's own frozen contracts, `docs/contracts/README.md` v1.1 (on branch `feature/phase1-foundation`, commit `5c377ae`; its docs are proposed for `main`
in a separate PR): *scores are written by the server only; matches: the candidate may change status only; consent-first, default PRIVATE;
an employer never sees more than the candidate consented to.*

Evidence classes used in this plan: **CONFIRMED IN PRODUCTION** (live catalog), **CONFIRMED IN REPOSITORY** (code on `main`), **INFERRED RISK** (follows from those, not
tested), **UNKNOWN**. The per-finding split is in the results file. A rule found in the catalog is not proof of an exploit; S0 exists to turn each inferred risk into a
test.

Owner decisions on record (2026-10-09): F-1 plan the fix. F-4 recruiters read a candidate only with the candidate's consent.

## 0. Ground rules for every step below

1. No SQL runs on production until the owner approves that step. Each step is written as a script in `docs/database/proposed/`, tested on the
   in-memory replica (`docs/database/replica-test/`, PGlite) and, if the owner agrees, on a Supabase staging project or branch, then applied by hand,
   recorded in `docs/database/README.md`, with a down script.
2. Each policy change comes with the actor × table matrix the contracts require: candidate A, candidate B, unverified employer, verified employer
   without consent, with consent, expired consent, revoked consent, anonymous, service role.
3. Existing data is never deleted by a fix. Where meaning changes, old values keep a label.
4. Website and function ordering follows `CLAUDE.md`: deploy the site before a function whose contract the site must follow; a column privilege
   is revoked only after the site no longer writes it.
5. Each step is its own small PR with acceptance criteria and a rollback.

## 1. Order and dependencies

| Step | Finding | What | Touches | Depends on |
|---|---|---|---|---|
| S0 | F-1, F-2, F-4, F-5 | Reproduce each issue as a failing test on the replica (tests only) | `docs/database/replica-test/` | none |
| S1 | F-5 | Recompute derived scores on DELETE | 1 SQL script | S0 |
| S2 | F-2 | Restrict which fields a candidate and a recruiter can change on `trust_matches` | 1 SQL script | S0 |
| S3 | F-4 | Consent-only recruiter access (policies, a consented-parts view) | SQL + later app work | S0, owner answers in §5 |
| S4 | F-1 | Server-side scoring writer; browser loses write access to score columns | Edge Function(s), app, SQL | S0, S1, owner answers in §4 |
| S5 | F-1, F-5 | Score semantics (`null` not 0, latest not MAX, `practice_score` rename) | contract-driven migration | S4 |

| S0b | all | Baseline the real schema: a read-only dump/pull of production into the repo, before any move to `supabase migrations` | owner runs a read-only export | none |
| CI | all | GitHub Actions running `npm test` and `npm run build` on every PR, required before merge | `.github/workflows/` | none; separate from S0 |
| S6 | F-3 | Credential status moves to the `evidence` model; the browser can claim, not verify | app + (later) a verifier service | S0, owner confirms the D3 mapping |
| S7 | F-6 | `jd_analyses` writer and table agree | app (or one SQL column add) | S0 |

Each finding is its own PR with its own acceptance criteria; none is bundled with another.

S1, S2 and S3 are independent of each other. S4 is the largest and is not a prerequisite for S1–S3. S0 is safe to start first because it only adds tests.

## 2. S0: reproduce before fixing (tests only)

**Status 2026-10-09: written and run, branch `test/s0-reproduce-integrity-findings`.** On the in-memory database, 7 issue scenarios (F-1, F-1b, F-5, F-4a, F-4c, F-4d, F-2)
are all OPEN and 9 controls pass; `--desired` exits 1 until fixed. The F-12 observation reproduces the 60-point ceiling. F-6 is covered by a static test of the
relational writers against the production column list (`tests/contracts/relationalWriters.test.js`; JDAnalyzer is the one mismatch, marked as an expected failure).
Limits: the replica is built from the earlier audited schema plus the recorded scripts, not from the live catalog; only the objects named in the script header were compared
with the live output. Reproducing on the replica shows the rules allow it; it does not show it happened in production.

Build the replica from the audited schema plus the 2026-10-05 and Phase 1 scripts (the Phase 1 `test.mjs` already does this), then add scenarios that
**currently pass as attacks** and must flip after each fix:

| Scenario | Today (expected on replica) | After |
|---|---|---|
| Candidate inserts `resume_scans(credibility_score=100)`, `mock_sessions(avg_score=100)`, `star_stories(score=100)` | `candidate_trust_profiles.trust_score = 100` | rejected, or ignored by the score (S4) |
| Candidate deletes all three kinds of rows | old `trust_score` remains | recomputed (S1) |
| Candidate sets `match_score=100`, `recruiter_action='shortlisted'` on own match | succeeds | rejected (S2) |
| Verified recruiter of employer X selects `candidate_trust_profiles` | returns every `is_visible` row | returns only consented rows and parts (S3) |
| Verified recruiter inserts a match for a candidate who gave no consent | succeeds if `is_visible` | rejected (S3) |

Acceptance: the five scenarios exist, fail the "After" expectation on current schema, and the existing 71 Phase 1 scenarios still pass.
Rollback: delete the test files. No database effect.

## 3. S1 (F-5) and S2 (F-2): small database changes

**S1.** Add AFTER DELETE triggers on `resume_scans`, `mock_sessions`, `star_stories` that call a recompute for `OLD.user_id`. The recompute function is
`SECURITY DEFINER`; `trigger_recompute_trust_score()` currently uses `NEW`, so a delete variant is needed. Edge case: deleting a user cascades from
`auth.users`; the delete trigger must not fail when the profile row is going away too. Acceptance: after deleting all inputs the stored score equals
what a fresh recompute gives; account deletion still succeeds. **"Clear memory" is not defined clearly today.** The button deletes eight tables (`resume_scans`, `star_stories`, `mock_sessions`, `cover_letters`, `jd_analyses`,
`applications`, `negotiation_practice`, `insights`) and empties the keys of `user_memory`; it does not touch `candidate_trust_profiles`, `profiles` or evidence.
That is more than "AI memory" (it includes the application tracker) and less than "delete my data". Decision recorded (§6): two separate flows.
- **Clear AI memory:** removes only what is described to the user in the screen text (the list above is the current reality and must be shown or
  reduced); it never claims to delete data it does not delete. Derived scores that depended on the removed rows are recomputed by S1 (v0 rule) or
  invalidated, not left as current.
- **Delete profile / data:** a separate flow with its own data list, completion state and rules for dependants (the candidate profile, evidence, consents,
  scores). Account deletion already cascades through the foreign keys; this flow is for deleting without closing the account and needs its own design.
Acceptance: the screen text lists what is deleted and what is kept; after the action no score shown as current depends on deleted inputs.

**S2.** A `BEFORE UPDATE` trigger on `trust_matches`, same pattern as `lock_row_parties`:
- when the caller is the candidate of the row, only `candidate_action` (and `updated_at`) may change;
- when the caller is a member of the row's employer, only `recruiter_action`, `status` (within an allowed transition list) and `updated_at`;
- `match_score` is not changeable from the browser at all (no scoring engine exists; any future one is server-side);
- `lock_row_parties` stays.
Also add `with_check` to the candidate update policy. Open: the `status` vocabulary is not in the constraints read so far; take it from the contract before writing the transition list.
Acceptance: the S0 scenario for F-2 flips; legitimate candidate "interested" and recruiter "shortlist" actions still work.

## 4. S4 (F-1): make scores a server output

**Problem to solve.** The score is produced in the browser (the AI reply is graded and normalised there), then inserted by the browser. A column
restriction alone cannot make that honest. Moving the same calculation to the server is not enough either: if the server accepts a number or a
result the client sends, the number is still the client's. The server must produce the score itself from inputs it can check, using a versioned rule.

**What a server-produced practice score can and cannot claim.** The input is still the user's own answer or story, and the grade is an AI opinion
(`AI_ESTIMATE` / `PRACTICE_SCORE` in contracts v1.1). Server-side production means: the user cannot set the number, and each score records its source,
formula version and time. It does not make the grade objective, and it must not be shown as verified. The server also validates inputs (length limits,
one score per submitted session, per-user caps) so that scores cannot be produced by replaying requests.

**Options**

| Option | What | Pros | Cons |
|---|---|---|---|
| A (recommended) | Move the grading and the insert behind an Edge Function per source (interview answer/session, STAR story). The function authenticates the user, calls the provider, applies the same normalisation code, computes the aggregate in code, inserts with the service role. Then revoke INSERT/UPDATE on the score columns from `authenticated` | matches contract rule "scores server only"; fits deterministic-first (aggregation in code); one place for logging and cost | larger change; touches AI entry points; needs staging |
| B | Keep the browser path, but only rows with a server-set marker (for example `scored_by`) count toward the score; browser cannot set the marker | small | nothing counts until a server writer exists; same end state as A with extra step |
| C (containment only) | Stop recruiters from seeing `trust_score` and the three sub-scores | quick; reduces harm now | does not fix integrity; the number is still forgeable |

Recommendation: do **C inside S3** (consent-only access exposes a view without the raw practice score until S4), then **A**.

**S4 detail (option A).**
1. Inventory the three writers: `HiringManagerSim.jsx` (`mock_sessions`), `STARBuilder.jsx` (`star_stories`), and `resume_scans` (no live writer today).
2. New function(s) reuse `src/features/HiringManagerSim/interview.js` and `star.js` logic (pure, already tested) in the function's `handler.js`, as the other functions do.
3. App sends the user's answer/story, not a score. The score and the text of feedback come back from the function.
4. Revoke INSERT/UPDATE on the score columns for `authenticated` (column privileges as Phase 1 did for `evidence`); keep other columns writable. A trigger that resets score columns on browser writes is the second layer.
5. Existing rows: decided (§6). They are kept as history, labelled `legacy_browser` with their date and what is known about their origin, never overwritten by new
   formulas, and **not used for the current score or for recruiter ranking**. Where the source data is gone or insufficient, the current score is `null`
   ("not enough data"), not recomputed from guesses.
6. Cost and abuse: the function inherits `ai`'s limits; add a per-user daily cap for scored actions.
Acceptance: the S0 scenario for F-1 flips; normal interview and STAR flows still save and show a score; the deployed site works during rollout (old site + new function, new site + old function).
Rollback: re-grant the column privileges and point the app back at the browser insert (kept behind a flag for one release).

## 5. S3 (F-4): recruiters read a candidate only with the candidate's consent

**Today.** Policy "recruiters can read visible profiles": `is_visible AND is_verified_employer_member()`. The function is called without an employer, so it
means "member of any verified employer". All columns are readable, including `salary_min/max`, `bio`, `full_name`. `has_consent()` exists and is not used here.
Match and pipeline inserts check `candidate_is_visible()` instead of consent.

**Target.**
1. Remove the `is_visible`-based read policy. Recruiters get no direct SELECT on `candidate_trust_profiles`.
2. Employer-side reads go through a **view or function** that returns only the parts named in the consent `scope.parts` (profile, salary, evidence, ...), for
   the employer that holds a non-expired, non-revoked consent with the right purpose. Row policies alone cannot hide columns, so column-level exposure needs the view.
3. `trust_matches` and `pipeline_entries` insert checks replace `candidate_is_visible(candidate_id)` with `has_consent(candidate, employer, purpose, part)`.
4. `is_visible` is kept only if the owner wants a discoverability flag for the future matching engine; it no longer grants any read.

**Consequence the owner must accept.** Without consent a recruiter cannot browse candidates at all. Discovery needs a consent-creating action by the
candidate. Today the app has **no UI** for consents. The Employer Portal's candidate views would show nothing until it exists. How many verified employers
and visible profiles exist now is unknown; two counts would size the impact (see the end of this section).

**Candidate-side flow needed (separate app PR).** Proposal for the owner to confirm: the candidate grants a consent by applying to or sharing with a specific
employer/job (employer, purpose `recruiter_review`, parts chosen from a short list, expiry default 90 days, max 365 per the constraint), can see and
revoke active consents, and an expired or revoked consent ends access immediately. Consent wording and Singapore PDPA wording need legal review before
Phase 4B (contracts); until then user-facing wording says "designed with PDPA requirements in mind", not "compliant".

**Acceptance.** Direct API calls (not only the UI) cannot exceed the consent: right recruiter, right candidate, right parts, current state. Revocation or expiry stops
the next request. Matrix in §0 item 2 all pass, including: verified employer without consent reads nothing; with consent reads only consented parts;
after revocation reads nothing; unverified employer reads nothing even with a consent row; candidate B cannot read candidate A.
Rollback: the old policy text is kept in the down script and can be re-created in one transaction.

Optional impact queries (counts only, no personal data) the owner may run before approving S3:
```sql
select count(*) as verified_employers from public.employers where verified_at is not null;
select count(*) as visible_profiles from public.candidate_trust_profiles where is_visible;
select count(*) as consents_total, count(*) filter (where revoked_at is null and expires_at > now()) as consents_active from public.consents;
```

## 6. Decisions recorded (owner, 2026-10-09)

| # | Question | Decision |
|---|---|---|
| 1 | Scores written by the browser | The server computes the score and validates its inputs. New scores come only from trustworthy inputs and a versioned formula. No overwriting of old history with a new formula. A score that cannot be verified is not used as a verified score |
| 2 | Existing scores | Keep as history, separate from the current score; not used for recruiter ranking. Each keeps its source, time and meaning where known, and the limits where not |
| 3 | "Clear memory" | Two flows: Clear AI memory (stated scope only) and Delete profile/data (own scope, completion state, dependants). Scores that depended on deleted data are re-evaluated, invalidated or retained per a stated policy, never silently current |
| 4 | Recruiter access (F-4) | Only with the candidate's consent, enforced in the database/API, scoped to recruiter, candidate, parts and current state, revocable |
| 5 | Plan scope | Review only. Each finding becomes its own PR; tests that fail first; no deployment without an approved migration, compatibility, test and rollback plan |

Still open (not decided): consent entry point (apply-to-job, employer request, or both), default consent expiry and parts vocabulary, whether to use a staging
project for S2–S4 (recommended: yes), and the three count queries in §5 to size the F-4 impact.

## 6b. S6 (F-3) and S7 (F-6) in short

**S6.** The browser may record a credential claim (a row in `evidence` with `UNVERIFIED`); it cannot reach `source_checked` or `issuer_verified` (the D3 labels,
see PLATFORM_ARCHITECTURE §11 for the mapping proposal). Before building: confirm that the `evidence` write path, the recipient-binding rule and the verifier
service are real, since no verifier exists in the repo. Until then credentials shown from `user_memory` are labelled self-reported. Acceptance: a user can add a
credential and cannot raise it above `evidence_provided` by any request; legacy `verified` entries display as self-reported.

**S7.** Reproduce the failure with the live column list first. Then decide: add the two columns to `jd_analyses` (a migration) or change the writer to the existing
columns (`keywords`, `gaps`, `advice`). Acceptance: the save succeeds against a schema equal to production; on failure the user sees an error and not a false
success. Do not conclude that the whole save is broken before the failure is observed.

## 6c. Corrections after the technical review (2026-10-09)

| Topic | Rule |
|---|---|
| New accounts and missing inputs | The score is `null` ("not enough data") until a minimum amount of evidence exists (the minimum is an owner decision). **No default or onboarding scan, no invented score.** If the owner later allows a composite from fewer than three sources, it shows how many sources it used |
| Re-weighting | Not adopted. Re-weighting lets one perfect input produce a perfect score. Any change of formula is a new version (contracts v1.1), never an edit of the old one |
| Authorization data | Never `user_metadata` and never `profiles` (both are user-writable; F-7). Use `employer_members`, `employers.verified_at`, or `app_metadata` set by the server |
| Rate limiting | The limit for scored actions cannot live in a function instance's memory (the `ai` limiter is per instance). Use a counter in the database or an external store |
| Delete trigger (S1) | Guard against the cascade from `auth.users`: recompute writes to a table with a foreign key to the user. Use `pg_trigger_depth()` or an existence check, and **prove it on the replica**, including account deletion |
| `SECURITY DEFINER` (S3, S4) | `search_path = public, pg_temp`; explicit `auth.uid()` checks inside; wrap helper calls in policies as `(select f(...))` so they are not evaluated per row; return only consented parts |
| Revoking default privileges (F-9) | Low risk for the SDK (it uses SELECT/INSERT/UPDATE/DELETE) but not declared risk-free: test on staging first |
| Migration tooling | Move to `supabase migrations` only after S0b has captured the real schema; applying to production stays an owner-approved step |
| Pricing, limits, error codes quoted in the review | Not verified here (function pricing tiers, the exact PostgREST code for an unknown column). Check current documentation and the API logs before relying on them |

## 7. Order of PRs (all small, each reviewable alone)

1. S0 tests only. 2. S1 SQL + replica test. 3. S2 SQL + replica test. 4. S3 SQL + replica test (applied only with the app consent flow ready, or knowingly
before it). 5. App: consent grant/revoke screens (needs wording review). 6. S4 function(s) + app change behind a flag. 7. S4 privilege revoke after the flag
has been on and the old path is unused. 8. S5 semantics, as a contract-driven migration (`practice_score` rename across database, API, UI, docs, tests).

## 8. Not in this plan
Provider fallback, ATS Readiness v2, ResumeFacts storage, the credential-status move to `evidence` (F-3), `profiles` privileged columns (F-7), public
insert limits (F-8), default table privileges (F-9). They have rows in the gap matrix and their own steps.
