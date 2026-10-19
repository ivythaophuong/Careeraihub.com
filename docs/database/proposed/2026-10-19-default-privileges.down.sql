-- Undo for 2026-10-19-default-privileges.sql: gives anon and authenticated the default grants read from pg_default_acl on 2026-10-19
-- (tables arwdDxtm, sequences rwU, functions X) for objects created later by postgres in schema public. Existing objects are not touched.
begin;

alter default privileges for role postgres in schema public grant all on tables to anon, authenticated;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated;
alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated;

commit;
