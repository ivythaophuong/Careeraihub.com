#!/usr/bin/env bash
# READ-ONLY export of the catalog of the LINKED Supabase project into local JSON files, so that nothing is truncated in a chat.
# No Docker and no database password: it uses `supabase db query --linked` (Management API). Needs `supabase login` and `supabase link` once.
#
#   mkdir ~/supabase-baseline && cd ~/supabase-baseline && supabase login && supabase init && supabase link --project-ref <ref>
#   bash /path/to/repo/docs/database/evidence/export-catalog.sh [output-folder]
#
# Every statement below is a SELECT on pg_catalog / information_schema. The script refuses anything else. It reads no user table, so no personal
# data is exported. Review the files before sharing them or committing them (the policy and function texts are the point).
set -euo pipefail
OUT="${1:-catalog-$(date +%F)}"
mkdir -p "$OUT"

q() {
  local name="$1" sql="$2"
  case "$(printf '%s' "$sql" | tr -d '\n' | sed 's/^ *//' | tr '[:upper:]' '[:lower:]')" in
    select*|with*) ;;
    *) echo "refusing to run a statement that does not start with SELECT/WITH: $name" >&2; exit 2 ;;
  esac
  if printf '%s' "$sql" | grep -Eiq '\b(insert|update|delete|alter|create|drop|grant|revoke|truncate|copy)\b[[:space:]]+(into|table|function|policy|trigger|schema|view|from|to|on|set)'; then
    echo "refusing: $name contains a write keyword" >&2; exit 2
  fi
  supabase db query --linked --output-format json "$sql" > "$OUT/$name.json"
  echo "wrote $OUT/$name.json ($(wc -c < "$OUT/$name.json" | tr -d ' ') bytes)"
}

q 01-tables-rls "select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by c.relname"
q 02-columns "select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position"
q 03-policies "select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check from pg_policies where schemaname = 'public' order by tablename, policyname"
q 04-table-grants "select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon','authenticated') order by table_name, grantee, privilege_type"
q 05-triggers "select event_object_table as table_name, trigger_name, action_timing, event_manipulation, action_statement from information_schema.triggers where trigger_schema = 'public' order by event_object_table, trigger_name"
q 06-functions "select p.proname as function_name, p.prosecdef as security_definer, pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by p.proname"
q 07-function-grants "select routine_name, grantee, privilege_type from information_schema.routine_privileges where routine_schema = 'public' and grantee in ('anon','authenticated','public') order by routine_name, grantee"
q 08-constraints "select conrelid::regclass as table_name, conname, contype, pg_get_constraintdef(oid) as definition from pg_constraint where connamespace = 'public'::regnamespace order by conrelid::regclass::text, conname"
q 09-views "select c.relname, c.reloptions from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'v'"
q 10-column-privileges "select table_name, column_name, grantee, privilege_type from information_schema.column_privileges where table_schema = 'public' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE') order by table_name, grantee, privilege_type, column_name"
q 11-indexes "select tablename, indexname, indexdef from pg_indexes where schemaname = 'public' order by tablename, indexname"
q 12-server "select version() as version, current_setting('server_version') as server_version"

echo
echo "Done. Folder: $OUT"
echo "Check that no file contains personal data (they should not) and that 06-functions.json is complete, then share the folder."
