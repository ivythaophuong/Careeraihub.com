// Compares a LOCAL database with the production catalog export (docs/database/evidence/export-catalog.sh) so that "the local schema is production's schema"
// is a measured statement. Reads the export files and queries the local container with the same catalog SELECTs. Read-only on both sides.
//   node compare-with-catalog.mjs <catalog folder> <local database container name>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [dir, container] = process.argv.slice(2);
if (!dir || !container) { console.error('usage: compare-with-catalog.mjs <catalog folder> <db container>'); process.exit(2); }
if (!/^supabase_db_/.test(container)) { console.error('Refusing: the container must be a local Supabase database (supabase_db_*).'); process.exit(2); }
const load = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const local = (sql) => JSON.parse(execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-c', `select coalesce(json_agg(t), '[]') from (${sql}) t`], { encoding: 'utf8', maxBuffer: 1 << 28 }));
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').replace(/"/g, '').replace(/::[a-z_ ]+(\[\])?/gi, '').trim();

// [file, local query, key function, optional value function (compared when keys match)]
const CHECKS = [
  ['01-tables-rls.json', "select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'", (r) => r.table_name, (r) => `${r.rls_enabled}/${r.rls_forced}`],
  ['02-columns.json', "select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public'", (r) => `${r.table_name}.${r.column_name}`, (r) => `${r.data_type}|${r.is_nullable}|${norm(r.column_default)}`],
  ['03-policies.json', "select tablename, policyname, permissive, roles::text as roles, cmd, qual, with_check from pg_policies where schemaname='public'", (r) => `${r.tablename}/${r.policyname}`, (r) => `${r.permissive}|${r.cmd}|${norm(r.qual)}|${norm(r.with_check)}`],
  ['04-table-grants.json', "select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated')", (r) => `${r.table_name}|${r.grantee}|${r.privilege_type}`],
  ['05-triggers.json', "select event_object_table as table_name, trigger_name, action_timing, event_manipulation, action_statement from information_schema.triggers where trigger_schema='public'", (r) => `${r.table_name}|${r.trigger_name}|${r.event_manipulation}`, (r) => `${r.action_timing}|${norm(r.action_statement)}`],
  ['07-function-grants.json', "select routine_name, grantee, privilege_type from information_schema.routine_privileges where routine_schema='public' and grantee in ('anon','authenticated','public')", (r) => `${r.routine_name}|${r.grantee}|${r.privilege_type}`],
  ['08-constraints.json', "select conrelid::regclass::text as table_name, conname, contype, pg_get_constraintdef(oid) as definition from pg_constraint where connamespace='public'::regnamespace", (r) => `${String(r.table_name).replace(/"/g, '').replace(/^public\./, '')}/${r.conname}`, (r) => `${r.contype}|${norm(r.definition)}`],
  ['10-column-privileges.json', "select table_name, column_name, grantee, privilege_type from information_schema.column_privileges where table_schema='public' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE')", (r) => `${r.table_name}.${r.column_name}|${r.grantee}|${r.privilege_type}`],
  ['06-functions.json', "select p.proname as function_name, p.prosecdef as security_definer, pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'", (r) => r.function_name, (r) => `${r.security_definer}|${norm(r.definition).replace(/ ?\$function\$ ?/g, '$$').replace(/CREATE OR REPLACE FUNCTION public\./i, '')}`],
];

let bad = 0;
for (const [file, sql, key, val] of CHECKS) {
  const prod = new Map(load(file).map((r) => [key(r), val ? val(r) : '']));
  const loc = new Map(local(sql).map((r) => [key(r), val ? val(r) : '']));
  const onlyProd = [...prod.keys()].filter((k) => !loc.has(k));
  const onlyLoc = [...loc.keys()].filter((k) => !prod.has(k));
  const differ = val ? [...prod.keys()].filter((k) => loc.has(k) && prod.get(k) !== loc.get(k)) : [];
  const ok = !onlyProd.length && !onlyLoc.length && !differ.length;
  if (!ok) bad++;
  console.log(`${ok ? 'SAME ' : 'DIFF '} ${file.padEnd(26)} production ${String(prod.size).padStart(4)} · local ${String(loc.size).padStart(4)}` + (ok ? '' : ` · only in production ${onlyProd.length} · only local ${onlyLoc.length} · different ${differ.length}`));
  if (!ok && process.env.VERBOSE !== '0') {
    for (const k of onlyProd.slice(0, 4)) console.log('      only in production:', k);
    for (const k of onlyLoc.slice(0, 4)) console.log('      only local        :', k);
    for (const k of differ.slice(0, 3)) console.log('      different         :', k, '\n         production:', prod.get(k).slice(0, 160), '\n         local     :', loc.get(k).slice(0, 160));
  }
}
console.log(bad ? `\n${bad} file(s) differ.` : '\nThe local schema equals the production catalog export on every compared point.');
process.exit(bad ? 1 : 0);
