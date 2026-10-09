# Live database evidence: results (2026-10-09)

Produced by the owner running the read-only queries of [EVIDENCE_PASS.md](EVIDENCE_PASS.md) in the Supabase SQL Editor and pasting the
output into the review chat. Nothing was changed on the project. Nothing here was run by the author of this document.

Tag used below: **[DB]** = read from the live database catalog on 2026-10-09. A [DB] fact is true for that moment; it says nothing about
how the application behaves, and no application flow was exercised.

## 1. What was received

| Query | Content | Completeness |
|---|---|---|
| 1.1 | tables in `public`, RLS enabled/forced | complete (27 tables, `rls_enabled = true` on all, `rls_forced = false` on all) |
| 1.2 | columns | **partial**: cut inside `verification_attempts`; the last tables (`verification_requests`, `waitlist`) not seen |
| 1.3 | all RLS policies | complete |
| 1.4 | table privileges for `anon`, `authenticated` | part 1 covers `applications` to `employers` but stops inside `employers` (authenticated UPDATE, TRIGGER, TRUNCATE for `employers` not seen); part 2 covers tables from `evidence` on, SELECT/INSERT/UPDATE/DELETE only (TRUNCATE, TRIGGER, REFERENCES for those tables not read) |
| 1.5 | triggers | complete |
| 1.6 | function bodies | complete for 16 functions: `recompute_trust_score`, `trigger_recompute_trust_score`, `lock_trust_columns`, `lock_employer_verification`, `start_verification`, `apply_verification_attempt`, `has_consent`, `is_verified_employer_member`, `employer_is_verified`, `candidate_is_visible`, `lock_row_parties`, `consents_guard`, `evidence_before_insert`, `evidence_before_update`, `verification_attempts_guard`, `verification_requests_before_insert`. Not read: `touch_updated_at` |
| 1.7 | EXECUTE grants to `anon`, `authenticated`, `public` | complete |
| 1.8 | constraints | complete when the two parts are combined (the first stopped inside `trust_messages`, the second started at `trust_messages`) |
| views | `evidence_current`, `evidence_active` | `security_invoker=true` on both |
| column privileges | INSERT/UPDATE on `evidence`, `trust_matches`, `consents`, `verification_requests` | complete |

The raw outputs are not committed here: several were truncated in transit and some contain every column name of the schema. The owner
keeps the originals; they can be added under `docs/database/evidence/2026-10-09/` after review.

## 2. Confirmed as designed [DB]

1. RLS is enabled on every table in `public`. Every user-owned table has an owner policy of the form `auth.uid() = user_id` (or `candidate_id`).
2. `trusted_issuers` has RLS on and **no policy**, so the browser roles cannot read it.
3. `apply_verification_attempt`, `start_verification`, `has_consent`, `recompute_trust_score`, `trigger_recompute_trust_score` are **not**
   executable by `anon`, `authenticated` or `public`.
4. Browser writes to `evidence` are limited by column privileges to `claim, raw_credential, source_provider, source_type, source_url,
   supersedes_id, type` (INSERT) and `withdrawn_at` (UPDATE). Triggers reset verification fields on insert and reject any other update.
   Verification status transitions are enforced by `evidence_before_update`; `trust_status = ELIGIBLE` additionally requires a CHECK
   constraint (`VERIFIED`, `subject_binding` in `email_verified`/`did_proof`, `issuer_trusted` and `recipient_binding_verified` true).
5. `verification_attempts` is append-only (trigger) and readable only through the owner's evidence; `verification_requests` insert is limited
   to `evidence_id`, with a limit of 5 requests per hour and state checks.
6. `consents` can only be inserted (employer, scope, purpose, expiry ≤ 365 days) and revoked once.
7. `employers.verified_at` cannot be set from the browser (`lock_employer_verification`, trigger attached on INSERT and UPDATE).
   `candidate_trust_profiles` score columns cannot be written from the browser (`lock_trust_columns`, trigger attached).
8. The two trigger functions above are, word for word, the scripts recorded in `docs/database/2026-10-05-lock-scores-and-verify-employers.sql`.
9. Every user table found has a foreign key to `auth.users` with `ON DELETE CASCADE`.
10. Score columns on `resume_scans`, `mock_sessions`, `star_stories` have range checks marked `NOT VALID` (apply to new and changed rows).

## 3. Trust-score formula [DB]

`recompute_trust_score(user)`:

| Term | Source | Missing data |
|---|---|---|
| ATS | `MAX(resume_scans.credibility_score)` over all of the user's scans (the comment in the function says "latest") | `0` |
| Interview | average `mock_sessions.avg_score` of the last 5 | `0` |
| STAR | average `star_stories.score` of the last 5 | `0` |
| Trust | `ROUND(ATS×0.40 + Interview×0.35 + STAR×0.25)` | uses the zeros above |

It upserts `candidate_trust_profiles`. Triggers call it AFTER INSERT and AFTER UPDATE on `resume_scans`, `mock_sessions`, `star_stories`;
**there is no DELETE trigger**.

## 4. Findings (provisional severity; none acted on)

"Permitted" means policy, grant and trigger allow it as read. Nothing was exploited or tested.

| Id | Finding | Evidence | Severity |
|---|---|---|---|
| F-1 | A signed-in user may insert or edit their own `resume_scans`, `mock_sessions`, `star_stories` rows with any score 0–100; the triggers turn that into `trust_score`, which verified recruiters can read | policies "Users manage own scans/stories/mock sessions" (1.3), table privileges (1.4), recompute function and triggers (1.5, 1.6), `NOT VALID` range checks (1.8) | High (marketplace integrity) |
| F-2 | A candidate may update `match_score`, `status`, `recruiter_action`, `candidate_action` on their own `trust_matches` rows. `lock_row_parties` protects only `employer_id` and `candidate_id` | policy "candidate updates own match" (no `with_check`), column privileges on `trust_matches` (UPDATE on all columns), trigger body | Medium |
| F-3 | `user_memory` is a JSON document the owner can write freely, so the app's `credentials[].status = 'verified'` can be set by the user. The `evidence` model that prevents this is not used by the app | policy "Users manage own memory", privileges, repo grep of the code | High while any UI treats it as verified; Medium today (TrustMatch does not read it) |
| F-4 | Any member of **any** verified employer can read **every** profile with `is_visible = true`, with all columns (name, headline, bio, skills, salary range, location). `has_consent` exists but this policy does not use it. `is_verified_employer_member()` is called with `NULL`, meaning "any verified employer" | policy "recruiters can read visible profiles", function body | Medium; privacy mismatch with the white paper (salary hidden until match) |
| F-5 | The score is stale after deletion. "Clear memory" and deleting a STAR story do not recompute it (no DELETE trigger), and "Clear memory" does not remove `candidate_trust_profiles`; the profile with its score remains visible if `is_visible` is on | triggers (1.5), `MemoryDashboard.jsx` delete list, `STARBuilder.jsx:88` | Medium |
| F-6 | `JDAnalyzer.jsx:56` inserts `key_requirements` and `critical_gaps` into `jd_analyses`, which has neither column (columns: id, user_id, company, role_title, match_score, keywords, gaps, advice, created_at). PostgREST normally rejects unknown columns, so this insert should fail; the failure would only show as a save warning. Not observed | 1.2 columns, code | Medium (functional) |
| F-7 | `profiles` (including `role`, `is_pro`, `account_type`) is writable by its owner with no trigger. The app does not read `is_pro` or `account_type` today (grep) | policy, privileges, no trigger | Low now; High if either is later used for access |
| F-8 | `anon` may insert into `waitlist`, `culture_leads` (requires `marketing_consent`) and `culture_quiz_events` (no condition) with no rate limit | policies | Low (spam, storage) |
| F-9 | `anon` and `authenticated` hold TRUNCATE, TRIGGER, REFERENCES on many tables (Supabase defaults). Row policies do not govern TRUNCATE. The REST API does not issue TRUNCATE, so this is believed not reachable from the browser; not tested | 1.4 | Low (hardening) |
| F-10 | A verified recruiter can create a `trust_matches` row for any visible candidate with any `job_id`; the policy does not check that the job belongs to the employer | policy "verified recruiter creates matches" | Low |
| F-11 | The Phase 1 evidence/verification schema exists and is locked down, but no application code reads or writes it, and no verifier service that would call `start_verification` / `apply_verification_attempt` was found in the repo | 1.1, repo grep, `docs/database/phase1/README.md` on branch `feature/phase1-foundation` ("nothing in the app writes to them") | Functional gap |
| F-12 | Because no live code inserts `resume_scans`, a new account has ATS = 0 and a maximum trust score of 60 (35 + 25 from interview and STAR). The Roadmap and Dashboard use 65 as a milestone | formula (1.6), audit §4.1 | Medium (functional) |

### Evidence class of each finding

Four classes are used. **CONFIRMED IN PRODUCTION**: read from the live catalog on 2026-10-09 (a rule, a grant, a trigger or a function body exists).
**CONFIRMED IN REPOSITORY**: read in code on `main`. **INFERRED RISK**: follows from the two above but was not exercised; the behaviour is not proven.
**UNKNOWN**: not established. A finding that says "may" or "is permitted" is a statement about rules, not about something that happened.

| Id | CONFIRMED IN PRODUCTION | CONFIRMED IN REPOSITORY | INFERRED RISK (not tested) | UNKNOWN |
|---|---|---|---|---|
| F-1 | owner-scoped ALL policies and grants on the three input tables; recompute function and AFTER INSERT/UPDATE triggers; range checks `NOT VALID` | the browser inserts `avg_score` (`mock_sessions`) and `score` (`star_stories`) from AI output it parsed; `resume_scans` has no live writer | a user can raise their own `trust_score` by writing a row with a high score | whether anyone has done so; how many rows exist |
| F-2 | candidate UPDATE policy without `with_check`; UPDATE granted on all `trust_matches` columns; `lock_row_parties` body | no app code touches `trust_matches` | a candidate can change `match_score`/`recruiter_action` on their own match | whether any match rows exist |
| F-3 | owner-write policy on `user_memory`; the `evidence` model and its server-only functions | the app stores `credentials[].status` in `user_memory`; the app never uses `evidence` | a user can mark a credential `verified` | whether anything downstream reads that status as trust (TrustMatch does not, per the repo) |
| F-4 | policy "recruiters can read visible profiles"; `is_verified_employer_member()` body (any verified employer) | Employer Portal reads `candidate_trust_profiles` | a verified recruiter can read all columns of every visible profile | number of verified employers and visible profiles |
| F-5 | no DELETE triggers on the input tables | "Clear memory" deletes 8 tables and not `candidate_trust_profiles`; STAR delete at `STARBuilder.jsx:88` | the stored score and the profile stay after the inputs are deleted | whether the profile row is expected to be removed (product) |
| F-6 | `jd_analyses` has no `key_requirements` or `critical_gaps` column | `JDAnalyzer.jsx:56` writes both | the insert fails (PostgREST rejects unknown columns) and only a save warning shows | the real failure behaviour in the app; not observed |
| F-7 | `profiles` owner-write policy, no trigger | no app code reads `is_pro`/`account_type` | none today | later use of these columns |
| F-8 | anonymous INSERT policies on three tables | no code on `main` references these tables (grep); callers, if any, are on other branches or outside the repo | spam or unbounded growth | actual volume |
| F-9 | TRUNCATE/TRIGGER/REFERENCES granted to `anon`/`authenticated` | – | not reachable through REST | direct database access paths |
| F-10 | insert policy does not check the job's employer | – | cross-employer match rows | whether it matters without a matching engine |
| F-11 | evidence schema, server functions, no policy on issuers | no app or verifier code on `main` | the verification model is unused | whether any verifier service exists elsewhere (deployed functions not compared) |
| F-12 | recompute formula, zero for missing, triggers | no live writer of `resume_scans` | new accounts cap at 60 | whether other deployed clients write `resume_scans` |

**RLS enabled is not protection by itself.** Section 2 lists what was checked beyond the switch: each policy's expression, column privileges, function
EXECUTE grants and trigger bodies. Rules read from the catalog show what the database will do; they were not exercised with real requests, and none of
this replaces the actor × table tests planned in [the plan](plans/PLAN-score-and-consent-integrity.md).

## 5. Earlier statements this evidence changes

| Earlier statement | Now |
|---|---|
| "The `recompute_trust_score` body is not in the repo; formula UNKNOWN" (audit §4.2, §9) | Read, see §3 |
| "RLS policies not in the repo; RLS content UNKNOWN" | Policies read, see §2 and §4 |
| "Recruiter role from `user_metadata` may allow access; RLS content UNKNOWN" (gap row 21) | Reading candidate data requires `verified_at`, which the browser cannot set; choosing recruiter at sign-up gives the screen and the right to create an unverified employer, not data access. F-4 remains |
| "No complete migration history in the repo" | The Phase 1 migration, contracts v1.1 and tests exist on the **unmerged** branch `feature/phase1-foundation` (commit `5c377ae`, documented as applied 2026-10-05). `main` has no ordered history |
| "Credential verification: Missing" (gap rows 15, 16) | The database side is **built** (evidence, issuers, attempts, requests); the application side is **missing** |
| "Whether the two `jd_analyses` writers both succeed is UNKNOWN" (audit §2) | The JDAnalyzer writer uses columns the table does not have (F-6) |

## 6. Still unknown after this pass

- Raw outputs for the truncated parts: the tail of `1.2` (from `verification_attempts`), and the `1.4` privileges named in §1.
- `touch_updated_at` body; whether any verifier service or Edge Function calls the verification functions (the deployed `ai`, `jobs`,
  `verify-cert` functions were not downloaded or compared).
- Auth settings (whether users can edit `user_metadata`), the Nginx Proxy Manager headers, Supabase backups and retention settings.
- Row counts: whether legacy `resume_scans` rows exist, whether any `evidence` rows exist.
- Whether any F-1…F-10 behaviour is reproducible; none was tested.


## 7. Update: complete catalog export and schema dump (2026-10-09, later the same day)

The owner ran `docs/database/evidence/export-catalog.sh` (12 JSON files, `supabase db query --linked`, SELECT only) and `supabase db dump --linked --schema public` (structure only; checked:
no `COPY`/`INSERT`, no keys). Nothing is truncated any more. Class: **CONFIRMED IN PRODUCTION** for the catalog; the dump is a file of structure, not a runtime observation.

| Item | Result |
|---|---|
| Size of the schema | 27 tables (RLS on all, none forced), 317 columns, 44 policies on 26 tables, 124 constraints, 21 trigger rows, 18 functions, 52 indexes, 2 views |
| Functions | the 16 read earlier plus `purge_raw_credential` (SECURITY DEFINER, not executable by `anon`/`authenticated`/`public`) and `touch_updated_at` (trigger, harmless). Every function matches what was assumed; `recompute_trust_score` still uses `MAX` and `COALESCE(..., 0)` |
| Local replica | a local Supabase stack restored from the dump equals the export on all 9 compared points (see `docs/database/staging/LOCAL.md`) |
| Earlier statements | nothing in sections 2-4 changed. The earlier partial reads were accurate |

### New finding F-13: a database role `gtm_readonly` with SELECT on every table
- **CONFIRMED IN PRODUCTION (dump):** the role `gtm_readonly` has `USAGE` on schema `public`, `SELECT` on all 27 tables and views (including `user_memory`, `profiles`, `resume_scans`, `evidence`, `consents`,
  `candidate_trust_profiles`, `trusted_issuers`), and `ALTER DEFAULT PRIVILEGES ... GRANT SELECT ON TABLES TO gtm_readonly`, so every future table is readable too.
- **CONFIRMED IN REPOSITORY:** nothing in the repository or its git history creates or mentions this role (the only "gtm" strings are in two HTML documents, presumably "go-to-market").
- **CONFIRMED IN PRODUCTION (role attributes, read with `supabase db query --linked` from `pg_roles`, 2026-10-09):** `rolcanlogin = true`, **`rolbypassrls = true`**, `rolsuper = false`,
  `rolinherit = true`, `rolconnlimit = 5`, `rolvaliduntil = null` (the login never expires). The other login roles are `postgres`, `authenticator`, `pgbouncer` and `cli_login_postgres`
  (the last one is created by the Supabase CLI for its own sessions); `anon`, `authenticated`, `dashboard_user` and `service_role` cannot log in.
- **Consequence (CONFIRMED by combining the two facts above):** anyone who holds the credentials of `gtm_readonly` can connect to the database directly and read every row of every table, including
  resume text in `user_memory`, `profiles`, `consents` and `evidence`, **without passing any RLS policy**. None of the fixes S1-S3 limits this role, because they change policies and row-level
  rules and this role ignores them.
- **UNKNOWN:** who created it and for what (the connection limit of 5 and the default privileges look like a reporting or analytics tool being onboarded), who or what holds its password, whether
  it is used today, from which addresses, and whether the password was ever shared. Not established from the repository or the catalog.
- **INFERRED RISK:** a standing read-everything credential held by a tool or person outside the application.
- **To establish next (read-only):** the owner asks who created `gtm_readonly` and which tool uses it; the Postgres logs in the Supabase dashboard (Logs, filter `gtm_readonly`) show recent
  connections and their addresses (retention depends on the plan); `select usename, application_name, client_addr, state, backend_start from pg_stat_activity where usename = 'gtm_readonly'`
  shows live sessions. Whatever is decided (keep, restrict, rotate, disable) is the owner's decision and is not part of S1-S3.
- **Options for the owner, none applied:** (1) if nobody needs it: `alter role gtm_readonly nologin` is reversible and does not affect the application, which connects through the API roles;
  (2) if a tool needs it: rotate its password, remove `BYPASSRLS`, and give it a narrower source (aggregate views without personal data) instead of `SELECT` on every table;
  (3) in every case review who holds the credential. Because the role can read personal data, treat "who has had access" as a privacy question as well as a security one.

### F-13 status: resolved on 2026-10-09 (owner action)
- **Origin established (CONFIRMED on the owner's machine):** the role was created by the owner around 2026-09-30 for the go-to-market workspace of another product (ZenDMS, folder `gtm/`), whose
  configuration connects as `gtm_readonly.obtmsvhejvcfrkfyucev` (a different Supabase project from this one, `ruibdsvrcctxgxctaxwe`). Nothing found on the machine pointed the role at this project; the
  copy here is most likely a creation run against the wrong project (not proven).
- **Action (owner, SQL Editor of this project):** `alter role ... nologin`, `grant gtm_readonly to postgres` (needed for `drop owned by`), `drop owned by gtm_readonly`, `drop role gtm_readonly`.
- **Verified (owner, CLI, read-only):** `select count(*) from pg_roles where rolname = 'gtm_readonly'` returned 0 on this project. The ZenDMS project was not touched.
- **Still worth doing:** re-run `export-catalog.sh` and keep the new export as the baseline; confirm that no default privilege still names the role
  (`select count(*) from pg_default_acl where defaclacl::text like '%gtm_readonly%'` should be 0).
