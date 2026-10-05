-- Staging bootstrap: the public tables, functions, triggers and policies that production had on 2026-10-05
-- BEFORE the 2026-10-05 migration, reduced to the columns the audit could see. Run on an EMPTY staging project only,
-- then run 2026-10-05-lock-scores-and-verify-employers.sql, then phase1/001_phase1_foundation.sql.
-- Never run this on production.

create table public.candidate_trust_profiles (
  id uuid primary key default gen_random_uuid(), user_id uuid unique, full_name text, headline text, bio text,
  skills text[], salary_min int, salary_max int, currency text default 'USD', work_preference text default 'hybrid',
  location text, is_visible boolean default false, trust_score int default 0, ats_score int default 0,
  interview_score int default 0, star_score int default 0, updated_at timestamptz default now());
create table public.resume_scans (id uuid primary key default gen_random_uuid(), user_id uuid, credibility_score int, created_at timestamptz default now());
create table public.mock_sessions (id uuid primary key default gen_random_uuid(), user_id uuid, avg_score int, created_at timestamptz default now());
create table public.star_stories (id uuid primary key default gen_random_uuid(), user_id uuid, score int, created_at timestamptz default now());
create table public.employers (id uuid primary key default gen_random_uuid(), owner_id uuid, name text, created_at timestamptz default now());
create table public.employer_members (employer_id uuid, user_id uuid, role text);
create table public.job_listings (id uuid primary key default gen_random_uuid(), employer_id uuid, title text, status text);
create table public.trust_matches (id uuid primary key default gen_random_uuid(), employer_id uuid, candidate_id uuid, status text);
create table public.pipeline_entries (id uuid primary key default gen_random_uuid(), employer_id uuid, candidate_id uuid);

-- functions exactly as in the real database
CREATE OR REPLACE FUNCTION public.recompute_trust_score(p_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE v_ats_score int := 0; v_interview_score int := 0; v_star_score int := 0; v_trust_score int := 0;
BEGIN
  SELECT COALESCE(MAX(credibility_score), 0) INTO v_ats_score FROM resume_scans WHERE user_id = p_user_id;
  SELECT COALESCE(ROUND(AVG(avg_score)), 0) INTO v_interview_score FROM (SELECT avg_score FROM mock_sessions WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 5) recent;
  SELECT COALESCE(ROUND(AVG(score)), 0) INTO v_star_score FROM (SELECT score FROM star_stories WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 5) recent;
  v_trust_score := ROUND(v_ats_score * 0.40 + v_interview_score * 0.35 + v_star_score * 0.25);
  INSERT INTO candidate_trust_profiles (user_id, ats_score, interview_score, star_score, trust_score, updated_at)
  VALUES (p_user_id, v_ats_score, v_interview_score, v_star_score, v_trust_score, now())
  ON CONFLICT (user_id) DO UPDATE SET ats_score = EXCLUDED.ats_score, interview_score = EXCLUDED.interview_score,
    star_score = EXCLUDED.star_score, trust_score = EXCLUDED.trust_score, updated_at = now();
END; $function$;
CREATE OR REPLACE FUNCTION public.trigger_recompute_trust_score() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN PERFORM recompute_trust_score(NEW.user_id); RETURN NEW; END; $function$;
create trigger trg_trust_on_resume_scan after insert or update on public.resume_scans for each row execute function trigger_recompute_trust_score();
create trigger trg_trust_on_mock_session after insert or update on public.mock_sessions for each row execute function trigger_recompute_trust_score();
create trigger trg_trust_on_star_story after insert or update on public.star_stories for each row execute function trigger_recompute_trust_score();

-- RLS + policies exactly as audited
alter table public.candidate_trust_profiles enable row level security;
alter table public.resume_scans enable row level security;
alter table public.mock_sessions enable row level security;
alter table public.star_stories enable row level security;
alter table public.employers enable row level security;
alter table public.employer_members enable row level security;
alter table public.job_listings enable row level security;
alter table public.trust_matches enable row level security;
alter table public.pipeline_entries enable row level security;

create policy "candidate owns profile" on public.candidate_trust_profiles for all using (auth.uid() = user_id);
create policy "recruiters can read visible profiles" on public.candidate_trust_profiles for select
  using (is_visible = true and exists (select 1 from employer_members em where em.user_id = auth.uid()));
create policy "Users manage own scans" on public.resume_scans for all using (auth.uid() = user_id);
create policy "Users can manage their own mock sessions" on public.mock_sessions for all using (auth.uid() = user_id);
create policy "Users manage own stories" on public.star_stories for all using (auth.uid() = user_id);
create policy "owner full access" on public.employers for all using (auth.uid() = owner_id);
create policy "employer owner can manage members" on public.employer_members for all
  using (exists (select 1 from employers where employers.id = employer_members.employer_id and employers.owner_id = auth.uid()));
create policy "member can read own membership" on public.employer_members for select using (auth.uid() = user_id);
create policy "employer members can manage jobs" on public.job_listings for all
  using ((exists (select 1 from employer_members em where em.employer_id = job_listings.employer_id and em.user_id = auth.uid()))
      or (exists (select 1 from employers e where e.id = job_listings.employer_id and e.owner_id = auth.uid())));
create policy "candidates can read open jobs" on public.job_listings for select using (status = 'open');
create policy "recruiter manages pipeline" on public.pipeline_entries for all
  using ((exists (select 1 from employer_members em where em.employer_id = pipeline_entries.employer_id and em.user_id = auth.uid()))
      or (exists (select 1 from employers e where e.id = pipeline_entries.employer_id and e.owner_id = auth.uid())));
create policy "candidate reads own pipeline" on public.pipeline_entries for select using (auth.uid() = candidate_id);
create policy "recruiter manages matches for their employer" on public.trust_matches for all
  using ((exists (select 1 from employer_members em where em.employer_id = trust_matches.employer_id and em.user_id = auth.uid()))
      or (exists (select 1 from employers e where e.id = trust_matches.employer_id and e.owner_id = auth.uid())));
create policy "candidate sees own matches" on public.trust_matches for select using (auth.uid() = candidate_id);
create policy "candidate updates own match" on public.trust_matches for update using (auth.uid() = candidate_id);

