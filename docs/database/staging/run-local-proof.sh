#!/usr/bin/env bash
# One command: prove the integrity findings and the proposed fixes S1, S2, S3, S3b on a LOCAL Supabase stack (real Postgres, PostgREST, Auth).
# Nothing here touches production: it only talks to containers on this machine and refuses anything else.
#
#   bash docs/database/staging/run-local-proof.sh <folder-with-supabase-init>   # e.g. ~/supabase-local (see LOCAL.md)
#   SCHEMA_DUMP=~/supabase-baseline/schema-public-<date>.sql CATALOG_DIR=~/supabase-baseline/catalog-<date> bash docs/database/staging/run-local-proof.sh <folder>
#   # restores the REAL production schema (supabase db dump --linked --schema public) and checks it against the catalog export before testing
#
# Needs Docker running and the Supabase CLI. The folder must contain supabase/config.toml (`supabase init`). It starts the stack if it is not running,
# RESETS the local database (local data only), then: builds the schema production had -> proves the problems -> applies the fixes -> proves them ->
# rolls them back -> proves the problems are back -> re-applies -> runs the Phase 1 security suite.
set -uo pipefail
export PATH="$HOME/.docker/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"
SL="${1:?usage: run-local-proof.sh <folder with supabase/config.toml>}"
R="$(cd "$(dirname "$0")/../../.." && pwd)"
PROJECT_ID="$(grep -E '^project_id' "$SL/supabase/config.toml" | sed -E 's/.*"(.*)".*/\1/')"
DB="supabase_db_${PROJECT_ID}"
FAIL=0
say() { printf '\n== %s\n' "$*"; }
psql_file() { docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$1" 2>&1 | grep -iE '^(psql:|error)' | head -3; }
reload() { docker exec -i "$DB" psql -U postgres -d postgres -Atc "notify pgrst, 'reload schema'" >/dev/null; sleep 3; }
step_sql() { local out; out="$(psql_file "$1")"; if [ -n "$out" ]; then echo "  FAILED $1: $out"; FAIL=1; else echo "  ok $(basename "$1")"; fi; }

docker info >/dev/null 2>&1 || { echo "Docker is not running."; exit 2; }
if ! docker ps --format '{{.Names}}' | grep -q "^${DB}$"; then
  say "starting the local stack (first run downloads images)"
  supabase start --workdir "$SL" -x studio,imgproxy,storage-api,realtime,edge-runtime,logflare,vector,mailpit,postgres-meta,supavisor || exit 2
fi
supabase db reset --local --workdir "$SL" >/dev/null 2>&1 || { echo "db reset failed"; exit 2; }
ENVF="$SL/staging.env"
supabase status -o env --workdir "$SL" 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=' \
  | sed -e 's/^API_URL=/STAGING_URL=/' -e 's/^ANON_KEY=/STAGING_ANON_KEY=/' -e 's/^SERVICE_ROLE_KEY=/STAGING_SERVICE_ROLE_KEY=/' -e 's/"//g' > "$ENVF"
grep -q '^STAGING_URL=http://127.0.0.1' "$ENVF" || { echo "The stack is not local (STAGING_URL is not 127.0.0.1). Refusing."; exit 2; }
rest() { (cd "$R" && STAGING_ENV="$ENVF" node "$@" 2>&1); }

if [ -n "${SCHEMA_DUMP:-}" ]; then
  say "1. the REAL production schema, restored from $SCHEMA_DUMP (structure only; the dump must contain no data)"
  if grep -qE '^(COPY |INSERT INTO )' "$SCHEMA_DUMP"; then echo "The dump contains data statements. Refusing."; exit 2; fi
  # roles the dump grants to that do not exist on a fresh local stack are created empty (no login, no privileges of their own)
  for role in $(grep -oE '(TO|FOR ROLE) "[a-z_0-9]+"' "$SCHEMA_DUMP" | sed -E 's/.*"(.*)"/\1/' | sort -u \
                | grep -vE '^(postgres|anon|authenticated|service_role|pg_database_owner|authenticator|dashboard_user|supabase_.*)$'); do
    docker exec -i "$DB" psql -U postgres -d postgres -q -c "create role \"$role\" nologin" >/dev/null 2>&1 && echo "  created local stand-in role: $role"
  done
  # A fresh local stack grants new tables/functions to anon, authenticated and service_role by default. A schema dump only lists the differences from the
  # PostgreSQL defaults, so those local grants would survive the restore and make the schema MORE open than production. Remove them first (as the local superuser supabase_admin: some of those defaults belong to it).
  docker exec -i "$DB" psql -U supabase_admin -d postgres -q -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
do $$ declare r record; begin
  for r in select d.defaclrole::regrole::text as owner, d.defaclobjtype as t
           from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace where n.nspname = 'public' loop
    execute format('alter default privileges for role %s in schema public revoke all on %s from anon, authenticated, service_role, postgres',
      r.owner, case r.t when 'r' then 'tables' when 'f' then 'functions' when 'S' then 'sequences' else 'tables' end);
  end loop;
end $$;
SQL
  step_sql "$SCHEMA_DUMP"
  if [ -n "${CATALOG_DIR:-}" ]; then
    say "1b. does the local schema equal the production catalog export? ($CATALOG_DIR)"
    (cd "$R" && node docs/database/staging/compare-with-catalog.mjs "$CATALOG_DIR" "$DB") || FAIL=1
  fi
else
  say "1. schema as production had it (bootstrap, 2026-10-05, Phase 1, live columns)"
  for f in docs/database/staging/00_bootstrap_public_schema.sql docs/database/2026-10-05-lock-scores-and-verify-employers.sql \
           docs/database/phase1/001_phase1_foundation.sql docs/database/staging/01_live_columns.sql; do step_sql "$R/$f"; done
fi
reload
say "2. the problems, through the real API (all issues must be OPEN)"
rest docs/database/staging/rest-consent-test.mjs --expect=before | tail -n 3; [ "${PIPESTATUS[0]}" -ne 0 ] && FAIL=1

FIXES="recompute-score-on-delete lock-match-fields list-open-jobs consent-only-recruiter-access"
say "3. apply the proposed fixes"; for f in $FIXES; do step_sql "$R/docs/database/proposed/2026-10-09-$f.sql"; done; reload
say "4. the fixes, through the real API (F-5, F-2, F-4 FIXED; F-1 stays OPEN until S4)"
out="$(rest docs/database/staging/rest-consent-test.mjs --expect=after)"; echo "$out" | tail -n 1; echo "$out" | grep -E 'MISMATCH|FAIL' | head -5 && FAIL=1

say "5. rollback in reverse order, the problems must be back"
for f in consent-only-recruiter-access list-open-jobs lock-match-fields recompute-score-on-delete; do step_sql "$R/docs/database/proposed/2026-10-09-$f.down.sql"; done; reload
out="$(rest docs/database/staging/rest-consent-test.mjs --expect=before)"; echo "$out" | tail -n 1; echo "$out" | grep -E 'MISMATCH|FAIL' | head -5 && FAIL=1

say "6. re-apply, then the Phase 1 security suite with all fixes in place"
for f in $FIXES; do step_sql "$R/docs/database/proposed/2026-10-09-$f.sql"; done; reload
out="$(rest docs/database/staging/rest-consent-test.mjs --expect=after)"; echo "$out" | tail -n 1; echo "$out" | grep -E 'MISMATCH|FAIL' | head -5 && FAIL=1
out="$(rest docs/database/staging/staging-test.mjs)"; echo "$out" | tail -n 1; echo "$out" | grep -E '^FAIL' | head -8 && FAIL=1

say "result"; if [ "$FAIL" -eq 0 ]; then echo "ALL GOOD"; else echo "SOMETHING FAILED, read the lines above"; fi
exit "$FAIL"
