-- ROLLBACK for 2026-10-15-practice-ledger.sql. DATA-LOSS WARNING: this deletes stored practice sessions, per-question feedback and scores, and the AI request ledger.
-- Export them first if any real use occurred. It does not touch mock_sessions rows already written (they keep working and keep feeding the Trust Score).
-- Project: CareerAiHub (ruibdsvrcctxgxctaxwe) only.
begin;
drop function if exists public.complete_practice_session(uuid, uuid);
drop function if exists public.expire_unknown_requests(interval);
drop function if exists public.settle_ai_request(uuid, text, int, int, int, text, text);
drop function if exists public._settle(uuid, text, int, int, int, text, text, text, int);
drop function if exists public.mark_unknown(uuid);
drop function if exists public.mark_started(uuid);
drop function if exists public.reserve_ai_request(uuid, text, text, text, uuid, int);
drop function if exists public.expire_stale_requests(interval);
drop function if exists public._active_policy(text);
drop table if exists public.user_usage_windows;
drop table if exists public.ai_requests;
drop table if exists public.practice_submissions;
drop table if exists public.practice_sessions;
drop table if exists public.ai_policies;
drop function if exists public.ai_policy_limits_valid(jsonb);
commit;
