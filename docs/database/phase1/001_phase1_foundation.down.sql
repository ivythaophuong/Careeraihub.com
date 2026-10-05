-- Undo for 001_phase1_foundation.sql. Drops only objects that migration created; existing tables are untouched.
-- Destroys any rows in the new tables, so take a backup first if they hold real data.
begin;
drop function if exists public.apply_verification_attempt(uuid, uuid, text, text, text, timestamptz, text, text, text, jsonb, text, text, jsonb, text, timestamptz, timestamptz, text);
drop function if exists public.start_verification(uuid);
drop function if exists public.purge_raw_credential(uuid);
drop function if exists public.has_consent(uuid, uuid, text, text);
drop table if exists public.consents;
drop table if exists public.verification_attempts;
drop table if exists public.verification_requests;
drop table if exists public.trusted_issuers;
drop view  if exists public.evidence_active;
drop view  if exists public.evidence_current;
drop table if exists public.evidence;
drop table if exists public.career_targets;
drop table if exists public.career_profiles;
drop function if exists public.consents_guard();
drop function if exists public.verification_attempts_guard();
drop function if exists public.verification_requests_before_insert();
drop function if exists public.evidence_before_update();
drop function if exists public.evidence_before_insert();
drop function if exists public.touch_updated_at();
commit;
