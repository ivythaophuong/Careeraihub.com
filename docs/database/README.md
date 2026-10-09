# Database changes made outside the app

The repo has no SQL migrations; these were applied by hand in the Supabase SQL Editor.

## 2026-10-05: lock score columns, require verified employers

Applied: `2026-10-05-lock-scores-and-verify-employers.sql`. A rollback script exists but is kept privately by the
owner, because it restores the weaker policies this change replaced.

What it does
- Scores (`trust_score`, `ats_score`, `interview_score`, `star_score`) can't be written from the browser; the
  database trigger `recompute_trust_score` still writes them.
- `recompute_trust_score` / `trigger_recompute_trust_score` can't be called from the browser; `search_path` is pinned.
- Employers need `employers.verified_at` (set only by an admin in the SQL editor) to read candidate profiles,
  create matches or pipeline rows, or have job listings shown publicly.
  Verify one with: `update public.employers set verified_at = now() where id = '<employer id>';`
- `employer_id` / `candidate_id` of matches and pipeline rows can't be changed from the browser.
- Score columns on `resume_scans`, `mock_sessions`, `star_stories` are limited to 0..100 (new and changed rows).

Known gap: the three input tables still take scores sent by the browser. The real fix is to write AI scores from a
server-side function (planned).

`replica-test/` runs the attack and normal-use scenarios against an in-memory Postgres (PGlite) built from the audited
schema, before and after the change:

    npm i @electric-sql/pglite
    node run.mjs before
    node run.mjs after ../2026-10-05-lock-scores-and-verify-employers.sql

## 2026-10-09: score metadata on `resume_scans`

Applied: `2026-10-08-resume-scans-score-metadata.sql` (Supabase SQL Editor, "Success. No rows returned"). Adds
three nullable columns (`deterministic_score`, `score_type`, `score_version`) so a rule-based score (P4,
`src/scoring/resumeScore.js`) is stored apart from the AI-generated `credibility_score`, which
`recompute_trust_score` takes `MAX()` of on every insert. Does not touch `credibility_score`, the trigger, RLS
or grants, so the trust score does not change. Rollback is in the script's own header comment (safe: nothing
in the app reads these columns yet, so nothing depends on them existing).

Tested beforehand against the in-memory replica (`replica-test/score-metadata.mjs`, 20 checks: columns, old
rows keep NULL, trust score unchanged, rule-based row ignored by `MAX`, range and label constraints, RLS,
idempotent, rollback). Run it the same way as the 2026-10-05 test. The score is still computed in the browser,
so the database can check range and labels, not honesty.

Known gap: no code writes to these columns yet — ATS Builder's deterministic score (Gate 1-4,
`integration/ats-builder-p4-score*`) only logs to the browser console today, it does not persist to
`resume_scans`. Wiring that write is a separate, not-yet-done step.

## Proposed, NOT applied: recompute the practice score when inputs are deleted (2026-10-09, finding F-5)

`proposed/2026-10-09-recompute-score-on-delete.sql` (undo: `proposed/2026-10-09-recompute-score-on-delete.down.sql`) adds statement-level AFTER DELETE
triggers on `resume_scans`, `mock_sessions`, `star_stories` that recompute `candidate_trust_profiles` once per affected user. It skips users that no longer
exist in `auth.users`, so deleting an account (which cascades) is not blocked. It does not change the formula, RLS, policies or grants, and the score becomes 0
(not NULL) when the last input is deleted, as in the current rule.

Tested only on the in-memory replica: `replica-test/s1-recompute-on-delete.mjs` (18 checks, including account deletion with and without the guard, privileges,
idempotence and the down script) and `replica-test/s0-integrity-findings.mjs --desired --apply=<this script>` (F-5 flips to FIXED, the other findings stay OPEN).
The replica adds the four foreign keys to `auth.users` that production has (evidence query 1.8). Not run against the real database.

## Proposed, NOT applied: recruiters read a candidate only with consent (2026-10-09, finding F-4)

`proposed/2026-10-09-consent-only-recruiter-access.sql` (undo: `.down.sql`, which restores the three policies exactly as read from production). Owner decision:
a recruiter may read a candidate only with that candidate's consent.

- Drops the policy "recruiters can read visible profiles": recruiters have no direct SELECT on `candidate_trust_profiles`.
- Adds `employer_view_candidates(employer, candidate)`: the only recruiter read path. It needs a verified membership of that employer and an active consent
  (purpose `recruiter_review`, part `profile`; part `salary` adds the salary range). It never returns the practice scores.
- Adds `employer_has_consent(candidate, employer, part)` and uses it instead of `candidate_is_visible()` in the match and pipeline insert policies.
- `is_visible` no longer grants any read. Revocation and expiry apply on the next request.

**Consequences:** recruiters cannot browse candidates; the app has no consent screen and the Employer Portal does not call the new function, so its candidate views
return nothing until both exist. Matches and pipeline entries created earlier stay visible to their employer (ids, status, the recruiter's own notes).

Tested only on the in-memory replica: `replica-test/s3-consent-only-access.mjs` (80 checks: no consent, each part, wrong purpose, other employer, unverified employer,
revocation, expiry, probing, matches and pipeline, the service role, idempotence, four removed-safeguard controls, the down script, plus a security matrix:
no cross-candidate read or revoke, no recruiter access to consents, no edit of scope/employer/purpose/expiry/owner, invalid consents rejected, one-request revocation per
employer, every protected path closed after revocation, and an exact column list for the recruiter function) and
`replica-test/s0-integrity-findings.mjs --apply=<this script>` (F-1b, F-4a, F-4c, F-4d flip to FIXED). With S1, S2 and S3 applied together only F-1 stays OPEN.
Not run against the real database.

## Applied to production: S1 recompute the practice score when inputs are deleted (2026-10-09, finding F-5)

Applied by the owner in the SQL Editor of project `ruibdsvrcctxgxctaxwe`, one run, result "Success. No rows returned". File: `proposed/2026-10-09-recompute-score-on-delete.sql`
(the statements from `begin;` to `commit;`, without the leading comments). Undo: `proposed/2026-10-09-recompute-score-on-delete.down.sql`. Plan: `PRODUCTION_APPLY_PLAN.md`, Step 1.

An earlier attempt left no trace (no trigger, no function); the verification below was run after the successful run.

What was checked after applying (read-only, `supabase db query --linked`):
- Three triggers exist and are enabled: `trg_trust_on_mock_session_delete`, `trg_trust_on_resume_scan_delete`, `trg_trust_on_star_story_delete`; the three earlier triggers are unchanged.
- `anon` and `authenticated` cannot execute `trigger_recompute_trust_score_after_delete()`.
- The number of rows in `candidate_trust_profiles` was 5 before and after (the script changes no rows).
- Functional check with a throw-away account created through the real site: saving a STAR story gave `star_score` 31 and `trust_score` 8; after deleting the story in STAR Builder both scores became 0
  (`updated_at` showed the recompute after the delete; before S1 they stayed at 31 and 8). Deleting that account in the dashboard succeeded and removed its profile row (5 rows again).

Not checked: "Clear memory" (it deletes eight tables at once) was skipped by the owner and should be repeated with a new throw-away account; a delete of a mock interview session.
Waiting period: 24 hours with the Postgres logs watched for errors mentioning `trigger_recompute_trust_score_after_delete` before Step 2.

## Applied to production: S3b `list_open_jobs` (2026-10-09, plan Step 2)

Applied by the owner in the SQL Editor of project `ruibdsvrcctxgxctaxwe`, one run, result "Success". File: `proposed/2026-10-09-list-open-jobs.sql` (the statements from `begin;` to `commit;`).
Undo: `proposed/2026-10-09-list-open-jobs.down.sql`.

Verified afterwards (read-only, SQL Editor): the function exists (1 row); `anon` cannot execute it (false); `authenticated` can (true).

Not checked: the 24-hour Postgres log review after Step 1 (the owner's confirmation was not recorded); a call through REST/GraphQL as a signed-in test account; a call without a token. Both are UNKNOWN on production.

## Applied to production: S2 lock the editable fields of `trust_matches` (2026-10-09, plan Step 3, finding F-2)

Applied by the owner in the SQL Editor of project `ruibdsvrcctxgxctaxwe`, one run, result "Success". File: `proposed/2026-10-09-lock-match-fields.sql` (from `begin;` to `commit;`).
Undo: `proposed/2026-10-09-lock-match-fields.down.sql`. Rule chosen: the candidate may change only `candidate_action`; a verified recruiter only `recruiter_action` and `status`; `match_score` is never writable from the browser.

Before applying: the Edge/API log search for `trust_matches` over the last 5 days (the dashboard showed "Last 5 days", not the 7 the plan asked for) returned no data.
Verified afterwards (read-only): `trg_lock_match_fields` exists and is enabled (`tgenabled = 'O'`).

Not checked: behaviour with a real match row (no verified employer or match exists, so no test data was invented on production).

## Proposed, NOT applied: only the server writes the score tables (2026-10-09, finding F-1, S4 slice 3)

File: `proposed/2026-10-09-server-only-score-writes.sql` (undo: `...server-only-score-writes.down.sql`). Revokes INSERT and UPDATE on `resume_scans`, `mock_sessions` and `star_stories` from `authenticated` and `anon`;
SELECT and DELETE stay. The Edge Functions `score-star` and `score-interview` write with the service role.

Evidence: the in-memory replica run `s0-integrity-findings.mjs --apply=<this script>` flips F-1 and F-1b to FIXED (a scan row with score 100 is refused; trust_score stays 0). The other findings in that run stay OPEN
because only this script was applied there. Not run against production. Before it is applied the site live must be built with server scoring on (the default since this change), otherwise saving a story or an interview fails.
Production state: `score-star` and `score-interview` are deployed (2026-10-09) and one STAR story went through; the interview check on production was not yet confirmed when this was written.
