# SQL proposal (S1): server-owned practice sessions, submissions and AI request ledger

Status: **PROPOSAL DOCUMENT. Nothing here is executable, nothing was run, nothing is applied.** The SQL blocks are a draft of intent. After the owner approves the design they become a `.sql` and `.down.sql` pair, run on the in-memory replica (S2), and only then applied by the owner by hand (S3).
Written 2026-10-13 for the product owner. Plan: `docs/architecture/plans/PLAN-mock-interview-e2e.md` track S. Facts: `docs/audits/MOCK-INTERVIEW-E2E-PHASE0-AUDIT-2026-10-13.md`.
Labels: VERIFIED · UNKNOWN · PROPOSED · APPROVAL.

## 1. Why the current schema is not enough

| Need | Today | Why it fails |
|---|---|---|
| Session identity, stored question set | none; questions live in React state | R3 (questions unsigned), no resume, no history review |
| Idempotent submission, one counted attempt per question | `mock_sessions` has `user_id, mode, questions_count, avg_score` only | R2 (re-grade and keep the best), R4 (same graded answers saved again; count-then-insert is not atomic) |
| Atomic per-user budget and concurrency | in-memory limiter, per instance | R1, no shared state across instances or tabs |
| Reconciling a request whose outcome is unknown | usage log lines only, tokens recorded on success only | cost of failed or timed-out attempts is invisible |
| Reuse by other AI features | none | `ai` consumers (17 labels) need the same gate; the ledger must not be Mock Interview specific |

`mock_sessions` stays as it is: it is what the trust trigger reads. Nothing in this proposal changes it, its triggers, or `candidate_trust_profiles`.

## 2. What must be read before the final SQL (UNKNOWN today)

The repo has no migrations, so these are read by the owner with read-only queries in the SQL Editor, one at a time, before S2:
1. Columns, types, defaults and constraints of `mock_sessions` (to link to it correctly).
2. Its foreign keys and indexes, its RLS policies and current grants for `anon`, `authenticated`, `service_role`.
3. How rows are removed when an account is deleted (the S1 delete trigger guards `auth.users`).
4. That `pgcrypto`/`gen_random_uuid()` is available (Phase 1 uses it: VERIFIED in `001_phase1_foundation.sql`).

## 3. Design (PROPOSED)

All new, additive. No existing table or column is changed. No numeric limit appears in SQL: limits live in rows the owner approves.

### 3.1 Tables

```sql
-- DRAFT, NOT EXECUTABLE. Versioned limits. No row = observe only (see section 5, decision D-2).
create table public.ai_policies (
  version        int primary key,
  effective_from timestamptz not null,
  limits         jsonb not null,   -- e.g. per-user daily request/token caps, per-session caps, concurrent requests, per-request input/output caps. VALUES SET BY THE OWNER.
  note           text
);

create table public.practice_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  persona         text not null,
  role            text not null default '',
  status          text not null default 'in_progress' check (status in ('in_progress','completed','abandoned')),
  questions       jsonb not null,            -- the stored set: [{index, question, focus, why, hash}]
  question_set_version int not null default 1,
  policy_version  int references public.ai_policies(version),
  mock_session_id uuid unique,               -- set once, when the average is written to mock_sessions
  created_at      timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at    timestamptz
);
create index practice_sessions_user on public.practice_sessions (user_id, created_at desc);

create table public.practice_submissions (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.practice_sessions(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  question_index int not null,
  question_hash text not null,
  revision      int not null default 1,
  is_counted    boolean not null default false,   -- the first graded attempt of the question
  -- no answer_text column: decision D-3 = option C (2026-10-13), the original answer is not stored on the server
  answer_hash   text not null,                 -- hash of the normalised answer: dedup and "same payload" checks only; never reversible content
  answer_chars  int  not null check (answer_chars between 1 and 3000),   -- 3000 = MAX_ANSWER_CHARS in code today
  status        text not null check (status in ('received','evaluating','evaluated','failed','unknown')),
  feedback      jsonb,                         -- worked / missed / tip / outline as normalised by code. Persisted feedback must not contain verbatim quotes of the answer (see section 6)
  score         int check (score between 0 and 100),   -- null = not evaluated; never 0 for "missing"
  request_id    uuid,                          -- the ai_requests row that produced it
  created_at    timestamptz not null default now(),
  unique (session_id, question_index, revision)
);
-- The database itself enforces "one counted attempt per question" (closes R2 for the stored path):
create unique index practice_one_counted on public.practice_submissions (session_id, question_index) where is_counted;

create table public.ai_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  feature         text not null,                 -- server-set, not trusted from the browser
  session_id      uuid references public.practice_sessions(id) on delete set null,
  idempotency_key text not null,
  payload_hash    text not null,                 -- hash only; never the content
  state           text not null check (state in ('reserved','started','completed','failed','cancelled','unknown_pending')),
  reserved_tokens int  not null default 0,
  input_tokens    int, output_tokens int, thinking_tokens int,   -- null = provider reported nothing
  provider        text, model text,
  policy_version  int,
  correlation_id  uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  settled_at      timestamptz,
  unique (user_id, idempotency_key)
);

create table public.user_usage_windows (
  user_id         uuid not null references auth.users(id) on delete cascade,
  window_start    date not null,
  requests        int  not null default 0,
  reserved_tokens bigint not null default 0,   -- held for requests not yet settled
  settled_tokens  bigint not null default 0,
  primary key (user_id, window_start)
);
```

No table stores a prompt, a CV, the provider's raw reply or the original answer (decision D-3, section 6). `feedback` is the only practice content kept, and it holds no verbatim quotes of the answer.

### 3.2 Functions (service role only; `security definer`, fixed `search_path`, like `recompute_trust_score`)

- `reserve_ai_request(user, key, payload_hash, feature, session, est_tokens, policy_version)`
  1. take a per-user transaction lock (`pg_advisory_xact_lock`) so competing requests of one user are serialised (this is what makes tabs and devices share one limit);
  2. if `(user, key)` exists: same `payload_hash` returns the existing row (no new billable work); a different hash raises `idempotency_conflict`;
  3. otherwise check, inside the same transaction, the active policy: concurrent requests (state `reserved`/`started`), this window's `requests` and `reserved_tokens + settled_tokens`, the session's total; any breach returns `limit_reached` and writes nothing that costs;
  4. insert the request (`reserved`) and increment the window counters.
- `mark_started(id)`, then exactly one of `settle_ai_request(id, 'completed' | 'failed' | 'cancelled', usage…)`. A second settle of a settled request is a no-op that returns the stored state (duplicate callbacks safe). Settling replaces the reservation by actual tokens; if the provider gave no usage, the reservation stays as the charge (conservative) and the row is flagged by `input_tokens is null`.
- `mark_unknown(id)`: sets `unknown_pending`. This **releases the concurrency slot** (the server knows it has stopped waiting) but **keeps `reserved_tokens`** (ADR-012 Approach B).
- `expire_unknown_requests(older_than)`: settles old `unknown_pending` rows at their reserved amount. The age bound is a policy value the owner chooses.
- `complete_practice_session(session, user)`: in one transaction, requires the counted submissions, computes the average **in the function**, inserts the `mock_sessions` row once (guarded by `practice_sessions.mock_session_id` unique and a row lock), sets `completed`. A second call returns the same `mock_session_id` (closes R4 for the stored path). The existing trust triggers then fire exactly as today.

### 3.3 Row level security and grants

- RLS on in all five new tables.
- `authenticated`: `select` own rows only (`user_id = auth.uid()`); on `practice_sessions` and `practice_submissions` also `delete` own rows (so "Clear memory" can erase answers). No `insert` or `update` for `authenticated` or `anon` on any new table. `ai_requests` and `user_usage_windows`: select own only, no delete (the cost ledger is not user-editable; it is removed only by the account-deletion cascade).
- `anon`: nothing.
- Functions: `execute` revoked from `public`, `anon`, `authenticated`; granted to `service_role`. The Edge Functions already hold the service role (as `score-interview` does).
- Same pattern as S4 (server-only writes) and the Phase 1 tables (owner-scoped RLS).

## 4. Compatibility and rollout order

1. Apply the SQL (additive, unused by the live code): nothing changes for users.
2. Deploy new Edge Function code with the server-side flag **off**; old `evaluate`/`save` with signed receipts remain the live path.
3. Enable the flag in a non-production project first (UNKNOWN: whether a staging project exists; owner confirms), then for the owner's account in production, then wider, only with explicit approval.
4. Existing `mock_sessions` rows are untouched; there is no backfill. Old sessions have no stored answers, so history review applies to new sessions only (stated in the UI).
5. Clients without the new code keep working during the rollout because the old path stays until a later, separately approved removal.

## 5. Rollback and forward recovery

- First action: turn the flag off. This stops creating stored sessions and does **not** undo provider usage or written rows.
- Requests already accepted keep their protections: `settle`/`expire` functions stay deployed until in-flight rows reach a terminal state.
- Undo script (`.down.sql`): drops the new functions and tables in reverse order. **Data-loss warning:** it deletes stored sessions, answers and the cost ledger; export first if any real use occurred. Because nothing existing depends on the new tables, the down script is safe before the flag is ever enabled.
- No existing column or table is dropped or renamed.

## 6. Privacy and retention: DECIDED 2026-10-13, option C (owner)

**Decision D-3 = C:** the original answer text is **not stored on the server** in this first version. The server keeps: the question set, session status and progress, per-question feedback and score, and a hash and length of each answer. Reasons (owner): privacy by default, practice is a place to learn, not a career record.

| Data | Where | Handling |
|---|---|---|
| Answer being typed | this device only (`sessionStorage`, already built in PR 2a) | restored on the same tab; lost when the tab closes or on another device |
| Submitted answer text | not stored server-side | exists in the request to the Edge Function and in what is sent to the AI provider (below) |
| Feedback and score | `practice_submissions.feedback`, `score` | kept for practice history until the user deletes it; **feedback must not contain verbatim quotes** of the answer |
| Session progress | `practice_sessions` (status, current question, which questions have feedback) | enough to continue on another device from the saved state; typed text that was never submitted cannot be restored there |
| Cost ledger | `ai_requests`, `user_usage_windows` | hashes, counts and tokens only; removed with the account |
| Delete | `delete` policy on sessions and submissions (cascade) | removes feedback, scores and progress; the ledger rows stay until the account is deleted (they hold no content) |

Consequences to write in the product, not hide: "review your practice" shows feedback and scores, not the original answer; an interrupted evaluation after the answer left the device needs the user to send the answer again (the device draft keeps it); a **evidence quote** field in feedback (contract section 4.2 asks for "relevant answer evidence") conflicts with C if persisted. **Resolution (PROPOSED, needs confirming):** show quotes only in the live response, verified by code to occur in the answer; persist the feedback without them. The retention rule for feedback, scores and session metadata is still to be written: until the owner states a period they are kept until the user deletes them (option A semantics for these low-sensitivity fields), and the policy must say so.

Still to verify before release (owner's three checks, adopted):
1. **Draft recovery:** closing and reopening the tab restores the typed answer (device storage; A1 has tests for same-tab recovery; to be repeated on the live build).
2. **Data boundary:** the original answer must not appear in logs, helper tables or anywhere else. Code check plan: grep of server handlers and a test asserting that log lines and ledger rows contain no answer text; the existing `[usage]` lines already carry none.
3. **Deletion:** deleting history removes feedback, scores and session rows, and the written policy matches what is deleted.
**Provider boundary (open, UNKNOWN):** the answer text is sent to the AI providers (Gemini and Groq) on their **free tiers**. Free tiers may allow the provider to use submitted content for service improvement; I recall this for Google's free Gemini API but have not verified the current terms of either provider. This affects what the Privacy page may promise ("not stored by CareerAiHub" is true; "not used by anyone" is not established). Needs the owner to read both providers' current data-use terms before the Privacy wording is written.

If users later ask to re-read their own answers, add option B (owner-chosen retention period with a purge job and a notice before enabling); not part of this version.

## 7. Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| D-1 | Approve the five-table design (or ask for fewer; `user_usage_windows` could be derived from `ai_requests` at the cost of slower checks) | approve as drafted |
| D-2 | With no policy row, the gate **observes only** (records, does not block) until the owner approves limit numbers | yes; avoids inventing numbers and avoids blocking everyone |
| D-3 | Retention | **DECIDED: C** (owner, 2026-10-13); see section 6 |
| D-4 | Upper bound after which `unknown_pending` is settled at the reserved amount | owner's choice after seeing measured usage |
| D-5 | Cascade removal of the ledger on account deletion | yes |
| D-6 | Whether the future "challenge" (untimed, timed) and "interaction" (text, voice) are columns now or a later additive migration | later; avoid unused columns |

## 8. Replica test plan (S2; every case must fail on the absence of the feature)

Run in `docs/database/replica-test/` style (in-memory Postgres), a new `s5-practice-ledger.mjs`:
1. **Concurrency:** N parallel `reserve_ai_request` for one user with the remaining capacity for K < N; exactly K succeed, N−K get `limit_reached`; the counters equal K reservations. Repeat across two "tabs" (two sessions).
2. **Idempotency:** same key and same hash twice returns one row and one reservation; same key with a different hash raises `idempotency_conflict`.
3. **Settlement:** settle twice is a no-op; actual below and above the reservation; missing usage keeps the reservation; rounding.
4. **Unknown outcome:** `mark_unknown` frees the slot but not the tokens; `expire_unknown_requests` settles at the reserved amount; exposure never exceeds `reserved` across repeated unknowns.
5. **First attempt:** inserting a second `is_counted` submission for one question fails; a retry as `revision 2, is_counted false` succeeds.
6. **Complete once:** two `complete_practice_session` calls (also in parallel) create one `mock_sessions` row; the trust trigger result equals the old path for the same scores; a session with an unevaluated question is not scored as 0.
7. **RLS:** user A cannot select, update or delete user B's rows; `authenticated` cannot insert or update any new table; `anon` sees nothing; users can delete their own sessions and submissions but not ledger rows.
8. **Privileges:** `authenticated` and `anon` cannot execute the functions; `service_role` can.
9. **Account deletion:** cascades, and the S1 delete-trigger guard still behaves.
10. **No regression:** the existing replica suites (`run.mjs`, `s0` to `s3b`, `score-metadata.mjs`) still pass unchanged.

## 9. Not covered by this document

Edge Function code (S4, S5), UI, voice, the price table, any limit number, recruiter access, the Trust Score. Each has its own step in the plan.

## 10. Read-only findings so far (owner, 2026-10-13)

`mock_sessions` columns (production): `id uuid not null default gen_random_uuid()`; `user_id uuid` **nullable**; `mode text` nullable; `questions_count integer` nullable; `avg_score integer` nullable; `created_at timestamptz` nullable, default `now()`. This matches the code's known columns; no column for challenge type, session id or source. Consequences for the draft: `user_id` and `created_at` may be null on old rows, so the new link `practice_sessions.mock_session_id` must not assume them; `recompute_trust_score` orders by `created_at desc` and ignores rows with a null `avg_score` only through `AVG` (null-safe), unchanged. Foreign keys, indexes, policies and grants: still to read (queries 2 and 3).

### 10.1 Constraints, indexes and policies of `mock_sessions` (owner, 2026-10-13)

- Primary key `id`. Check `mock_sessions_score_range` (`avg_score` 0 to 100) is **NOT VALID**: it applies to new and changed rows, old rows were not checked (matches README). Foreign key `user_id → auth.users(id) ON DELETE CASCADE` (so account deletion already cascades; supports decision D-5).
- **Only one index: the primary key.** There is no index on `(user_id, created_at)`, although the app loads the newest 20 per user and `recompute_trust_score` reads the newest 5 per user on every insert and delete. Fine at today's size (7 profiles); PROPOSED: add `create index if not exists mock_sessions_user_recent on public.mock_sessions (user_id, created_at desc)` as an additive step in the same migration, to be confirmed on the replica. This is an additive performance change, not required for correctness.
- One policy: `Users can manage their own mock sessions`, `ALL`, `auth.uid() = user_id`, no separate `with_check`. Insert and update from the browser are blocked by revoked privileges (S4), not by the policy; the policy itself still allows them in principle. The new tables must not rely on a broad `ALL` policy: they use `select` (and `delete` where stated) only.
- Still to read: current grants (query 3).

### 10.2 ALERT: table privileges on `mock_sessions` do not match the 2026-10-09 record (owner query, 2026-10-13)

`has_table_privilege` returned **true for SELECT, INSERT, UPDATE and DELETE for `anon`, `authenticated` and `service_role`**. `docs/database/README.md` (S4, applied 2026-10-09) records `authenticated` INSERT=false and UPDATE=false after the revoke. Possible explanations, none verified: the revoke was undone or overwritten later (a grant, a table recreation, default privileges), the 2026-10-09 check and today's differ in method, or the privilege comes from a source the revoke did not touch (for example a grant to `PUBLIC`). If INSERT and UPDATE are really open to `authenticated`, the policy `auth.uid() = user_id` (ALL) lets any signed-in user insert or edit their own `mock_sessions` rows with any `avg_score` 0 to 100, and the recompute trigger turns that into `interview_score` and `trust_score`: finding F-1 would be open again. Exposure today: no verified employer exists, so no recruiter reads the score; the integrity of the score is still affected. `anon` is stopped by the policy (no `auth.uid()`), if the policy is the only barrier. Next: read the real ACL and the same for `star_stories` and `resume_scans`; no change is made until the owner decides.

### 10.3 CONFIRMED: the S4 revoke is not in effect on production (owner ACL query, 2026-10-13)

`pg_class.relacl` for `mock_sessions`, `star_stories` and `resume_scans`: `anon`, `authenticated`, `postgres` and `service_role` each hold `DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` on **all three tables**. This is the default Supabase grant set; the `revoke insert, update ... from authenticated, anon` of `2026-10-09-server-only-score-writes.sql` is not visible. The README records it as applied and verified on 2026-10-09; **why it is not there now is UNKNOWN** (nothing in the repo shows a later grant; candidates: undone by the down script, overwritten by a later grant or default-privilege change, a project restore or reset, or the earlier check was on another target). Not verified by me: whether any forged rows exist.
Reachability: with the owner-scoped policy (`auth.uid() = user_id`, ALL) a signed-in user can insert or edit their own rows in the three tables through the REST API with any score 0 to 100 (open sign-up, no email confirmation). `anon` is stopped by the policy for these rows. `TRUNCATE`, `TRIGGER` and `REFERENCES` are not reachable through the REST API (they need a direct database connection), so they are not an additional web exposure, only an untidy grant set. Consequence for scores: `interview_score`, `star_score`, `ats_score` and `trust_score` can be set by the account owner; no verified employer exists, so no recruiter sees them today (counts 2026-10-13: 0 verified employers, 0 consents).
Proposed remedy (needs the owner's explicit approval, not applied): re-apply the existing, replica-tested `proposed/2026-10-09-server-only-score-writes.sql` (undo: `.down.sql`). Preconditions already met: the live site's bundle contains `score-interview` and `score-star` (checked 2026-10-13) and both functions are deployed. Before it: a read-only look for forged rows. After it: the same ACL query must show `INSERT` and `UPDATE` absent for `anon` and `authenticated`, and the owner must save one STAR story and one interview from the live site to confirm saving still works. This item comes before S2.

### 10.4 Anomaly count (owner, 2026-10-13)

`mock_sessions`: 7 rows, 0 with `questions_count` null or outside 1 to 5, 0 without `user_id`; `star_stories`: 2 rows; `resume_scans`: 5 rows (the known old rows from May). No obvious sign of forged `mock_sessions` rows. **This does not prove no one wrote a score:** a forged row can use a count from 1 to 5, and star and scan rows were not inspected for plausibility. It only shows the volume is tiny and the crude signature (count outside what the server writes) is absent.

### 10.5 Resolved 2026-10-13

The S4 revoke was re-applied by the owner and verified (ACL query and two live saves). See `docs/database/README.md`, "Re-applied to production" 2026-10-13. Cause of the earlier loss: UNKNOWN. The new tables in this proposal must therefore ship with an explicit post-apply ACL check in their verification steps, and drift of applied steps is a recommended follow-up.
