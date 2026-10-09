# Plan: applying S1, S3b, S2 and S3 to the production database

Status: **plan for the owner's approval. Nothing here has been applied.** Project: `ruibdsvrcctxgxctaxwe` (CareerAiHub). Never run any of this on the ZenDMS project (`obtmsvhejvcfrkfyucev`).

What was proven so far (not production): the four scripts on a local Supabase stack built from a **dump of this project's real schema**, which equals the catalog export on 9 compared points
(`docs/database/staging/LOCAL.md`): the problems reproduced, the fixes verified, the rollback restored the problems, re-applying worked, the Phase 1 security suite 40/40. What that does not cover:
the hosted platform's own settings, and real traffic. Hence small steps, one at a time, with a check and a way back after each.

None of the four scripts changes, inserts or deletes a row of any table. They create or drop functions, triggers and policies.
**That is not the same as "no effect on users".** A new trigger can make a write that worked before fail, a policy change can make a screen return nothing, and a function can be callable by someone it should not be.
Each step below therefore lists what could break and which real application flows to run afterwards. A check with a test account shows that the flows tried work; it does **not** prove that every access path is safe.
The evidence for safety is: the catalog of the real schema, the local proof on that schema, and these production checks together.

## 0. Decisions needed before anything is applied

| # | Decision | Needed for |
|---|---|---|
| 1 | Candidate edits `candidate_action` (what the script allows) or `status` on their match | S2 |
| 2 | ~~The counts in section 2~~ **Measured 2026-10-09, see section 2** | S3 (who is affected) |
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

### Measured on 2026-10-09 (read-only, production)

| Question | Answer | What it means |
|---|---|---|
| Verified employers (`employers.verified_at` set) | **0** | No recruiter can read any candidate today. Nobody is affected by S3 right now |
| Profiles with `is_visible = true` | **1** | One profile would have been readable by any verified employer without consent (finding F-4). With 0 verified employers, none could read it so far, as far as the present state shows; the past is not known |
| Consents (total / active) | **0 / 0** | The consent table is unused |
| `resume_scans` | **5** rows, latest 2026-05-22 | A few old scans exist; no scan has been written for months (no live writer). New accounts have no ATS input |
| Extensions | `pg_graphql`, `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp` | **GraphQL is installed**: tables are reachable through `/graphql/v1` as well as REST |
| Role `gtm_readonly` and its default privileges | 0 and 0 | removed (finding F-13) |
| Catalog export after the role was removed | every count equals the first export | no other change in the database |

## 2b. Access paths considered

| Path | Covered by | Status |
|---|---|---|
| REST API (PostgREST) with a user token, with the anon key, with the service key | local proof on the real schema (`rest-consent-test.mjs`, `staging-test.mjs`) | tested locally |
| In-database rules (RLS, privileges, triggers, function bodies) | catalog export compared with the local schema on 9 points | measured |
| GraphQL (`/graphql/v1`, `pg_graphql` 1.6) | `graphql-check.mjs` on the real schema, before and after the fixes (17 checks): the findings reproduce through GraphQL and are fixed by the same scripts; no verification/scoring function is reachable by `anon` or a signed-in user; the two table-returning functions (`employer_view_candidates`, `list_open_jobs`) are **not** reachable through GraphQL, only through REST; `employer_has_consent` is reachable by signed-in users and returns false to a non-member. The probe works by name because introspection is not available | tested locally, not on the hosted project |
| Direct database logins | `anon`, `authenticated`, `dashboard_user`, `service_role` cannot log in; `postgres`, `authenticator`, `pgbouncer`, `cli_login_postgres` can; `gtm_readonly` was dropped | measured on 2026-10-09; re-check in section 1 |
| Edge Functions (`ai`, `jobs`, `verify-cert`) | they do not read these tables per the repository; the deployed source was not compared | **unverified** |
| Realtime, Storage | not used by the application per the repository | not checked on the project |

## 3. The steps (one script per Run, in this order; wait and check between steps)

For every step: paste **the file contents** into the SQL Editor, press Run once, then run the verification, then the functional check, then record the step in `docs/database/README.md`
(date, file, who). If a verification fails: run the `.down.sql` of that step and stop.

### Step 1: S1 recompute the score when inputs are deleted (finding F-5)
- File: `docs/database/proposed/2026-10-09-recompute-score-on-delete.sql`. Undo: `...recompute-score-on-delete.down.sql`.
- User-visible effect: after a user deletes a scan, interview or STAR story (or "Clear memory"), the practice score drops accordingly instead of staying. When the last input is gone it becomes 0.
- Verify (read-only): `select tgname, tgrelid::regclass from pg_trigger where tgname like 'trg_trust_on_%_delete' order by 1` returns 3 rows;
  `select has_function_privilege('anon', 'public.trigger_recompute_trust_score_after_delete()', 'execute'), has_function_privilege('authenticated', 'public.trigger_recompute_trust_score_after_delete()', 'execute')` returns false, false.
- Functional check (test account): add a STAR story, note the practice score, delete the story, the score must change; deleting a different account's rows must not touch yours; deleting a test account must still work.
- What could break: a delete on `resume_scans`, `mock_sessions` or `star_stories` fails if the recompute fails (for example when deleting an account). The replica and real-schema tests cover: deleting one input, deleting
  all inputs, deleting from two users in one statement, deleting the best scan, deleting an account (with and without the guard), and the new function not being callable by `anon`/`authenticated`
  (`s1-recompute-on-delete.mjs`, 18 checks; the real-schema run).
- Real-app flows to run afterwards (test account): save a mock interview session (`HiringManagerSim`), save a STAR story, delete that STAR story (`STARBuilder`), use **Clear memory** (`MemoryDashboard`; it deletes eight
  tables, three of them score inputs), open TrustMatch and read the practice score each time, then delete the test account.
- Expected after the last input is deleted: the score is 0, not null (the current rule; the null rule is a later step). The remaining inputs must still give the right score.
- Wait: 24 hours, watch Postgres logs for errors mentioning `trigger_recompute_trust_score_after_delete`.

### Step 2: S3b `list_open_jobs` (additive)
- File: `docs/database/proposed/2026-10-09-list-open-jobs.sql`. Undo: `...list-open-jobs.down.sql`.
- User-visible effect: none until the consent UI flag is on. It adds a function that returns open jobs of verified employers with the employer name, for signed-in users.
- Verify: `select proname from pg_proc where proname = 'list_open_jobs'` returns 1 row;
  `select has_function_privilege('anon', 'public.list_open_jobs(integer)', 'execute'), has_function_privilege('authenticated', 'public.list_open_jobs(integer)', 'execute')` returns false, true.
- Definition and guards (from the script): `SECURITY DEFINER`, fixed `search_path`; EXECUTE revoked from `public` and `anon`, granted to `authenticated`; the query returns nothing unless `auth.uid()` is set, only open jobs of
  employers with `verified_at`, only `employer_id` and `employer_name` from `employers`, at most 50 rows. Each guard is tested alone in `s3b-list-open-jobs.mjs` (18 checks) and through the API in the real-schema run.
- Functional check: signed in as the test account, `POST /rest/v1/rpc/list_open_jobs` returns only open jobs of verified employers; without a token it is refused. Check the GraphQL path too if `pg_graphql` is installed.
- What could break: nothing existing (new function). What could be wrong: it exposes the employer name of verified employers to every signed-in user; the owner accepted that for the consent flow.

### Step 3: S2 lock the editable fields of `trust_matches` (finding F-2). Needs decision 1

Evidence for decision 1 (from the production catalog and the repository, 2026-10-09):
- `trust_matches` columns: `status` (text, NOT NULL, default `'new'`, **no CHECK constraint: no lifecycle is defined in the database**), `candidate_action` (nullable), `recruiter_action` (nullable), `match_score`
  (default 0), `job_id` NOT NULL, `UNIQUE (job_id, candidate_id)`.
- Policies: the candidate may SELECT and UPDATE their own matches; a verified recruiter may SELECT, INSERT, UPDATE, DELETE for their employer. There is a separate column for each side's action.
- **No application code reads or writes `trust_matches`** (grep of `src/` and `supabase/`), so no existing flow depends on either choice.
- Contracts v1.1 say "candidate may change status only"; the schema offers a per-side action column. The two sources do not agree, so the rule has to be decided, not inferred.
- Recommendation: let the candidate change `candidate_action` only (least privilege) until a real flow defines `status`. Widening later (one list in the trigger) is easy and safe; narrowing after a client relies on it is not.
- File: `docs/database/proposed/2026-10-09-lock-match-fields.sql`. Undo: `...lock-match-fields.down.sql`.
- User-visible effect: none today (no application code reads or writes `trust_matches`). It stops a candidate from setting `match_score`, `recruiter_action` or `status`, and a recruiter from setting `match_score` or `candidate_action`.
- Verify: `select tgname from pg_trigger where tgname = 'trg_lock_match_fields'` returns 1 row.
- What could break: any client that updates `trust_matches` other than as described. None exists in this repository; unknown clients cannot be ruled out, so look at the API logs for `PATCH /rest/v1/trust_matches` over the last
  weeks before applying (the dashboard API logs can be filtered by path).
- Functional check: only possible if a verified employer and a match exist; otherwise rely on the local proof and do not invent test data on production.

## 4. Step 4: S3 consent-only recruiter access (finding F-4)

**New fact (section 2): there are 0 verified employers and 0 consents.** The hazard that held S3 back, recruiters losing a screen they use, does not exist today: no recruiter can read candidates now. The remaining hazard
is the future: the day the first employer is verified, a Portal running with the flag off would show an empty list (the database refuses its direct read), and without S3 that same employer would read the visible profile
without any consent. Two ways to hold the line, the owner chooses:

| Option | What | Effect |
|---|---|---|
| A | Apply S3 in the second round, right after Steps 1 to 3 are stable, **and** adopt the rule: no employer gets `verified_at` until the consent flow is on | The database refuses unconsented reads from day one; nothing changes for anyone today; a verified employer before the flag shows an empty Portal, not a data leak |
| B | Hold S3 until the consent UI and the flag go live together, as originally planned, and adopt the same rule | No database change now; until then the protection is only the rule (an admin not setting `verified_at`) |

Recommendation: A. It costs nothing today and turns a human rule into a database rule before it can matter. The Portal still needs the flag to show anything once S3 is applied, so the flag stays a launch item.

If option B is chosen, or when the first employer is about to be verified, S3 and the flag go together:

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

## 5b. Who decides and who can stop
- One named person applies the steps and watches the logs for 24 hours after each; that person may stop at any time and run the `.down.sql` of the last step.
- Choose the quiet window from data, not by guessing: dashboard, Reports, API requests per hour over the last 14 days; apply in the lowest hour, not on a day with a campaign.
- Do not start a step if the previous one has not passed its verification and its waiting period.

## 6. When to stop and ask
A verification differs from what is written here; the logs show new errors after a step; the catalog export in section 1 shows changes nobody made; a count in section 2 is not what the owner expects.
