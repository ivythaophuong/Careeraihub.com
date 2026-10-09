// S1 test: the proposed delete-recompute triggers (docs/database/proposed/2026-10-09-recompute-score-on-delete.sql), on an in-memory Postgres.
// Not a production test. Run like the other replica tests:
//   npm i @electric-sql/pglite ; cp this file to a scratch folder ; REPO=/path/to/repo node s1-recompute-on-delete.mjs
//
// The base replica has no foreign keys to auth.users on the score tables; production has them with ON DELETE CASCADE (evidence query 1.8).
// This script adds those four foreign keys so that account deletion behaves as it does in production.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const REPO = process.env.REPO || path.resolve(process.cwd(), '../../..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
const FIX = 'docs/database/proposed/2026-10-09-recompute-score-on-delete.sql';
const DOWN = 'docs/database/proposed/2026-10-09-recompute-score-on-delete.down.sql';

async function freshDb() {
  const db = new PGlite();
  await db.exec(read('docs/database/replica-test/replica.sql'));
  await db.exec(read('docs/database/2026-10-05-lock-scores-and-verify-employers.sql'));
  await db.exec(`create role service_role nologin bypassrls;
    grant usage on schema public, auth to service_role;
    grant all on all tables in schema public to service_role;
    grant execute on all functions in schema public to service_role;`);
  await db.exec(read('docs/database/phase1/001_phase1_foundation.sql'));
  await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;
    alter table public.candidate_trust_profiles add constraint ctp_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
    alter table public.resume_scans add constraint rs_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
    alter table public.mock_sessions add constraint ms_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
    alter table public.star_stories add constraint ss_user_fk foreign key (user_id) references auth.users(id) on delete cascade;`);
  return db;
}

const U = { a: '00000000-0000-0000-0000-00000000000a', b: '00000000-0000-0000-0000-00000000000b', c: '00000000-0000-0000-0000-00000000000c' };
async function seeded() {
  const db = await freshDb();
  for (const [k, id] of Object.entries(U)) await db.query('insert into auth.users values ($1,$2)', [id, `${k}@x.test`]);
  return db;
}
async function as(db, role, uid, sql, params = []) {
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [uid ? JSON.stringify({ sub: uid, role }) : '{}']);
  try { return { rows: (await db.query(sql, params)).rows }; } catch (e) { return { error: e.message }; } finally { await db.exec('reset role'); }
}
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });
const score = async (db, uid) => (await db.query(`select trust_score, ats_score, interview_score, star_score from candidate_trust_profiles where user_id=$1`, [uid])).rows[0];
const seed = async (db, uid, scan, mock, star) => {
  await as(db, 'authenticated', uid, `insert into resume_scans (user_id, credibility_score) values ($1,$2)`, [uid, scan]);
  await as(db, 'authenticated', uid, `insert into mock_sessions (user_id, avg_score) values ($1,$2)`, [uid, mock]);
  await as(db, 'authenticated', uid, `insert into star_stories (user_id, score) values ($1,$2)`, [uid, star]);
};
// 80*0.40 + 60*0.35 + 40*0.25 = 63 ; without the story: 32 + 21 = 53 ; without anything: 0
let db, r;

// ── before the fix: the problem is real ───────────────────────────────────────
db = await seeded();
await seed(db, U.a, 80, 60, 40);
check('B1 baseline score is 63', (await score(db, U.a)).trust_score === 63);
await as(db, 'authenticated', U.a, `delete from star_stories where user_id=$1`, [U.a]);
check('B2 before the fix, deleting the story leaves the score at 63 (F-5)', (await score(db, U.a)).trust_score === 63);

// ── with the fix ──────────────────────────────────────────────────────────────
db = await seeded();
await db.exec(read(FIX));
await seed(db, U.a, 80, 60, 40);
await seed(db, U.b, 100, 100, 100);
await as(db, 'authenticated', U.a, `delete from star_stories where user_id=$1`, [U.a]);
let s = await score(db, U.a);
check('F1 deleting the story recomputes: 53, star 0', s.trust_score === 53 && s.star_score === 0, JSON.stringify(s));
await as(db, 'authenticated', U.a, `delete from mock_sessions where user_id=$1`, [U.a]);
await as(db, 'authenticated', U.a, `delete from resume_scans where user_id=$1`, [U.a]);
s = await score(db, U.a);
check('F2 deleting every input recomputes to 0 (v0 rule; null is a later step)', s.trust_score === 0 && s.ats_score === 0 && s.interview_score === 0, JSON.stringify(s));
check('F3 another candidate is untouched', (await score(db, U.b)).trust_score === 100);

// one statement, several users
db = await seeded();
await db.exec(read(FIX));
await seed(db, U.a, 80, 60, 40); await seed(db, U.b, 100, 100, 100);
await db.query(`delete from mock_sessions`);                       // service/superuser: one statement, two users
check('F4 one DELETE statement touching two users recomputes both', (await score(db, U.a)).trust_score === 42 && (await score(db, U.b)).trust_score === 65,   // A: 80*0.40 + 0 + 40*0.25 = 42 ; B: 100*0.40 + 0 + 100*0.25 = 65
  JSON.stringify([await score(db, U.a), await score(db, U.b)]));

// delete only an old row: the "last 5" window and MAX decide the result
db = await seeded();
await db.exec(read(FIX));
await db.query(`insert into resume_scans (user_id, credibility_score, created_at) values ($1, 90, now() - interval '2 days'), ($1, 50, now())`, [U.a]);
check('F5 setup: MAX is 90', (await score(db, U.a)).ats_score === 90);
await db.query(`delete from resume_scans where user_id=$1 and credibility_score=90`, [U.a]);
check('F6 deleting the best scan lowers ats_score to the remaining 50', (await score(db, U.a)).ats_score === 50);

// account deletion cascade
db = await seeded();
await db.exec(read(FIX));
await seed(db, U.c, 70, 70, 70);
check('F7 setup: user C has a profile', !!(await score(db, U.c)));
let del; try { await db.query(`delete from auth.users where id=$1`, [U.c]); del = {}; } catch (e) { del = { error: e.message }; }
const left = (await db.query(`select (select count(*) from candidate_trust_profiles where user_id=$1)::int p, (select count(*) from resume_scans where user_id=$1)::int r, (select count(*) from mock_sessions where user_id=$1)::int m, (select count(*) from star_stories where user_id=$1)::int s`, [U.c])).rows[0];
check('F8 deleting the account succeeds and leaves no profile or score rows', !del.error && left.p === 0 && left.r === 0 && left.m === 0 && left.s === 0, JSON.stringify({ del, left }));

// privileges
r = await as(db, 'authenticated', U.a, `select public.trigger_recompute_trust_score_after_delete()`);
check('F9 the new function cannot be called by a candidate', !!r.error, JSON.stringify(r));
r = await as(db, 'anon', null, `select public.trigger_recompute_trust_score_after_delete()`);
check('F10 the new function cannot be called anonymously', !!r.error, JSON.stringify(r));
r = await as(db, 'authenticated', U.a, `update candidate_trust_profiles set trust_score = 100 where user_id=$1 returning trust_score`, [U.a]);
check('F11 the score lock from 2026-10-05 still holds', !r.error && (r.rows[0]?.trust_score ?? 0) !== 100, JSON.stringify(r));

// idempotent
db = await seeded();
await db.exec(read(FIX)); await db.exec(read(FIX));
check('F12 the script can be applied twice', ((await db.query(`select count(*)::int n from pg_trigger where tgname like 'trg_trust_on_%_delete'`)).rows[0].n) === 3);

// the guard is needed: without it the account deletion fails
db = await seeded();
await db.exec(read(FIX).replace('if exists (select 1 from auth.users u where u.id = uid) then', 'if true then'));
await seed(db, U.c, 70, 70, 70);
try { await db.query(`delete from auth.users where id=$1`, [U.c]); check('G1 control: without the guard the account deletion fails', false, 'deletion succeeded'); }
catch (e) { check('G1 control: without the guard the account deletion fails (so F8 proves the guard)', true, e.message); }

// down script
db = await seeded();
await db.exec(read(FIX));
await db.exec(read(DOWN));
const objs = (await db.query(`select (select count(*) from pg_trigger where tgname like 'trg_trust_on_%_delete')::int t, (select count(*) from pg_proc where proname='trigger_recompute_trust_score_after_delete')::int f`)).rows[0];
check('D1 the down script removes the triggers and the function', objs.t === 0 && objs.f === 0, JSON.stringify(objs));
await seed(db, U.a, 80, 60, 40);
await as(db, 'authenticated', U.a, `delete from star_stories where user_id=$1`, [U.a]);
check('D2 after the down script the previous behaviour returns', (await score(db, U.a)).trust_score === 63);
check('D3 the down script leaves recompute_trust_score in place', ((await db.query(`select count(*)::int n from pg_proc where proname='recompute_trust_score'`)).rows[0].n) === 1);

for (const x of results) console.log(`${x.ok ? 'PASS' : 'FAIL'}  ${x.name}`);
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
if (process.env.VERBOSE || bad.length) for (const x of bad) console.log('  ', x.name, x.detail);
process.exit(bad.length ? 1 : 0);
