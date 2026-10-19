-- PROPOSED, NOT APPLIED. Written 2026-10-19. Project: CareerAiHub (ruibdsvrcctxgxctaxwe) only. Never ZenDMS (obtmsvhejvcfrkfyucev).
-- Why (read-only check 2026-10-19): in schema public every object is owned by role postgres (32 tables, 2 views, 1 sequence), and pg_default_acl gives anon,
-- authenticated and service_role every table privilege (arwdDxtm), rwU on sequences and EXECUTE on functions for each NEW object created by postgres.
-- Today's tables are tight only because their scripts revoked by hand; a table or function created later without that revoke is open to the browser roles.
-- What it does: removes the default grants to anon and authenticated for objects created from now on by postgres in schema public.
-- What it does NOT do: change any existing table, view, sequence or function; change service_role's defaults (Edge Functions keep working); touch RLS or policies.
-- It does NOT remove the PUBLIC execute right that PostgreSQL gives every new function. A schema-level default cannot remove that (it needs the same statement
-- without "in schema public", which would affect every schema); so a new function must still end with "revoke execute on function ... from public" as the
-- existing scripts do. tests: docs/database/replica-test/s7-default-privileges.mjs
-- Consequence: a table created later gives "permission denied" to the browser until a script grants exactly what the app needs (after its RLS policies). Forgetting
-- fails closed. A table with an identity or serial column also needs the sequence granted.
-- Down: 2026-10-19-default-privileges.down.sql restores the defaults read on 2026-10-19.
begin;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

commit;
