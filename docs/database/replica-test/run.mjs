import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const applyMigration = process.argv[2] === 'after';
const db = new PGlite();
await db.exec(fs.readFileSync('replica.sql', 'utf8'));
if (applyMigration) await db.exec(fs.readFileSync(process.argv[3], 'utf8'));

const U = { cand: '00000000-0000-0000-0000-0000000000a1', other: '00000000-0000-0000-0000-0000000000b2',
  hidden: '00000000-0000-0000-0000-0000000000c3', attacker: '00000000-0000-0000-0000-0000000000d4',
  recruiter: '00000000-0000-0000-0000-0000000000e5' };
for (const [k, id] of Object.entries(U)) await db.query('insert into auth.users values ($1,$2)', [id, `${k}@x.test`]);

// Run `sql` as a browser user (authenticated/anon). Returns { rows } or { error }.
async function as(role, uid, sql, params = []) {
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [uid ? JSON.stringify({ sub: uid, role }) : '{}']);
  try { return { rows: (await db.query(sql, params)).rows }; }
  catch (e) { return { error: e.message }; }
  finally { await db.exec('reset role'); }
}
const admin = async (sql, p = []) => (await db.query(sql, p)).rows;

// Seed (as admin): a visible candidate "other", a hidden candidate "hidden", the candidate under test.
await admin(`insert into candidate_trust_profiles (user_id, full_name, bio, is_visible) values
  ('${U.other}','Visible Person','bio',true), ('${U.hidden}','Hidden Person','secret',false), ('${U.cand}','Cand','b',false)`);
await admin(`insert into employers (id, owner_id, name) values ('11111111-1111-1111-1111-111111111111','${U.recruiter}','Real Co')`);
await admin(`insert into employer_members values ('11111111-1111-1111-1111-111111111111','${U.recruiter}','owner')`);
await admin(`insert into job_listings (employer_id, title, status) values ('11111111-1111-1111-1111-111111111111','Real job','open')`);
const verifyReal = () => !applyMigration ? null : admin(`update employers set verified_at = now() where id = '11111111-1111-1111-1111-111111111111'`);

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const hasCol = applyMigration;

// ── Attacks (expected BLOCKED after the fix) ───────────────────────────────
let r = await as('authenticated', U.cand, `update candidate_trust_profiles set trust_score=100, ats_score=100 where user_id=$1 returning trust_score, ats_score`, [U.cand]);
check('A1 candidate cannot set own trust_score', r.rows?.[0]?.trust_score === 0 && r.rows?.[0]?.ats_score === 0, JSON.stringify(r));

r = await as('authenticated', U.cand, `insert into candidate_trust_profiles (user_id, trust_score) values ('${U.attacker}', 99) returning trust_score`);
check('A2 insert with forged score is neutralised or rejected', r.error || r.rows?.[0]?.trust_score === 0, JSON.stringify(r));

r = await as('authenticated', U.attacker, `select recompute_trust_score('${U.cand}')`);
check('A3 logged-in user cannot call recompute_trust_score', !!r.error, JSON.stringify(r));
r = await as('anon', null, `select recompute_trust_score('${U.cand}')`);
check('A4 anon cannot call recompute_trust_score', !!r.error, JSON.stringify(r));

// Self-made employer + membership, then try to read profiles.
await as('authenticated', U.attacker, `insert into employers (id, owner_id, name) values ('22222222-2222-2222-2222-222222222222','${U.attacker}','Fake Co')`);
await as('authenticated', U.attacker, `insert into employer_members values ('22222222-2222-2222-2222-222222222222','${U.attacker}','owner')`);
r = await as('authenticated', U.attacker, `select full_name from candidate_trust_profiles where user_id <> '${U.attacker}'`);
check('A5 self-made employer cannot read visible profiles', (r.rows || []).length === 0, JSON.stringify(r));

r = await as('authenticated', U.attacker, `update employers set verified_at = now() where id='22222222-2222-2222-2222-222222222222' returning verified_at`);
check('A6 owner cannot self-verify (update)', applyMigration ? (r.rows?.[0]?.verified_at === null || r.error) : false, JSON.stringify(r));
r = await as('authenticated', U.attacker, `insert into employers (owner_id, name, verified_at) values ('${U.attacker}','Fake 2', now()) returning verified_at`);
check('A7 owner cannot self-verify (insert)', applyMigration ? (r.rows?.[0]?.verified_at === null || r.error) : false, JSON.stringify(r));

r = await as('authenticated', U.attacker, `insert into trust_matches (employer_id, candidate_id, status) values ('22222222-2222-2222-2222-222222222222','${U.hidden}','x') returning id`);
check('A8 unverified employer cannot create a match (hidden candidate)', !!r.error, JSON.stringify(r));
r = await as('authenticated', U.attacker, `insert into pipeline_entries (employer_id, candidate_id) values ('22222222-2222-2222-2222-222222222222','${U.other}') returning id`);
check('A9 unverified employer cannot add pipeline entry', !!r.error, JSON.stringify(r));

await as('authenticated', U.attacker, `insert into job_listings (employer_id, title, status) values ('22222222-2222-2222-2222-222222222222','Scam job','open')`);
r = await as('anon', null, `select title from job_listings order by title`);
check('A10 public cannot see jobs of unverified employer', !(r.rows || []).some(x => x.title === 'Scam job'), JSON.stringify(r));

r = await as('authenticated', U.attacker, `insert into resume_scans (user_id, credibility_score) values ('${U.attacker}', 1000000) returning id`);
check('A11 absurd score rejected', !!r.error, JSON.stringify(r));

// Match re-pointing by the candidate (needs a legit match first).
await verifyReal();
await admin(`insert into trust_matches (id, employer_id, candidate_id, status) values ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','${U.other}','new')`);
r = await as('authenticated', U.other, `update trust_matches set employer_id='22222222-2222-2222-2222-222222222222' where id='33333333-3333-3333-3333-333333333333' returning employer_id`);
check('A12 candidate cannot re-point a match to another employer', !!r.error || (r.rows || []).length === 0, JSON.stringify(r));

// ── Legitimate paths (expected to KEEP WORKING) ────────────────────────────
r = await as('authenticated', U.cand, `insert into candidate_trust_profiles (user_id, full_name, headline, is_visible) values ($1,'New Name','Dev',true)
  on conflict (user_id) do update set full_name = excluded.full_name, headline = excluded.headline, is_visible = excluded.is_visible returning full_name, is_visible`, [U.cand]);
check('L1 candidate can save own profile (upsert, no score columns)', r.rows?.[0]?.full_name === 'New Name' && r.rows?.[0]?.is_visible === true, JSON.stringify(r));

await as('authenticated', U.cand, `insert into resume_scans (user_id, credibility_score) values ('${U.cand}', 80)`);
await as('authenticated', U.cand, `insert into mock_sessions (user_id, avg_score) values ('${U.cand}', 60)`);
r = await as('authenticated', U.cand, `select trust_score, ats_score, interview_score from candidate_trust_profiles where user_id='${U.cand}'`);
check('L2 trigger still computes trust (80*.4 + 60*.35 = 53)', r.rows?.[0]?.trust_score === 53 && r.rows?.[0]?.ats_score === 80, JSON.stringify(r));

r = await as('authenticated', U.cand, `select user_id from candidate_trust_profiles`);
check('L3 candidate still reads own profile only', (r.rows || []).length === 1, JSON.stringify(r));

r = await as('authenticated', U.recruiter, `select full_name from candidate_trust_profiles where user_id='${U.other}'`);
check('L4 verified employer reads a visible profile', (r.rows || []).length === 1, JSON.stringify(r));
r = await as('authenticated', U.recruiter, `select full_name from candidate_trust_profiles where user_id='${U.hidden}'`);
check('L5 verified employer cannot read a hidden profile', (r.rows || []).length === 0, JSON.stringify(r));

r = await as('authenticated', U.recruiter, `insert into trust_matches (employer_id, candidate_id, status) values ('11111111-1111-1111-1111-111111111111','${U.other}','new') returning id`);
check('L6 verified employer can match a visible candidate', !r.error, JSON.stringify(r));
r = await as('authenticated', U.recruiter, `insert into trust_matches (employer_id, candidate_id, status) values ('11111111-1111-1111-1111-111111111111','${U.hidden}','new') returning id`);
check('L7 verified employer cannot match a hidden candidate', !!r.error, JSON.stringify(r));

r = await as('anon', null, `select title from job_listings`);
check('L8 public sees verified employer jobs', (r.rows || []).some(x => x.title === 'Real job'), JSON.stringify(r));

r = await as('authenticated', U.other, `update trust_matches set status='interested' where id='33333333-3333-3333-3333-333333333333' returning status`);
check('L9 candidate can still change match status', r.rows?.[0]?.status === 'interested', JSON.stringify(r));

r = await as('authenticated', U.recruiter, `insert into job_listings (employer_id, title, status) values ('11111111-1111-1111-1111-111111111111','Another','draft') returning id`);
check('L10 employer member can still manage own jobs', !r.error, JSON.stringify(r));

for (const x of results) console.log(`${x.ok ? 'PASS' : 'FAIL'}  ${x.name}${x.ok ? '' : '\n        ' + x.detail}`);
console.log(`\n${results.filter(x => x.ok).length}/${results.length} passed (${applyMigration ? 'AFTER' : 'BEFORE'} migration)`);
