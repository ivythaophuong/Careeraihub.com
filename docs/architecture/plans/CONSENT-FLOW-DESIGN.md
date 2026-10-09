# Design: candidate consent flow (prerequisite for S3)

Status: **design for owner review. No application code, database object or user-facing text from this document is live.**
Context: owner decision of 2026-10-09, recruiters read a candidate only with that candidate's consent. The database change that enforces it is
`docs/database/proposed/2026-10-09-consent-only-recruiter-access.sql` (S3, not applied). Applying S3 without this flow empties every recruiter
candidate view, because the app has no way to create a consent today. Evidence classes as in `EVIDENCE_RESULTS_2026-10-09.md`.

## 1. What exists (CONFIRMED IN REPOSITORY / IN PRODUCTION)

| Fact | Class |
|---|---|
| `consents` table with owner policies: candidate may INSERT (employer, scope, purpose, expiry), SELECT own, and UPDATE `revoked_at` only; a consent cannot be edited; expiry at most 365 days; purposes `recruiter_review`, `matching`, `verification_share`; `scope` must be `{"parts":[...]}` | PRODUCTION (1.3, 1.4, 1.8, `consents_guard`) |
| Column privileges for `authenticated` on `consents`: INSERT `employer_id, expires_at, purpose, scope`; UPDATE `revoked_at`; the candidate id is set by the database | PRODUCTION (column privileges) |
| No UI or code writes or reads `consents` | REPOSITORY (grep) |
| `src/lib/supabase.js` has `select`, `insert`, `upsert`, `delete` but **no `update` and no `rpc`** | REPOSITORY |
| The candidate's job list (`TrustMatch.jsx`) reads `job_listings`, which has **no employer name column**; the code reads `job.employer_name` and falls back to "Employer". `employers` is readable only by its owner | REPOSITORY + PRODUCTION (1.2, 1.3) |
| "I'm interested" is local React state; nothing is saved | REPOSITORY |
| The Employer Portal loads candidates with a direct `select` on `candidate_trust_profiles` ordered by `trust_score` | REPOSITORY (`EmployerPortal.jsx:764`) |

## 2. Defaults taken (from the plan's recommendations; owner may change any of them)

| Choice | Default |
|---|---|
| Entry point | An explicit button on a job card, "Share my profile with {employer}", separate from "I'm interested". Interest stays a local signal; sharing data is its own deliberate act |
| Purpose | `recruiter_review` |
| Parts offered | `profile` (always, it is what the recruiter sees: name, headline, bio, skills, location, work preference) and `salary` (a checkbox, **off** by default) |
| Expiry | 90 days (database maximum 365) |
| Scope of one consent | one employer; a candidate may have several consents per employer; "Stop sharing" revokes all active ones for that employer |
| Feature flag | `VITE_CONSENT_FLOW`, default off. Nothing in the UI changes until it is on |

## 3. Candidate screens

1. **Job card (TrustMatch).** Under the existing buttons, "Share my profile with {employer name}". Opens a dialog:
   - Title: who will see it ("{Employer name} will be able to see:").
   - A plain list of exactly the fields released for the chosen parts, and a line saying what is **not** shared (resume text, email, practice scores, credentials).
   - Checkbox "Also share my expected salary range" (off).
   - Expiry shown as a date ("until 7 Jan"), not as a number of days only.
   - Buttons "Share" and "Cancel". No pre-ticked consent, no bundled consent.
   - On success: card shows "Shared until {date}" and "Stop sharing". On error: the message, nothing is shown as shared.
2. **"My sharing" list** (a section of TrustMatch): employers with active consents, parts, expiry, "Stop sharing" per employer; expired and revoked entries under "History". An empty state says nothing is shared.
3. **Wording** is a placeholder in this design and **needs legal review before the flag is turned on** (contracts: legal review before Phase 4B). User-facing text says "designed with Singapore PDPA requirements in mind", never "PDPA compliant".

## 4. Employer Portal changes (separate PR)

- Candidates come from `employer_view_candidates(employer_id)`; no direct `select` on `candidate_trust_profiles`; no ordering by `trust_score`; the practice score is not shown.
- Empty state: "Candidates appear here after they choose to share their profile with you."
- Until S3 is applied the function does not exist. The Portal first tries the function and, if the database reports it missing, falls back to today's query; the fallback is removed once S3 is live.
- The sample-data banner and sample pages stay as they are.

## 5. API and database pieces

| Piece | Kind | Notes |
|---|---|---|
| `sb.update(table, filters, data, token)` and `sb.rpc(name, args, token)` | client helpers, additive | same fresh-token behaviour as the other helpers; unused until the UI lands. PR `feat/client-update-rpc-helpers` |
| `list_open_jobs(limit)` | new database function | returns open jobs of **verified** employers together with `employer_name` and `website`, for signed-in users only. Needed so a candidate can see who they are sharing with. Additive; SQL + replica test in `fix/s3b-open-jobs-with-employer` (proposed, not applied). Owner decision: employer names visible to signed-in candidates (they are job postings) |
| Consent insert | existing table | `sb.insert('consents', { employer_id, scope: { parts }, purpose: 'recruiter_review', expires_at })`; never send `candidate_id` |
| Revoke | existing table | `sb.update('consents', { id: 'eq.<id>' }, { revoked_at: <now> })` (the database stamps the time) |
| List | existing table | `sb.select('consents', { order: 'granted_at.desc' })` (RLS limits to own rows) |

## 6. Rollout order (each step is its own PR; nothing is applied to production without owner approval)

1. Client helpers (inert).
2. `list_open_jobs` applied (additive, no existing behaviour changes).
3. Consent UI behind the flag, tested; legal review of wording; then flag on for testers. Consents are created but nothing reads them yet.
4. Employer Portal switches to the function with the fallback.
5. Apply S3 on a staging project first, then production; remove the fallback.
Revocation before step 5 has no effect on recruiter access (nothing enforces consent yet): the UI must not claim otherwise until S3 is live. The flag stays off for real users until step 5 is approved, or the dialog says what is true at that time.

## 7. Tests required

- Unit/component (Vitest, mocked `sb`): the dialog lists the fields for the chosen parts; salary off by default; Share sends exactly `{employer_id, scope, purpose, expires_at}` (no candidate id); success and failure states; "Stop sharing" patches only `revoked_at` for that employer's active consents; the flag off renders nothing new.
- Client helpers: fresh token, method, URL and body for `update` and `rpc`, error mapping.
- Database (replica): `list_open_jobs` shows only open jobs of verified employers, hides unverified ones, requires sign-in, never returns `posted_by`.
- Manual (staging): grant, see in "My sharing", recruiter reads through the function, revoke, recruiter reads nothing.

## 8. Not in this design
Employer-initiated consent requests, notifications before expiry, the `evidence` and `matching` parts, TrustChat access, consent for verification sharing, the cleanup of existing `trust_matches`/pipeline rows on revocation, and the legal text itself.

## 9. Questions for the owner
1. Is a separate "Share my profile" button the right entry point (recommended), or should "I'm interested" trigger the dialog?
2. Are 90 days and the two parts (`profile`, `salary`) right?
3. May employer names of verified employers with open jobs be shown to every signed-in candidate?
4. Who reviews the wording, and when (before the flag is on for anyone but testers)?
