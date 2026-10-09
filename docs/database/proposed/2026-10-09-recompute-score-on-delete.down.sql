-- Undo for 2026-10-09-recompute-score-on-delete.sql. Drops only the objects that script created. No table data is changed.
begin;
drop trigger if exists trg_trust_on_resume_scan_delete on public.resume_scans;
drop trigger if exists trg_trust_on_mock_session_delete on public.mock_sessions;
drop trigger if exists trg_trust_on_star_story_delete on public.star_stories;
drop function if exists public.trigger_recompute_trust_score_after_delete();
commit;
