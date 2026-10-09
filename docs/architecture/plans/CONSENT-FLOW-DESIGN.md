# Design: candidate consent flow (prerequisite for S3)

Status: **design, revised after the owner's review of 2026-10-09. Conditionally approved in direction; nothing here is approved for implementation or for real users.**
No application code, database object or user-facing text from this document is live. The database enforcement it depends on is
`docs/database/proposed/2026-10-09-consent-only-recruiter-access.sql` (S3, merged to `main` as a **proposed script, not applied**).
Evidence classes as in `docs/architecture/EVIDENCE_RESULTS_2026-10-09.md`.

Principle (owner review): the consent flow and the database enforcement are **one design**. The screens must never claim more than the database enforces, and
the enforcement must be proven before any real candidate sees the flow.

## 1. What exists

| Fact | Class |
|---|---|
| `consents` table with owner policies: the candidate may INSERT (employer, scope, purpose, expiry), SELECT own rows, and UPDATE `revoked_at` only; a consent cannot be edited; expiry at most 365 days; purposes `recruiter_review`, `matching`, `verification_share`; `scope` must be `{"parts":[...]}` | PRODUCTION (policies 1.3, privileges 1.4, constraints 1.8, `consents_guard` 1.6) |
| Column privileges for `authenticated` on `consents`: INSERT `employer_id, expires_at, purpose, scope`; UPDATE `revoked_at`; the candidate id is set by the database | PRODUCTION |
| No UI or code writes or reads `consents` | REPOSITORY (grep) |
| `src/lib/supabase.js` has `select`, `insert`, `upsert`, `delete` and, in the open PR `feat/client-update-rpc-helpers`, `update` and `rpc` | REPOSITORY |
| The candidate job list (`TrustMatch.jsx`) reads `job_listings`, which has no employer name; the code reads `job.employer_name` and falls back to "Employer"; `employers` is readable only by its owner | REPOSITORY + PRODUCTION |
| "I'm interested" is local React state; nothing is saved | REPOSITORY |
| The Employer Portal loads candidates by a direct `select` on `candidate_trust_profiles` ordered by `trust_score` | REPOSITORY (`EmployerPortal.jsx:764`) |
| `employer_view_candidates` and `employer_has_consent`: the SQL is in the S3 script (`docs/database/proposed/2026-10-09-consent-only-recruiter-access.sql`); 80 replica checks in `docs/database/replica-test/s3-consent-only-access.mjs` | REPOSITORY (proposed, replica-tested only) |

## 2. Decisions on record (owner, 2026-10-09)

| Question | Decision |
|---|---|
| Entry point | A separate button "Share my profile with {employer}". "I'm interested" stays a local signal and never opens the consent dialog |
| Default expiry and parts | 90 days. `profile` always; `salary` as an opt-in checkbox, **off** by default. Renewal is an explicit new consent; there is no automatic renewal |
| Employer display | Only what is needed to identify the receiver: the employer name (and its id for the request). No website or other employer fields |
| Legal wording | Reviewed before the flow is used with real candidates or recruiters. Until then, internal testing with fake data only |
| Feature flag | `VITE_CONSENT_FLOW`, default off; it stays off for real users until Gate F |

## 3. Fail-closed rule (replaces the earlier fallback)

**The Employer Portal must never fall back to the old query.** If `employer_view_candidates` is missing, returns a permission error, or fails for any other reason,
the Portal shows an error state and **no candidate list**. It does not read `candidate_trust_profiles` directly under any condition. Consequences:
- The Portal change ships only together with, or after, S3 on the same database. Until then the consent flow stays off and the Portal keeps today's behaviour,
  which is a separate, known issue (finding F-4), not something a fallback may emulate.
- Rolling back code must not restore access without consent. If S3 is applied, a code rollback leaves the database policy in force. Restoring the old policy is
  a separate, owner-approved database step (the S3 down script), never a side effect of reverting the application.

## 4. Database contract the screens rely on

### 4.1 Reading a candidate (recruiter)
`employer_view_candidates(p_employer_id, p_candidate_id)` is the only recruiter read path. The employer id sent by the client is **never trusted**: the function
checks that the signed-in user is a member of that employer (`is_verified_employer_member`) and that the employer is verified. A consent must belong to that
candidate and that employer, have purpose `recruiter_review`, be unrevoked and unexpired, and list the part. Tested (S3 test): other employer's id, unverified
employer, null or unknown employer, token without a user id, another candidate's consent, expired and revoked consents.

### 4.2 Parts and columns (the mapping that governs the response)

| Consent part | Columns returned | Notes |
|---|---|---|
| `profile` (required for any row) | `user_id, full_name, headline, bio, skills, location, work_preference, consented_parts, consent_expires_at` | the recruiter sees nothing unless `profile` is consented |
| `salary` | `salary_min, salary_max, currency` | NULL unless `salary` is consented |
| Resume text, email, credentials, practice scores | **never returned** | not part of this consent; not in the function's column list |
| Any other part (`evidence`, `email`, ...) | **nothing** | stored but unsupported: default deny. A new column or part is added only by a reviewed change of the function and this table |

The exact column list is asserted by a test, so a new column cannot appear in the response because a consent already exists.

### 4.3 Granting
`sb.insert('consents', { employer_id, scope: { parts }, purpose: 'recruiter_review', expires_at })`. Never send `candidate_id`. The database rejects an unknown
purpose, a scope without `parts`, an expiry beyond 365 days or in the past (tested). The UI shows "Shared" **only after the database returns the new row**.

### 4.4 Stopping sharing (one request per employer)
"Stop sharing with {employer}" is one request, not a loop over rows:
`sb.update('consents', { employer_id: 'eq.<id>', revoked_at: 'is.null' }, { revoked_at: <now> })`.
- It revokes every consent of that employer that is not yet revoked (including ones already expired), in one statement; a second call changes nothing and does not fail.
- The `revoked_at is null` filter is part of the contract: without it the statement fails on a row that is already revoked (tested), and `sb.update` refuses to run without any filter.
- The database restricts the candidate to their own rows and to the column `revoked_at`; scope, purpose, employer, expiry and owner cannot be changed, and a revocation cannot be undone (tested).
- The UI shows "Stopped" **only after the response lists the revoked rows**; on error it keeps the consent shown as active.
- After revocation the next recruiter read is refused on every protected path: the function, the base table, the helper, new matches, new pipeline entries (tested).

### 4.5 Listing open jobs with the employer name
`list_open_jobs(p_limit)` (proposed script in `fix/s3b-open-jobs-with-employer-v2`) returns open jobs of **verified** employers with the employer id and name. Every job column it
returns is already readable by signed-in users through the existing policy and privilege; the only new information is the employer name. The exact column list is
tested, anonymous access is blocked by two independent guards (revoked EXECUTE, and the `auth.uid()` condition), each tested alone. Whether job salary ranges should be
visible to all signed-in users is an existing, separate question for the owner.

## 5. Screens

1. **Job card (TrustMatch).** Beside the existing buttons, "Share my profile with {employer name}". The dialog shows:
   - who receives it ("{Employer name} will be able to see:");
   - the exact fields released for the chosen parts (table in 4.2), and a line that resume text, email, credentials and practice scores are **not** shared;
   - the checkbox "Also share my expected salary range" (off);
   - the expiry as a date;
   - "Share" and "Cancel"; no pre-ticked consent and no bundled consent.
   On success the card shows "Shared until {date}" and "Stop sharing". On error nothing is shown as shared.
2. **My sharing.** Active consents per employer with parts and expiry, "Stop sharing" per employer; expired and revoked under History; an empty state says nothing is shared.
3. **Employer Portal.** Candidates come only from `employer_view_candidates`; no ordering by `trust_score`; no practice scores; empty state "Candidates appear here after they choose to share their profile with you."; error state on any failure (section 3). Sample pages and their banner stay as they are.
4. **Wording** is a placeholder in this design. User-facing text says "designed with Singapore PDPA requirements in mind", never "PDPA compliant".

## 6. Gates (each is its own PR or step; nothing reaches production without owner approval)

| Gate | Content | Evidence required |
|---|---|---|
| PR A | Client helpers `sb.update`, `sb.rpc` and tests; no access change | unit tests (done in the open PR) |
| PR B | `list_open_jobs`: reviewed SQL, narrowed response, permission tests; applied only after its own approval | replica tests; then a check on the real database |
| PR C | Consent UI (dialog, My sharing, history, stop sharing) behind the flag; fake data only | component tests with a mocked client: exact request bodies, salary off by default, no candidate id sent, success only after the response, failure keeps state, flag off renders nothing |
| PR D | Employer Portal on `employer_view_candidates`, **fail-closed**; test that an RPC error or missing function shows an error and issues no direct query on `candidate_trust_profiles` | component tests; static test that the Portal source has no direct read of that table |
| Gate E | Staging acceptance with real Supabase and test accounts: grant, correct fields, cross-candidate and cross-employer attempts through the REST API directly, revoke, expiry, every later read refused | recorded results |
| Gate F | Production: security review, legal wording, rollback plan, S3 applied and verified; flag on for a small group first | owner sign-off |

## 7. Tests required (in addition to the database matrix already in `s3-consent-only-access.mjs`)

- Client: fresh token, method, URL and body for `update` and `rpc`; `update` refuses to run without a filter (done).
- UI (PR C): dialog content per part; request body exact; salary off by default; a failed insert shows nothing shared; a failed revoke keeps the consent active; flag off.
- Portal (PR D): RPC error and missing function produce an error state; no `candidate_trust_profiles` request is made; the list shows no practice score.
- Database (done on the replica, to be repeated on staging): cross-candidate access, recruiter access to consents, no edit of scope or employer, invalid consents rejected, one-request revocation, all protected paths closed after revocation, exact column list.
- Real database (Gate E): the same attacks through the REST API, since the replica is not production.

## 8. Not in this design
Employer-initiated consent requests, notifications before expiry, the `evidence` and `matching` parts, TrustChat access, consent for verification sharing, cleanup of existing
`trust_matches`/pipeline rows on revocation (they hold ids, status and the recruiter's own notes, and stay visible to their employer), and the legal text itself.
