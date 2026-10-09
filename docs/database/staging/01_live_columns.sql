-- Columns and privileges that production has and the reduced bootstrap (00_bootstrap_public_schema.sql) does not. Run on a LOCAL or STAGING database only,
-- after 00_bootstrap, 2026-10-05-lock-scores-and-verify-employers.sql and phase1/001_phase1_foundation.sql, and BEFORE the proposed scripts.
-- Source: evidence queries 1.2 and 1.4 of 2026-10-09 (docs/architecture/EVIDENCE_RESULTS_2026-10-09.md). Never run on production.
alter table public.employers add column if not exists website text, add column if not exists verified_at timestamptz;
alter table public.job_listings
  add column if not exists posted_by uuid, add column if not exists description text, add column if not exists requirements text[],
  add column if not exists skills_required text[], add column if not exists salary_min integer, add column if not exists salary_max integer,
  add column if not exists currency text default 'USD', add column if not exists work_preference text default 'hybrid', add column if not exists location text,
  add column if not exists created_at timestamptz default now(), add column if not exists closes_at timestamptz;
alter table public.trust_matches
  add column if not exists job_id uuid, add column if not exists match_score integer default 0, add column if not exists recruiter_action text,
  add column if not exists candidate_action text, add column if not exists created_at timestamptz default now(), add column if not exists updated_at timestamptz default now();

-- Production grants SELECT/INSERT/UPDATE/DELETE (and more) on these to the API roles; the policies decide the rows.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on public.candidate_trust_profiles, public.resume_scans, public.mock_sessions, public.star_stories,
  public.trust_matches, public.pipeline_entries, public.employers, public.employer_members, public.job_listings to anon;
