// S6 test: the privilege hardening (docs/database/proposed/2026-10-18-revoke-excess-privileges.sql) on an in-memory Postgres. Not a production test.
//   npm i @electric-sql/pglite ; cp this file next to node_modules ; REPO=/path/to/repo node s6-privilege-hardening.mjs
// The 20 stub tables carry exactly the anon and authenticated privileges read from production on 2026-10-18 (PRE below).
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const REPO = process.env.REPO || path.resolve(process.cwd(), '../../..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
const UP = read('docs/database/proposed/2026-10-18-revoke-excess-privileges.sql');
const DOWN = read('docs/database/proposed/2026-10-18-revoke-excess-privileges.down.sql');
const PRE = {"applications":{"anon":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"],"authenticated":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"]},"candidate_trust_profiles":{"anon":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"],"authenticated":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"]},"cover_letters":{"anon":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"],"authenticated":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"]},"culture_leads":{"anon":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"],"authenticated":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"]},"culture_quiz_events":{"anon":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"],"authenticated":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"]},"employer_members":{"anon":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"],"authenticated":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"]},"employers":{"anon":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"],"authenticated":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"]},"insights":{"anon":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"],"authenticated":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"]},"jd_analyses":{"anon":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"],"authenticated":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"]},"job_listings":{"anon":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"],"authenticated":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"]},"mock_sessions":{"anon":["DELETE","REFERENCES","SELECT","TRIGGER","TRUNCATE"],"authenticated":["DELETE","REFERENCES","SELECT","TRIGGER","TRUNCATE"]},"negotiation_practice":{"anon":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"],"authenticated":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"]},"pipeline_entries":{"anon":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"],"authenticated":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"]},"profiles":{"anon":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"],"authenticated":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"]},"resume_scans":{"anon":["DELETE","REFERENCES","SELECT","TRIGGER","TRUNCATE"],"authenticated":["DELETE","REFERENCES","SELECT","TRIGGER","TRUNCATE"]},"star_stories":{"anon":["DELETE","REFERENCES","SELECT","TRIGGER","TRUNCATE"],"authenticated":["DELETE","REFERENCES","SELECT","TRIGGER","TRUNCATE"]},"trust_matches":{"anon":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"],"authenticated":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"]},"trust_messages":{"anon":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"],"authenticated":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"]},"user_memory":{"anon":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"],"authenticated":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"]},"waitlist":{"anon":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"],"authenticated":["DELETE","INSERT","REFERENCES","SELECT","TRIGGER","TRUNCATE","UPDATE"]}};
const ENDPOINTS = ["culture_leads", "culture_quiz_events", "waitlist"];
const PRIVATE = ["applications", "candidate_trust_profiles", "cover_letters", "employer_members", "employers", "insights", "jd_analyses", "mock_sessions", "negotiation_practice", "pipeline_entries", "profiles", "resume_scans", "star_stories", "trust_matches", "trust_messages", "user_memory"];
const TABLES = Object.keys(PRE);
const ALL = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES'];
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });

async function freshDb() {
  const db = new PGlite();
  await db.exec('create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant usage on schema public to anon, authenticated;');
  for (const t of TABLES) {
    await db.exec(`create table public.${t} (id uuid primary key default gen_random_uuid(), user_id uuid)`);
    await db.exec(`alter table public.${t} enable row level security`);
    await db.exec(`revoke all on public.${t} from anon, authenticated`);
    for (const [role, privs] of Object.entries(PRE[t])) await db.exec(`grant ${privs.join(', ')} on public.${t} to ${role}`);
  }
  // A deliberately careless policy, to show the privilege layer holds when a policy is wrong.
  await db.exec(`create policy careless on public.user_memory for all to public using (true) with check (true)`);
  return db;
}
const has = async (db, role, t, p) => (await db.query(`select has_table_privilege($1, $2, $3) as x`, [role, `public.${t}`, p])).rows[0].x;
const snapshot = async (db) => {
  const out = {};
  for (const t of TABLES) for (const role of ['anon', 'authenticated']) out[`${t}:${role}`] = (await Promise.all(ALL.map((p) => has(db, role, t, p)))).map((x, i) => (x ? ALL[i] : null)).filter(Boolean).sort().join(',');
  return out;
};

let db = await freshDb();
const before = await snapshot(db);
check('P0 the stubs start with the production privileges (spot check: anon has TRUNCATE on user_memory and applications)', await has(db, 'anon', 'user_memory', 'TRUNCATE') && await has(db, 'anon', 'applications', 'TRUNCATE'));
check('P1 before the patch a careless policy on user_memory would let anon read it (the risk the patch contains)', (await db.query(`set role anon`).then(() => db.query('select count(*)::int n from public.user_memory').then((r) => { return r; }).catch((e) => ({ err: e.message })))).err === undefined);
await db.exec('reset role');

await db.exec(UP);
const after = await snapshot(db);

let bad = [];
for (const t of TABLES) for (const role of ['anon', 'authenticated']) for (const p of ['TRUNCATE', 'TRIGGER', 'REFERENCES']) if (await has(db, role, t, p)) bad.push(`${role} ${p} ${t}`);
check('U1 no TRUNCATE, TRIGGER or REFERENCES for anon or authenticated on any of the 20 tables', bad.length === 0, bad.join('; '));

bad = [];
for (const t of PRIVATE) for (const p of ALL) if (await has(db, 'anon', t, p)) bad.push(`anon ${p} ${t}`);
check('U2 anon holds nothing on the 16 private tables', bad.length === 0, bad.join('; '));

check('U3 anon keeps SELECT on job_listings and loses INSERT, UPDATE and DELETE there', await has(db, 'anon', 'job_listings', 'SELECT') && !(await has(db, 'anon', 'job_listings', 'INSERT')) && !(await has(db, 'anon', 'job_listings', 'UPDATE')) && !(await has(db, 'anon', 'job_listings', 'DELETE')));

let ok = true, det = [];
for (const t of ENDPOINTS) {
  const keep = PRE[t].anon.filter((p) => !['TRUNCATE', 'TRIGGER', 'REFERENCES'].includes(p)).sort().join(',');
  if (after[`${t}:anon`] !== keep) { ok = false; det.push(`${t}: ${after[`${t}:anon`]} vs ${keep}`); }
}
check('U4 anon keeps SELECT, INSERT, UPDATE and DELETE on waitlist, culture_leads and culture_quiz_events (the unknown writer keeps working)', ok, det.join('; '));

ok = true; det = [];
for (const t of TABLES) {
  const keep = PRE[t].authenticated.filter((p) => !['TRUNCATE', 'TRIGGER', 'REFERENCES'].includes(p)).sort().join(',');
  if (after[`${t}:authenticated`] !== keep) { ok = false; det.push(`${t}: ${after[`${t}:authenticated`]} vs ${keep}`); }
}
check('U5 authenticated keeps exactly its SELECT, INSERT, UPDATE and DELETE on every table (including the three score tables with no INSERT or UPDATE)', ok, det.join('; '));

for (const t of ['mock_sessions', 'star_stories', 'resume_scans']) check(`U6 authenticated still has no INSERT or UPDATE on ${t}`, !(await has(db, 'authenticated', t, 'INSERT')) && !(await has(db, 'authenticated', t, 'UPDATE')));

await db.exec('set role anon');
let anonRead; try { await db.query('select count(*)::int n from public.user_memory'); anonRead = 'allowed'; } catch (e) { anonRead = 'refused'; }
await db.exec('reset role');
check('U7 with a careless policy (using true) on user_memory, anon is still refused: the privilege layer holds', anonRead === 'refused', anonRead);

check('U8 RLS is still on for every table and the policies are untouched', (await db.query(`select count(*)::int n from pg_class where relname = any($1) and relrowsecurity`, [TABLES])).rows[0].n === 20 && (await db.query(`select count(*)::int n from pg_policy`)).rows[0].n === 1);

await db.exec(UP);
check('U9 the up script can be applied twice', JSON.stringify(await snapshot(db)) === JSON.stringify(after));

await db.exec(DOWN);
const restored = await snapshot(db);
const diff = Object.keys(before).filter((k) => before[k] !== restored[k]);
check('D1 the down script restores exactly the privileges held before', diff.length === 0, diff.map((k) => `${k}: ${restored[k]} vs ${before[k]}`).join('; '));

const bad2 = results.filter((t) => !t.ok);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.detail}`);
console.log(`\n${results.length - bad2.length}/${results.length} passed`);
process.exit(bad2.length ? 1 : 0);
