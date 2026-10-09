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
