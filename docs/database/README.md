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
