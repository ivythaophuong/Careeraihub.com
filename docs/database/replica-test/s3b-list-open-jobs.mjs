// S3b test: list_open_jobs (docs/database/proposed/2026-10-09-list-open-jobs.sql) on an in-memory Postgres. Not a production test.
//   npm i @electric-sql/pglite ; cp this file to a scratch folder ; REPO=/path/to/repo node s3b-list-open-jobs.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const REPO = process.env.REPO || path.resolve(process.cwd(), '../../..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
const FIX = 'docs/database/proposed/2026-10-09-list-open-jobs.sql';
const DOWN = 'docs/database/proposed/2026-10-09-list-open-jobs.down.sql';
const U = { c: '00000000-0000-0000-0000-00000000000c', o: '00000000-0000-0000-0000-0000000000a0', p: '00000000-0000-0000-0000-0000000000a1' };
const EV = '11111111-1111-1111-1111-1111111111e1', EU = '11111111-1111-1111-1111-1111111111e2';

async function freshDb(fix) {
  const db = new PGlite();
  await db.exec(read('docs/database/replica-test/replica.sql'));
  await db.exec(read('docs/database/2026-10-05-lock-scores-and-verify-employers.sql'));
  await db.exec(`create role service_role nologin bypassrls; grant usage on schema public, auth to service_role; grant all on all tables in schema public to service_role;`);
  await db.exec(`alter table public.employers add column if not exists website text;
    alter table public.job_listings add column if not exists description text, add column if not exists skills_required text[], add column if not exists salary_min int,
      add column if not exists salary_max int, add column if not exists currency text, add column if not exists work_preference text, add column if not exists location text,
      add column if not exists posted_by uuid, add column if not exists created_at timestamptz default now(), add column if not exists closes_at timestamptz;
    grant select on all tables in schema public to authenticated, anon;`);
  for (const [k, id] of Object.entries(U)) await db.query('insert into auth.users values ($1,$2)', [id, `${k}@x.test`]);
  await db.query(`insert into employers (id, owner_id, name, website) values ($1,$2,'Verified Co','https://verified.example'),($3,$4,'Unverified Co','https://unverified.example')`, [EV, U.o, EU, U.p]);
  await db.query(`update employers set verified_at = now() where id = $1`, [EV]);
  await db.query(`insert into job_listings (employer_id, title, status, posted_by, created_at) values
    ($1,'Open job','open',$2, now() - interval '1 hour'),
    ($1,'Newer open job','open',$2, now()),
    ($1,'Closed job','closed',$2, now()),
    ($1,'Expired job','open',$2, now() - interval '3 days'),
    ($3,'Open job of an unverified employer','open',$4, now())`, [EV, U.o, EU, U.p]);
  await db.query(`update job_listings set closes_at = now() - interval '1 day' where title = 'Expired job'`);
  if (fix) await db.exec(fix);
  return db;
}
async function as(db, role, uid, sql, params = []) {
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [uid ? JSON.stringify({ sub: uid, role }) : '{}']);
  try { return { rows: (await db.query(sql, params)).rows }; } catch (e) { return { error: e.message }; } finally { await db.exec('reset role'); }
}
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });

let db = await freshDb(read(FIX));
let r = await as(db, 'authenticated', U.c, `select * from list_open_jobs()`);
const titles = (r.rows || []).map((x) => x.title);
check('J1 a signed-in candidate sees only open, current jobs of verified employers, newest first', JSON.stringify(titles) === '["Newer open job","Open job"]', JSON.stringify(titles));
check('J2 each row carries the employer id and name', r.rows?.[0]?.employer_name === 'Verified Co' && r.rows[0].employer_id === EV, JSON.stringify(r.rows?.[0]));
const gotKeys = Object.keys(r.rows?.[0] || {}).sort().join(',');
const wantKeys = ['created_at', 'currency', 'description', 'employer_id', 'employer_name', 'id', 'location', 'salary_max', 'salary_min', 'skills_required', 'title', 'work_preference'].sort().join(',');
check('J3 exactly the documented columns are returned (no posted_by, no employer website or other employer columns)', gotKeys === wantKeys, gotKeys);
check('J4 jobs of an unverified employer are hidden', !titles.some((t) => /unverified/i.test(t)), JSON.stringify(titles));

r = await as(db, 'authenticated', U.c, `select * from list_open_jobs(1)`);
check('L1 p_limit is honoured', (r.rows || []).length === 1, JSON.stringify(r.rows?.length));
r = await as(db, 'authenticated', U.c, `select * from list_open_jobs(0)`);
check('L2 a limit of 0 is raised to 1', (r.rows || []).length === 1, JSON.stringify(r.rows?.length));
r = await as(db, 'authenticated', U.c, `select * from list_open_jobs(-5)`);
check('L3 a negative limit is raised to 1', (r.rows || []).length === 1);
r = await as(db, 'authenticated', U.c, `select * from list_open_jobs(null)`);
check('L4 a null limit uses the default', !r.error && (r.rows || []).length === 2, JSON.stringify(r));

r = await as(db, 'anon', null, `select * from list_open_jobs()`);
check('A1 anonymous cannot call it', !!r.error, JSON.stringify(r));

// many rows, the cap
const d2 = await freshDb(read(FIX));
await d2.query(`insert into job_listings (employer_id, title, status) select $1, 'bulk ' || g, 'open' from generate_series(1,80) g`, [EV]);
r = await as(d2, 'authenticated', U.c, `select * from list_open_jobs(500)`);
check('L5 the limit is capped at 50', (r.rows || []).length === 50, String(r.rows?.length));

// employer table stays closed
r = await as(db, 'authenticated', U.c, `select name from employers`);
check('E1 the employers table itself stays closed to a candidate', !r.error && (r.rows || []).length === 0, JSON.stringify(r));

// idempotent, mutation, down
await db.exec(read(FIX));
check('I1 the script can be applied twice', ((await db.query(`select count(*)::int n from pg_proc where proname='list_open_jobs'`)).rows[0].n) === 1);
const m = await freshDb(read(FIX).replace("and e.verified_at is not null", ''));
r = await as(m, 'authenticated', U.c, `select * from list_open_jobs()`);
check('T control: without the verified-employer filter a test fails (so J4 is meaningful)', (r.rows || []).some((x) => /unverified/i.test(x.title)));
// the two guards against anonymous callers are independent: test each alone
const gA = await freshDb(read(FIX).replace("revoke execute on function public.list_open_jobs(integer) from public, anon;", ''));
await gA.exec(`grant execute on function public.list_open_jobs(integer) to anon`);   // EXECUTE guard removed: only the auth.uid() condition is left
r = await as(gA, 'anon', null, `select * from list_open_jobs()`);
check('G1 guard 2 alone: with EXECUTE granted to anon the function still returns nothing (auth.uid() condition)', !r.error && (r.rows || []).length === 0, JSON.stringify(r));
const gB = await freshDb(read(FIX).replace('where auth.uid() is not null\n    and ', 'where '));
r = await as(gB, 'anon', null, `select * from list_open_jobs()`);
check('G2 guard 1 alone: with the auth.uid() condition removed, anon is still refused by the missing EXECUTE grant', !!r.error, JSON.stringify(r));
r = await as(gB, 'authenticated', U.c, `select * from list_open_jobs()`);
check('G3 removing the auth.uid() condition does not change what a signed-in user sees (so it only matters if EXECUTE is mis-granted)', (r.rows || []).length === 2, JSON.stringify(r.rows?.length));
await db.exec(`set role authenticated`);
await db.query(`select set_config('request.jwt.claims', '{"role":"authenticated"}', false)`);
let ns; try { ns = { rows: (await db.query(`select * from list_open_jobs()`)).rows }; } catch (e) { ns = { error: e.message }; }
await db.exec('reset role');
check('G4 a token with role authenticated but no user id returns nothing', !ns.error && (ns.rows || []).length === 0, JSON.stringify(ns));
db = await freshDb(read(FIX));
await db.exec(read(DOWN));
check('D1 the down script removes the function', ((await db.query(`select count(*)::int n from pg_proc where proname='list_open_jobs'`)).rows[0].n) === 0);

for (const t of results) console.log(`${t.ok ? 'PASS' : 'FAIL'}  ${t.name}`);
const bad = results.filter((t) => !t.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
for (const t of bad) console.log('  ', t.name, t.detail);
process.exit(bad.length ? 1 : 0);
