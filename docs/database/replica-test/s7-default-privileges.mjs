// S7 test: default privileges (docs/database/proposed/2026-10-19-default-privileges.sql) on an in-memory Postgres. Not a production test.
//   npm i @electric-sql/pglite ; cp this file to a scratch folder ; REPO=/path/to/repo node s7-default-privileges.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const REPO = process.env.REPO || path.resolve(process.cwd(), '../../..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
const UP = read('docs/database/proposed/2026-10-19-default-privileges.sql');
const DOWN = read('docs/database/proposed/2026-10-19-default-privileges.down.sql');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });
const T = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];

async function freshDb() {
  const db = new PGlite();
  await db.exec('create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant usage on schema public to anon, authenticated, service_role;');
  // The defaults read from production on 2026-10-19 for role postgres in schema public.
  await db.exec('alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role');
  await db.exec('alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role');
  await db.exec('alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role');
  // An existing table, the way production has them (tight by hand).
  await db.exec('create table public.old_t (id int primary key, owner uuid)');
  await db.exec('revoke all on public.old_t from anon, authenticated');
  await db.exec('grant select, insert, update, delete on public.old_t to authenticated');
  await db.exec('create function public.old_f() returns int language sql as $$ select 1 $$');
  await db.exec('revoke execute on function public.old_f() from public, anon, authenticated');
  return db;
}
const tp = async (db, role, t, p) => (await db.query('select has_table_privilege($1,$2,$3) x', [role, `public.${t}`, p])).rows[0].x;
const fx = async (db, role, f) => (await db.query('select has_function_privilege($1,$2,$3) x', [role, `public.${f}`, 'execute'])).rows[0].x;
const sq = async (db, role, s) => (await db.query('select has_sequence_privilege($1,$2,$3) x', [role, `public.${s}`, 'usage'])).rows[0].x;
const snap = async (db) => {
  const o = {};
  for (const r of ['anon', 'authenticated', 'service_role']) {
    o[`old_t:${r}`] = (await Promise.all(T.map((p) => tp(db, r, 'old_t', p)))).map((x, i) => (x ? T[i] : null)).filter(Boolean).join(',');
    o[`old_f:${r}`] = String(await fx(db, r, 'old_f()'));
  }
  return o;
};
async function makeNew(db, tag) {
  await db.exec(`create table public.new_${tag} (id int generated always as identity primary key, v text)`);
  await db.exec(`create function public.fn_${tag}() returns int language sql as $$ select 1 $$`);
}

let db = await freshDb();
await makeNew(db, 'a');
check('P0 before the script a new table is open to anon and authenticated (the risk it contains)', (await tp(db, 'anon', 'new_a', 'TRUNCATE')) && (await tp(db, 'authenticated', 'new_a', 'DELETE')));
const before = await snap(db);

await db.exec(UP);
await makeNew(db, 'b');
let leaks = [];
for (const r of ['anon', 'authenticated']) for (const p of T) if (await tp(db, r, 'new_b', p)) leaks.push(`${r} ${p}`);
check('U1 a table created after the script gives anon and authenticated no privilege', leaks.length === 0, leaks.join('; '));
check('U2 a table created after the script keeps all privileges for service_role', (await Promise.all(T.map((p) => tp(db, 'service_role', 'new_b', p)))).every(Boolean));
check('U3 the identity sequence of a new table is closed to anon and authenticated, open to service_role', !(await sq(db, 'anon', 'new_b_id_seq')) && !(await sq(db, 'authenticated', 'new_b_id_seq')) && (await sq(db, 'service_role', 'new_b_id_seq')));
check('U4 a function created after the script is still executable by service_role', (await fx(db, 'service_role', 'fn_b()')));
const pubExec = (await fx(db, 'anon', 'fn_b()'));
check('U5 documented limit: PostgreSQL still lets PUBLIC execute a new function, so anon can; a function script must revoke from public (as the existing ones do)', pubExec === true, `anon can execute a new function: ${pubExec}`);
await db.exec('revoke execute on function public.fn_b() from public');
check('U6 after the usual "revoke execute ... from public", anon and authenticated cannot execute it', !(await fx(db, 'anon', 'fn_b()')) && !(await fx(db, 'authenticated', 'fn_b()')) && (await fx(db, 'service_role', 'fn_b()')));
await db.exec('grant select, insert on public.new_b to authenticated');
check('U7 a script that grants exactly what the app needs still works after the change', (await tp(db, 'authenticated', 'new_b', 'INSERT')) && !(await tp(db, 'authenticated', 'new_b', 'DELETE')) && !(await tp(db, 'anon', 'new_b', 'SELECT')));
const after = await snap(db);
const moved = Object.keys(before).filter((k) => before[k] !== after[k]);
check('U8 existing objects are not changed by the script (old table and old function, all three roles)', moved.length === 0, moved.map((k) => `${k}: ${after[k]} vs ${before[k]}`).join('; '));
check('U9 the table created BEFORE the script stays open as it was (the script is not retroactive)', (await tp(db, 'anon', 'new_a', 'TRUNCATE')));

await db.exec(UP);
await makeNew(db, 'c');
check('U10 the script can be applied twice', !(await tp(db, 'anon', 'new_c', 'SELECT')) && !(await tp(db, 'authenticated', 'new_c', 'SELECT')));

await db.exec(DOWN);
await makeNew(db, 'd');
const back = (await Promise.all(T.map((p) => tp(db, 'anon', 'new_d', p)))).every(Boolean) && (await Promise.all(T.map((p) => tp(db, 'authenticated', 'new_d', p)))).every(Boolean);
check('D1 after the down script a new table gets the old default privileges again', back);
check('D2 the down script does not touch existing objects', JSON.stringify(await snap(db)) === JSON.stringify(before));

const bad = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.detail}`);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
