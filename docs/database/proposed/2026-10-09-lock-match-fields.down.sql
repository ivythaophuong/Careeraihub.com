-- Undo for 2026-10-09-lock-match-fields.sql. Drops only what that script created. No table data is changed.
begin;
drop trigger if exists trg_lock_match_fields on public.trust_matches;
drop function if exists public.lock_match_fields();
commit;
