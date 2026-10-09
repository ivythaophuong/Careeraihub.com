// S2 test: the proposed trust_matches field lock (docs/database/proposed/2026-10-09-lock-match-fields.sql), on an in-memory Postgres.
// Not a production test.
//   npm i @electric-sql/pglite ; cp this file to a scratch folder ; REPO=/path/to/repo node s2-lock-match-fields.mjs
// The replica's trust_matches is extended with the live columns (job_id, match_score, recruiter_action, candidate_action; evidence query 1.2) and
// authenticated gets table-level UPDATE/INSERT as in production (query 1.4).
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const REPO = process.env.REPO || path.resolve(process.cwd(), '../../..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
const FIX = 'docs/database/proposed/2026-10-09-lock-match-fields.sql';
const DOWN = 'docs/database/proposed/2026-10-09-lock-match-fields.down.sql';

const U = {
  a: '00000000-0000-0000-0000-00000000000a',  // candidate
  b: '00000000-0000-0000-0000-00000000000b',  // another candidate
  o: '00000000-0000-0000-0000-0000000000a0',  // member/owner of verified employer 1
  q: '00000000-0000-0000-0000-0000000000a2',  // owner of verified employer 2
  p: '00000000-0000-0000-0000-0000000000a1',  // owner of an UNverified employer
};
const E1 = '11111111-1111-1111-1111-1111111111e1', E2 = '11111111-1111-1111-1111-1111111111e2', EU = '11111111-1111-1111-1111-1111111111e3';

async function freshDb(fix) {
  const db = new PGlite();
  await db.exec(read('docs/database/replica-test/replica.sql'));
  await db.exec(read('docs/database/2026-10-05-lock-scores-and-verify-employers.sql'));
  await db.exec(`create role service_role nologin bypassrls;
    grant usage on schema public, auth to service_role;
    grant all on all tables in schema public to service_role;
    grant execute on all functions in schema public to service_role;`);
  await db.exec(read('docs/database/phase1/001_phase1_foundation.sql'));
  await db.exec(`alter table public.trust_matches add column if not exists job_id uuid, add column if not exists match_score int default 0,
      add column if not exists recruiter_action text, add column if not exists candidate_action text, add column if not exists updated_at timestamptz default now();
    grant select, insert, update, delete on public.candidate_trust_profiles, public.resume_scans, public.mock_sessions, public.star_stories, public.employers, public.employer_members, public.job_listings, public.trust_matches, public.pipeline_entries to authenticated;`);
  for (const [k, id] of Object.entries(U)) await db.query('insert into auth.users values ($1,$2)', [id, `${k}@x.test`]);
  await db.query(`insert into employers (id, owner_id, name) values ($1,$2,'E1'),($3,$4,'E2'),($5,$6,'EU')`, [E1, U.o, E2, U.q, EU, U.p]);
  await db.query(`update employers set verified_at = now() where id in ($1,$2)`, [E1, E2]);
  await db.query(`insert into candidate_trust_profiles (user_id, full_name, is_visible) values ($1,'A',true)`, [U.a]);
  if (fix) await db.exec(fix);
  return db;
}
async function as(db, role, uid, sql, params = []) {
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [uid ? JSON.stringify({ sub: uid, role }) : '{}']);
  try { const r = await db.query(sql, params); return { rows: r.rows, count: r.affectedRows ?? r.rows.length }; } catch (e) { return { error: e.message }; } finally { await db.exec('reset role'); }
}
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });
const row = async (db, id) => (await db.query(`select match_score, status, recruiter_action, candidate_action, job_id from trust_matches where id=$1`, [id])).rows[0];
const newMatch = async (db) => (await as(db, 'authenticated', U.o, `insert into trust_matches (employer_id, candidate_id, status) values ($1,$2,'new') returning id`, [E1, U.a])).rows[0].id;
const cand = (db, sql, p) => as(db, 'authenticated', U.a, sql, p);
const rec = (db, sql, p) => as(db, 'authenticated', U.o, sql, p);

// ── before the fix ────────────────────────────────────────────────────────────
let db = await freshDb();
let m = await newMatch(db);
let r = await cand(db, `update trust_matches set match_score = 100, recruiter_action = 'shortlisted', status = 'matched' where id=$1`, [m]);
check('B1 before the fix a candidate can set match_score, recruiter_action and status (F-2)', !r.error && (await row(db, m)).match_score === 100);
r = await rec(db, `update trust_matches set match_score = 77, candidate_action = 'interested' where id=$1`, [m]);
check('B2 before the fix a recruiter can set match_score and candidate_action', !r.error && (await row(db, m)).match_score === 77);

// ── with the fix ──────────────────────────────────────────────────────────────
db = await freshDb(read(FIX));
m = await newMatch(db);
let x = await row(db, m);
check('F1 setup: the recruiter created the match with match_score 0 and no candidate_action', x.match_score === 0 && x.candidate_action === null, JSON.stringify(x));

r = await rec(db, `insert into trust_matches (employer_id, candidate_id, status, match_score, candidate_action) values ($1,$2,'new',100,'interested') returning id, match_score, candidate_action`, [E1, U.a]);
check('F2 an insert cannot plant match_score or candidate_action', !r.error && r.rows[0].match_score === 0 && r.rows[0].candidate_action === null, JSON.stringify(r));

for (const [label, set] of [['match_score', `match_score = 100`], ['recruiter_action', `recruiter_action = 'shortlisted'`], ['status', `status = 'matched'`], ['job_id', `job_id = gen_random_uuid()`]]) {
  r = await cand(db, `update trust_matches set ${set} where id=$1`, [m]);
  check(`C-${label} a candidate cannot change ${label}`, !!r.error, JSON.stringify(r));
}
r = await cand(db, `update trust_matches set candidate_action = 'interested', updated_at = now() where id=$1 returning candidate_action`, [m]);
check('C-ok a candidate can record candidate_action (and touch updated_at)', !r.error && r.rows[0]?.candidate_action === 'interested', JSON.stringify(r));
r = await cand(db, `update trust_matches set employer_id = $1 where id=$2`, [E2, m]);
check('C-party a candidate still cannot change the employer (lock_row_parties)', !!r.error, JSON.stringify(r));
r = await as(db, 'authenticated', U.b, `update trust_matches set candidate_action = 'declined' where id=$1 returning id`, [m]);
check('C-other another candidate cannot touch the match (RLS)', !r.error && r.rows.length === 0 && (await row(db, m)).candidate_action === 'interested', JSON.stringify(r));

for (const [label, set] of [['match_score', `match_score = 100`], ['candidate_action', `candidate_action = 'declined'`], ['job_id', `job_id = gen_random_uuid()`]]) {   // 'declined' differs from the candidate's earlier 'interested'
  r = await rec(db, `update trust_matches set ${set} where id=$1`, [m]);
  check(`R-${label} a recruiter cannot change ${label}`, !!r.error, JSON.stringify(r));
}
r = await rec(db, `update trust_matches set recruiter_action = 'shortlisted', status = 'review' where id=$1 returning recruiter_action, status`, [m]);
check('R-ok a verified recruiter can change recruiter_action and status', !r.error && r.rows[0]?.recruiter_action === 'shortlisted' && r.rows[0]?.status === 'review', JSON.stringify(r));
r = await as(db, 'authenticated', U.q, `update trust_matches set recruiter_action = 'rejected' where id=$1 returning id`, [m]);
check('R-other a verified recruiter of ANOTHER employer cannot change it (RLS)', !r.error && r.rows.length === 0 && (await row(db, m)).recruiter_action === 'shortlisted', JSON.stringify(r));
r = await as(db, 'authenticated', U.p, `update trust_matches set recruiter_action = 'rejected' where id=$1 returning id`, [m]);
check('R-unverified the owner of an unverified employer cannot change it', !r.error && r.rows.length === 0, JSON.stringify(r));

r = await as(db, 'anon', null, `update trust_matches set recruiter_action = 'x' where id=$1`, [m]);
check('A1 anonymous cannot change a match', !!r.error || r.count === 0, JSON.stringify(r));

// candidate who is also a member of the employer: candidate rules apply
await db.query(`insert into employer_members (employer_id, user_id, role) values ($1,$2,'recruiter')`, [E1, U.a]);
r = await cand(db, `update trust_matches set recruiter_action = 'self-approved' where id=$1`, [m]);
check('D1 a candidate who is also an employer member still gets the candidate rules', !!r.error, JSON.stringify(r));

// server path
r = await as(db, 'service_role', null, `update trust_matches set match_score = 88, status = 'matched', candidate_action = 'interested' where id=$1 returning match_score`, [m]);
check('S1 the service role can set match_score (future server-side scoring)', !r.error && r.rows[0]?.match_score === 88, JSON.stringify(r));
await db.query(`update trust_matches set match_score = 91 where id=$1`, [m]);
check('S2 the SQL editor (superuser) is not restricted', (await row(db, m)).match_score === 91);

// idempotent + privileges
await db.exec(read(FIX));
check('I1 the script can be applied twice', ((await db.query(`select count(*)::int n from pg_trigger where tgname='trg_lock_match_fields'`)).rows[0].n) === 1);

// the tests test themselves: remove each safeguard and a test must fail
const variants = [
  ['no candidate restriction', (s) => s.replace("(to_jsonb(new) - 'candidate_action' - 'updated_at') is distinct from (to_jsonb(old) - 'candidate_action' - 'updated_at')", 'false'), 'C-match_score'],
  ['no recruiter restriction', (s) => s.replace("(to_jsonb(new) - 'recruiter_action' - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'recruiter_action' - 'status' - 'updated_at')", 'false'), 'R-match_score'],
  ['no insert reset', (s) => s.replace('new.match_score := 0;', ''), 'F2'],
];
for (const [name, mutate, expectFail] of variants) {
  const d = await freshDb(mutate(read(FIX)));
  const mm = (await as(d, 'authenticated', U.o, `insert into trust_matches (employer_id, candidate_id, status) values ($1,$2,'new') returning id`, [E1, U.a])).rows[0].id;
  let caught;
  if (expectFail === 'C-match_score') caught = !(await as(d, 'authenticated', U.a, `update trust_matches set match_score = 100 where id=$1`, [mm])).error;
  if (expectFail === 'R-match_score') caught = !(await as(d, 'authenticated', U.o, `update trust_matches set match_score = 100 where id=$1`, [mm])).error;
  if (expectFail === 'F2') { const ins = await as(d, 'authenticated', U.o, `insert into trust_matches (employer_id, candidate_id, status, match_score) values ($1,$2,'new',100) returning match_score`, [E1, U.a]); caught = ins.rows?.[0]?.match_score === 100; }
  check(`G control: with "${name}" the matching test fails (so the test is meaningful)`, caught);
}

// down script
db = await freshDb(read(FIX));
await db.exec(read(DOWN));
check('D1d the down script removes the trigger and the function', ((await db.query(`select (select count(*) from pg_trigger where tgname='trg_lock_match_fields')::int t, (select count(*) from pg_proc where proname='lock_match_fields')::int f`)).rows[0]).t === 0);
m = await newMatch(db);
r = await cand(db, `update trust_matches set match_score = 100 where id=$1`, [m]);
check('D2d after the down script the previous behaviour returns', !r.error && (await row(db, m)).match_score === 100);
check('D3d the down script keeps lock_row_parties', ((await db.query(`select count(*)::int n from pg_trigger where tgname='trg_lock_row_parties'`)).rows[0].n) >= 1);

for (const t of results) console.log(`${t.ok ? 'PASS' : 'FAIL'}  ${t.name}`);
const bad = results.filter((t) => !t.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
for (const t of bad) console.log('  ', t.name, t.detail);
process.exit(bad.length ? 1 : 0);
