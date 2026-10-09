-- PROPOSED, NOT APPLIED. Tested only on the in-memory replica (docs/database/replica-test/s2-lock-match-fields.mjs).
-- Review it, then apply it yourself in the Supabase SQL Editor. Plan: docs/architecture/plans/PLAN-score-and-consent-integrity.md (S2, finding F-2).
--
-- Problem (production, read 2026-10-09): the policy "candidate updates own match" has no with_check and authenticated holds UPDATE on every column of
-- trust_matches. lock_row_parties protects only employer_id and candidate_id. So a candidate can set match_score, recruiter_action and status on their own
-- match, and any recruiter of the employer can set match_score and candidate_action.
--
-- What this does (one trigger function, one BEFORE INSERT OR UPDATE trigger; applies only to the browser roles anon and authenticated)
--   UPDATE by the candidate of the row  : only candidate_action (and updated_at) may change
--   UPDATE by a verified member of the row's employer : only recruiter_action, status (and updated_at) may change
--   UPDATE by anyone else               : refused (RLS already hides the row; this is a second layer)
--   INSERT                              : match_score is forced to 0 and candidate_action to NULL, so a score or a candidate action cannot be planted
--   match_score is never writable from the browser (no matching engine exists; any future score is written by the server)
-- The service role and the SQL editor are not affected. If a caller is both the candidate and a member of the employer, the candidate rules apply.
--
-- Open question for the owner: contracts v1.1 say "candidate may change status only". The table has a dedicated candidate_action column, so this
-- script lets the candidate change candidate_action and NOT status. If the candidate should change status instead, edit the two column lists below.
--
-- Does not change RLS policies, grants, lock_row_parties, or any existing row. Rollback: 2026-10-09-lock-match-fields.down.sql. Safe to run twice.

begin;

create or replace function public.lock_match_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.match_score := 0;
      new.candidate_action := null;
      return new;
    end if;

    if auth.uid() = old.candidate_id then
      if (to_jsonb(new) - 'candidate_action' - 'updated_at') is distinct from (to_jsonb(old) - 'candidate_action' - 'updated_at') then
        raise exception 'a candidate can only change candidate_action on a match' using errcode = '42501';
      end if;
    elsif public.is_verified_employer_member(old.employer_id) then
      if (to_jsonb(new) - 'recruiter_action' - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'recruiter_action' - 'status' - 'updated_at') then
        raise exception 'a recruiter can only change recruiter_action and status on a match' using errcode = '42501';
      end if;
    else
      raise exception 'not allowed to change this match' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_lock_match_fields on public.trust_matches;
create trigger trg_lock_match_fields
  before insert or update on public.trust_matches
  for each row execute function public.lock_match_fields();

commit;
