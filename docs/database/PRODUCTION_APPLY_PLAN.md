# Plan: applying S1, S3b, S2 and S3 to the production database

Status: **plan for the owner's approval. Nothing here has been applied.** Project: `ruibdsvrcctxgxctaxwe` (CareerAiHub). Never run any of this on the ZenDMS project (`obtmsvhejvcfrkfyucev`).

What was proven so far (not production): the four scripts on a local Supabase stack built from a **dump of this project's real schema**, which equals the catalog export on 9 compared points
(`docs/database/staging/LOCAL.md`): the problems reproduced, the fixes verified, the rollback restored the problems, re-applying worked, the Phase 1 security suite 40/40. What that does not cover:
the hosted platform's own settings, and real traffic. Hence small steps, one at a time, with a check and a way back after each.

None of the four scripts changes, inserts or deletes a row of any table. They create or drop functions, triggers and policies. Their effect on users is listed per step.

## 0. Decisions needed before anything is applied

| # | Decision | Needed for |
|---|---|---|
| 1 | Candidate edits `candidate_action` (what the script allows) or `status` on their match | S2 |
| 2 | The counts in section 2: how many verified employers, visible profiles and consents exist | S3 (who is affected) |
| 3 | A quiet time window and who watches the logs afterwards | all |

S3 is **not** applied in the first round (see section 4). S5 (null instead of 0, latest instead of MAX) and S4 (server-side scoring) are separate work.

## 1. Before the first step

1. Re-export the catalog (`bash docs/database/evidence/export-catalog.sh`) into a new folder and compare it with the one in `~/supabase-baseline/catalog-2026-10-09`.
   Expected differences: only the removal of `gtm_readonly` (grants, 04/10, and its default privileges). Anything else means the database changed after the baseline: stop and look.
2. In the dashboard, Database, Backups: write down what your plan offers (point-in-time recovery, daily backups, none). If there is none, the scripts' safety net is the `.down.sql` files and the schema dump
   from step 1; optionally `supabase db dump --linked --data-only` to a folder **outside the repository** (it contains personal data; keep it private and delete it when no longer needed).
3. Open the SQL Editor of **this** project: `https://supabase.com/dashboard/project/ruibdsvrcctxgxctaxwe/sql/new`. Check the address bar before every Run.
4. Know where the logs are: Dashboard, Logs, API and Postgres. Note the current error rate before starting.
5. Have a test candidate account (not a real user) for the checks below.

## 2. Counts that size the impact (read-only, counts only, no personal data)

```
supabase db query --linked --output-format json "select count(*) as verified_employers from public.employers where verified_at is not null"
supabase db query --linked --output-format json "select count(*) as visible_profiles from public.candidate_trust_profiles where is_visible"
supabase db query --linked --output-format json "select count(*) as consents_total, count(*) filter (where revoked_at is null and expires_at > now()) as consents_active from public.consents"
supabase db query --linked --output-format json "select count(*) as scans, max(created_at) as last_scan from public.resume_scans"
```

## 3. The steps (one script per Run, in this order; wait and check between steps)

For every step: paste **the file contents** into the SQL Editor, press Run once, then run the verification, then the functional check, then record the step in `docs/database/README.md`
(date, file, who). If a verification fails: run the `.down.sql` of that step and stop.

### Step 1: S1 recompute the score when inputs are deleted (finding F-5)
- File: `docs/database/proposed/2026-10-09-recompute-score-on-delete.sql`. Undo: `...recompute-score-on-delete.down.sql`.
- User-visible effect: after a user deletes a scan, interview or STAR story (or "Clear memory"), the practice score drops accordingly instead of staying. When the last input is gone it becomes 0.
- Verify (read-only): `select tgname, tgrelid::regclass from pg_trigger where tgname like 'trg_trust_on_%_delete' order by 1` returns 3 rows;
  `select has_function_privilege('anon', 'public.trigger_recompute_trust_score_after_delete()', 'execute'), has_function_privilege('authenticated', 'public.trigger_recompute_trust_score_after_delete()', 'execute')` returns false, false.
- Functional check (test account): add a STAR story, note the practice score, delete the story, the score must change; deleting a different account's rows must not touch yours; deleting a test account must still work.
- Wait: 24 hours, watch Postgres logs for errors mentioning `trigger_recompute_trust_score_after_delete`.

### Step 2: S3b `list_open_jobs` (additive)
- File: `docs/database/proposed/2026-10-09-list-open-jobs.sql`. Undo: `...list-open-jobs.down.sql`.
- User-visible effect: none until the consent UI flag is on. It adds a function that returns open jobs of verified employers with the employer name, for signed-in users.
- Verify: `select proname from pg_proc where proname = 'list_open_jobs'` returns 1 row;
  `select has_function_privilege('anon', 'public.list_open_jobs(integer)', 'execute'), has_function_privilege('authenticated', 'public.list_open_jobs(integer)', 'execute')` returns false, true.
- Functional check: signed in as the test account, `POST /rest/v1/rpc/list_open_jobs` returns only open jobs of verified employers; without a token it is refused.

### Step 3: S2 lock the editable fields of `trust_matches` (finding F-2). Needs decision 1
- File: `docs/database/proposed/2026-10-09-lock-match-fields.sql`. Undo: `...lock-match-fields.down.sql`.
- User-visible effect: none today (no application code reads or writes `trust_matches`). It stops a candidate from setting `match_score`, `recruiter_action` or `status`, and a recruiter from setting `match_score` or `candidate_action`.
- Verify: `select tgname from pg_trigger where tgname = 'trg_lock_match_fields'` returns 1 row.
- Functional check: only possible if a verified employer and a match exist; otherwise rely on the local proof and do not invent test data on production.

## 4. Step 4: S3 consent-only recruiter access (finding F-4). **Not in the first round**

Applying S3 removes the recruiters' direct read of candidate profiles. Today the Employer Portal reads them directly (flag off). So S3 must be applied **together with** switching the consent flow on, never before:

| Order | Action | Gate |
|---|---|---|
| a | Counts in section 2 reviewed. If there are verified employers, tell them first | decision 2 |
| b | Legal wording of `consentCopy.js` approved | owner / counsel |
| c | Site deployed with the flag off, Steps 1 to 3 stable for at least 3 days | monitoring |
| d | Apply `2026-10-09-consent-only-recruiter-access.sql` and `VITE_CONSENT_FLOW=true` in the same maintenance window (Docker build with the variable) | owner sign-off |
| e | Verify: `select count(*) from pg_policies where policyname = 'recruiters can read visible profiles'` returns 0; `select has_function_privilege('anon', 'public.employer_view_candidates(uuid,uuid)', 'execute')` returns false; the Portal shows the empty state, not an error | |
| f | Functional check with a test candidate and a test verified employer through the real screens: share, see in the Portal, stop, the Portal shows nothing | |

Rollback of d: the `.down.sql` restores the three policies exactly as they were AND the flag must be turned off again; rolling back the code alone does not restore access and rolling back the database alone leaves the Portal in its error state.

## 5. After the last step
1. Re-export the catalog and `supabase db dump --linked --schema public`; commit them (if the repository is private) as the new baseline.
2. Run `compare-with-catalog.mjs` against a local stack restored from the new dump: it must equal the new export, and the proof runner must still report ALL GOOD.
3. Update `docs/architecture/ARCHITECTURE_GAP_MATRIX.md` rows 18, 33, 34 and the evidence results with what was applied and when.
4. Still open after this plan: S4 (scores written by the server, finding F-1), S5 (null instead of 0), finding F-3 (credential status), the public insert endpoints, TRUNCATE/TRIGGER privileges.

## 6. When to stop and ask
A verification differs from what is written here; the logs show new errors after a step; the catalog export in section 1 shows changes nobody made; a count in section 2 is not what the owner expects.
