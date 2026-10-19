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

## Proposed 2026-10-09, APPLIED 2026-10-19 (see the last section): recruiters read a candidate only with consent (finding F-4)

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

## Applied to production: only the server writes the score tables (2026-10-09, plan Step 5, finding F-1)

Applied by the owner in the SQL Editor of project `ruibdsvrcctxgxctaxwe`, one run, result "Success. No rows returned". File: `proposed/2026-10-09-server-only-score-writes.sql` (from `begin;` to `commit;`).
Undo: `proposed/2026-10-09-server-only-score-writes.down.sql`.

Order followed: Edge Functions `score-star`, `score-interview` and `ai` deployed; website rebuilt and swapped on the VPS from branch `deploy/s4-on-fix-session` (the previously live commit `d263eb0` plus the S4 and AI-fallback commits; the previous container was kept stopped as `career-ai-hub-before-s4`, image tag `career-ai-hub:before-s4`);
the owner saved a STAR story and an interview on careeraihub.com with a test account; the live JavaScript bundle was checked to contain `score-star` and `score-interview`; then this script.

Verified afterwards (read-only, `has_table_privilege` for `authenticated`): `resume_scans`, `mock_sessions`, `star_stories` have INSERT = false, UPDATE = false, SELECT = true, DELETE = true.
Before applying, a replica run showed F-1 and F-1b moving from OPEN to FIXED.

Not checked: a real forged write attempt against production (it would need a test account token); the delete path after the revoke (S1 triggers still fire on delete) on production; the website running `main` (94 more commits) has NOT been deployed, only this branch.
Anon still has no useful access (RLS), but its INSERT/UPDATE were revoked too.

## Re-applied to production: only the server writes the score tables (2026-10-13, finding F-1 reopened)

**Why:** a read-only ACL query by the owner on 2026-10-13 (`pg_class.relacl` via `aclexplode`) showed `anon` and `authenticated` holding `INSERT` and `UPDATE` (and every other privilege) on `resume_scans`, `mock_sessions` and `star_stories`, although the entry above records the revoke as applied and verified on 2026-10-09. **Why the privileges were back is UNKNOWN**: nothing in the repo shows a later grant; candidates are an undo, a later grant or default-privilege change, a project restore, or a difference in how the 2026-10-09 check was made. Sign-up is open without email confirmation (`mailer_autoconfirm: true`, read 2026-10-13), so any signed-in user could have written scores through the REST API under the owner-scoped policy. Before the fix: `mock_sessions` 7 rows, none with `questions_count` outside 1 to 5 or without `user_id`; `star_stories` 2 rows; `resume_scans` 5 old rows. Absence of an obvious signature does not prove nobody wrote a score.

**Applied** by the owner in the SQL Editor of project `ruibdsvrcctxgxctaxwe`, one run, result "Success. No rows returned". Statements: the `begin; ... commit;` block of `proposed/2026-10-09-server-only-score-writes.sql` (three `revoke insert, update ... from authenticated, anon`). Undo: `proposed/2026-10-09-server-only-score-writes.down.sql`.

**Verified afterwards:**
- ACL query: for all three tables `anon` and `authenticated` now hold `DELETE, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE` (no `INSERT`, no `UPDATE`); `service_role` keeps all eight.
- Live site (careeraihub.com, owner test account): a mock interview finished and showed "✓ Saved to your history"; a STAR story was reviewed, saved and still listed after a page reload. Both go through `score-interview` / `score-star` (service role).

**Not checked:** a direct REST insert or update by a signed-in test user (to see the refusal); `TRUNCATE`, `TRIGGER`, `REFERENCES` and `MAINTAIN` are still granted to `anon` and `authenticated` (not reachable through the REST API; not changed here); whether other earlier-applied steps (S1 triggers verified present on 2026-10-13; S2 `trg_lock_match_fields`, S3b `list_open_jobs` grants, Phase 1 column privileges) have drifted too. **Recommended follow-up:** a read-only drift check of every applied step against this README.

### Drift check 2026-10-13 (read-only, owner), part 1
Still as recorded on 2026-10-09: S1 delete triggers (seven trust triggers enabled, including `trg_trust_on_*_delete`); S2 `trg_lock_match_fields` on `trust_matches` enabled (`O`); S3b `list_open_jobs(integer)` executable by `authenticated` and not by `anon`. Also present on `trust_matches`: `trg_lock_row_parties` (enabled), not described in this README; origin UNKNOWN. S4 had drifted and was re-applied (section above). Part 2 (Phase 1 table privileges) pending.

### Drift check 2026-10-13 (read-only, owner), part 2
Table-level privileges of the Phase 1 tables for `anon`, `authenticated` and `PUBLIC` match `phase1/001_phase1_foundation.sql`: `career_profiles` DELETE, INSERT, SELECT; `career_targets` DELETE, SELECT; `consents`, `evidence`, `verification_attempts`, `verification_requests` SELECT only; `trusted_issuers` nothing; no row for `anon` or `PUBLIC`. Column-level grants (part 3) pending.

### Drift check 2026-10-13 (read-only, owner), part 3: column privileges, result
`information_schema.column_privileges` for `anon` and `authenticated`, INSERT and UPDATE:
- `mock_sessions`, `star_stories`, `resume_scans`: **no rows**, so no column-level grant survives the S4 revoke.
- Phase 1 tables match the design: `career_targets` INSERT/UPDATE `is_primary, jd_text, level, market, role_title`; `career_profiles` UPDATE `full_name, headline, location, summary`; `consents` INSERT `employer_id, expires_at, purpose, scope`, UPDATE `revoked_at`; `evidence` INSERT `claim, raw_credential, source_provider, source_type, source_url, supersedes_id, type`, UPDATE `withdrawn_at`; `verification_requests` INSERT `evidence_id`. `career_profiles` INSERT lists all columns (including `candidate_id`, `id`, `created_at`, `updated_at`) because `001_phase1_foundation.sql` grants INSERT on that table at table level (line 412): as designed, not drift.
- `candidate_trust_profiles`: INSERT and UPDATE on **every column, including the four score columns, for `authenticated` and `anon`**. This is the known state: the score columns are protected by the trigger `trg_lock_trust_columns` (present and enabled, read 2026-10-13) and the owner-only policy, not by revoked privileges. `anon` has no row it can pass the policy for. The trigger body was not re-read in this check; if that trigger were dropped, any signed-in user could write their own `trust_score` directly. A re-read of its definition is a recommended read-only follow-up.
Conclusion of the drift check: S1, S2, S3b and Phase 1 are as recorded; only S4 had drifted (fixed). Cause of the S4 loss remains UNKNOWN.

### Drift check 2026-10-13, part 4: `trg_lock_trust_columns` definition (owner)
Enabled (`O`), `BEFORE INSERT OR UPDATE ... FOR EACH ROW`, function `lock_trust_columns()` (not SECURITY DEFINER, fixed `search_path`). For `current_user` in (`anon`, `authenticated`): on INSERT the four score columns are forced to 0; on UPDATE they are restored to the old values. `recompute_trust_score` is SECURITY DEFINER, so inside it `current_user` is the function owner and the lock does not apply: the trigger-driven recompute can write the scores, the browser roles cannot. Not covered by this lock: roles other than `anon`/`authenticated` (service role writes are allowed by design). The remaining browser-writable columns (`is_visible`, profile text, salary range) are as intended. Drift check complete: no drift except S4 (fixed).

## 2026-10-18: practice ledger is on production, and the gate observes (read-only check by Claude, CLI)

State found, not a change made today. `ledger.js` (PR #149) says `2026-10-15-practice-ledger.sql` was applied on 2026-10-15; that date is the owner's record and was not re-verified here. What was read on 2026-10-18 (project `ruibdsvrcctxgxctaxwe`):
- `reserve_ai_request`, `settle_ai_request` and `mark_unknown` exist. `anon` and `authenticated` cannot execute them; `service_role` can. `reserve_ai_request` has **no** session-owner check (`bad_session` is not in its body): the patch `proposed/2026-10-18-ledger-session-owner.sql` is proposed and not applied.
- `ai_policies` has 0 rows, so every request is recorded with `gate_mode = 'observe'` and nothing is limited. No limit value has been set.
- The function secret `AI_LEDGER` exists (updated 2026-10-18 09:50 UTC; its value is not shown). `ai_requests` has 3 rows, all created from 09:53 UTC that day, all `completed` and `observe`: 1 `ats_parse`, 2 `mock_questions`; `user_usage_windows` has 1 row. That is too little to set any limit from.
- Not read: the row counts of `practice_sessions` and `practice_submissions`, the policies and grants on the five tables, and the `[usage]` logs.

## 2026-10-18: ledger patch applied (owner, SQL Editor) and read back (Claude, read-only CLI)

Applied: `proposed/2026-10-18-ledger-session-owner.sql` (replaces `reserve_ai_request`; down script: `proposed/2026-10-18-ledger-session-owner.down.sql`). The owner ran it in the SQL Editor of project `ruibdsvrcctxgxctaxwe` and the editor answered "Success. No rows returned". Claude could not run it itself (writes to production are blocked for it).
- Before: the function on production was compared with the repo original and was identical, apart from Postgres printing `search_path` as `to 'public','pg_temp'`.
- Read back at 11:37 UTC: `reserve_ai_request` has one copy, contains `bad_session`, is `security definer`; `anon` and `authenticated` cannot execute it, `service_role` can. `ai_policies` still has 0 rows (observe mode), so nothing is limited.
- The ledger also has rows from `score-star` and `score-interview` (`score_star_review`, `score_interview_evaluate`, both `openai` / `gpt-6-luna`, observe, completed). Neither row reports thinking tokens, so they do not show whether the double count of reasoning tokens (fixed in #155) is gone: still to be confirmed with a row that has thinking tokens.
- Not read: other functions' bodies, grants on the tables, and that the down script restores the previous body on production (it passed on the replica only).


## 2026-10-19: consent-only recruiter access and the privilege revoke applied (owner, SQL Editor) and read back (Claude, read-only CLI)

Both scripts were run by the owner in the SQL Editor of project `ruibdsvrcctxgxctaxwe`, one run each, answer "Success. No rows returned". Claude could not run them (writes to production are blocked for it). Each read-back below is a read-only query through the CLI.

### 1. `proposed/2026-10-09-consent-only-recruiter-access.sql` (finding F-4)
Undo: `proposed/2026-10-09-consent-only-recruiter-access.down.sql`. Before the run (read the same day): the policy `recruiters can read visible profiles` existed, the two functions did not, and both insert policies used `candidate_is_visible`; the down script matched that state.
Read back after the run:
- `candidate_trust_profiles` has one policy, `candidate owns profile`; `recruiters can read visible profiles` is gone, so a recruiter has no direct read of the table.
- `employer_has_consent` and `employer_view_candidates` exist, are `SECURITY DEFINER`, executable by `authenticated` and not by `anon`.
- The insert policies of `trust_matches` and `pipeline_entries` now use `employer_has_consent(candidate_id, employer_id, 'profile')`.
- Data unchanged: 7 profiles, 1 visible.
**Timing note:** a first read-back made right after the owner's "Success" still showed the old state (old policy present, functions absent). A second read about ten minutes later showed the new state. The cause is UNKNOWN (the run may simply not have finished when the first read was made). Read back again before relying on any single read.
Context read at the time: 1 employer, 0 verified (`verified_at` empty), 1 member, 0 rows in `consents`. With no verified employer the old policy granted nothing in practice; the risk was latent, not active.
Not checked: calling `employer_view_candidates` with a real signed-in user (no verified employer exists to test with). The web build live at the time did not turn on `VITE_CONSENT_FLOW` (not confirmed from the build; the repo test forbids it in env files), so the Employer Portal branch that reads `candidate_trust_profiles` directly now returns no rows to recruiters.
**Rule that follows:** do not set `verified_at` on any employer before the consent screen and the flag are live, otherwise that employer sees no candidates.

### 2. `proposed/2026-10-18-revoke-excess-privileges.sql` (RLS audit findings 3 and 4)
Undo: `proposed/2026-10-18-revoke-excess-privileges.down.sql`. Before the run: the grants of `anon` and `authenticated` on the 20 tables were compared by script with the baseline used by `replica-test/s6-privilege-hardening.mjs`: 20 tables, 0 differences. That test passed 14 of 14 on the replica.
Read back after the run (about 20 seconds after the owner's "Success"):
- `anon` holds no privilege on the 16 private tables.
- No role has `TRUNCATE`, `TRIGGER` or `REFERENCES` on any `public` table.
- `anon` keeps `SELECT` on `job_listings`, and `SELECT`, `INSERT`, `UPDATE`, `DELETE` on `waitlist`, `culture_leads`, `culture_quiz_events` (their writer is not in this repository: UNKNOWN, left as it was).
- `authenticated` keeps `SELECT`, `INSERT`, `UPDATE`, `DELETE` on `user_memory` and `candidate_trust_profiles`, and `SELECT`, `DELETE` on `mock_sessions`.
- Row level security is on for all 32 `public` tables.
Not checked: signing in to the app and using it after the change.

### Found, not changed: default privileges and drift
- `pg_default_acl` for schema `public` gives `anon`, `authenticated` and `service_role` all table privileges (and execute on functions) on every new object created by `postgres` or `supabase_admin`. The ledger tables are tight only because their scripts revoke by hand. A table created later without a revoke is open to the browser roles (RLS permitting). Nothing was changed; a fix needs its own script, replica test and approval.
- `anon` and `authenticated` are members of no other role and have no `BYPASSRLS`; column privileges equal the table privileges on `candidate_trust_profiles`, `profiles` and `user_memory`.
- On 2026-10-13 the privileges of an applied script were found back to their old state for a reason that was never found (section "Re-applied to production" above). These two scripts can drift in the same way. **Recommended:** repeat the grants comparison of section 2 on a regular schedule.

## Proposed, NOT applied: default privileges of schema public (2026-10-19)

`proposed/2026-10-19-default-privileges.sql` (undo: `proposed/2026-10-19-default-privileges.down.sql`). Found by a read-only check on 2026-10-19: every object in `public` is owned by `postgres`, and `pg_default_acl` gives `anon`, `authenticated` and `service_role` all table privileges, `rwU` on sequences and `EXECUTE` on functions for each object created later by `postgres`. The ledger tables are tight only because their scripts revoke by hand; a table created later without that revoke is open to the browser roles (RLS permitting).
The script removes those default grants for `anon` and `authenticated` (tables, sequences, functions) for objects created from now on. It changes no existing object and not `service_role`'s defaults.
**Limit, tested:** PostgreSQL gives `PUBLIC` execute on every new function, and a schema-level default cannot remove it, so a function script must still end with `revoke execute ... from public`. Removing it everywhere would need the same statement without `in schema public`, which affects every schema: not proposed.
**Consequence:** a table created later gives "permission denied" to the browser until a script grants exactly what the app needs; forgetting fails closed.
Tested only on the in-memory replica: `replica-test/s7-default-privileges.mjs` (13 of 13: new table closed, `service_role` kept, sequence closed, existing objects unchanged, not retroactive, twice-applicable, down restores). Not applied to production. Before applying, read `pg_default_acl` again and compare with the baseline in the test.
