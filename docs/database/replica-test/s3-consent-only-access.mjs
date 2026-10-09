// S3 test: consent-only recruiter access (docs/database/proposed/2026-10-09-consent-only-recruiter-access.sql), on an in-memory Postgres.
// Not a production test.
//   npm i @electric-sql/pglite ; cp this file to a scratch folder ; REPO=/path/to/repo node s3-consent-only-access.mjs
// Actors: candidate A (owner), candidate B, verified recruiter O (employer E1), verified recruiter Q (employer E2), owner P of an UNverified employer, anonymous, service role.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const REPO = process.env.REPO || path.resolve(process.cwd(), '../../..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
const FIX = 'docs/database/proposed/2026-10-09-consent-only-recruiter-access.sql';
const DOWN = 'docs/database/proposed/2026-10-09-consent-only-recruiter-access.down.sql';

const U = {
  a: '00000000-0000-0000-0000-00000000000a', b: '00000000-0000-0000-0000-00000000000b',
  o: '00000000-0000-0000-0000-0000000000a0', q: '00000000-0000-0000-0000-0000000000a2', p: '00000000-0000-0000-0000-0000000000a1',
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
      add column if not exists recruiter_action text, add column if not exists candidate_action text;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant select, insert, update, delete on public.candidate_trust_profiles to anon;`);
  for (const [k, id] of Object.entries(U)) await db.query('insert into auth.users values ($1,$2)', [id, `${k}@x.test`]);
  await db.query(`insert into employers (id, owner_id, name) values ($1,$2,'E1'),($3,$4,'E2'),($5,$6,'EU')`, [E1, U.o, E2, U.q, EU, U.p]);
  await db.query(`update employers set verified_at = now() where id in ($1,$2)`, [E1, E2]);
  await db.query(`insert into candidate_trust_profiles (user_id, full_name, headline, bio, skills, location, work_preference, salary_min, salary_max, currency, is_visible, trust_score)
    values ($1,'Alice','Data analyst','private bio','{sql,python}','Singapore','remote',90000,120000,'SGD',true,77)`, [U.a]);
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
const view = (db, who, uid, emp, cand = U.a) => as(db, who, uid, `select * from employer_view_candidates($1,$2)`, [emp, cand]);
const grant = (db, emp, parts, purpose = 'recruiter_review', interval = '30 days') =>
  as(db, 'authenticated', U.a, `insert into consents (employer_id, scope, purpose, expires_at) values ($1,$2::jsonb,$3, now() + $4::interval) returning id`, [emp, JSON.stringify({ parts }), purpose, interval]);
const none = (r) => !r.error && (r.rows || []).length === 0;

// ── before the fix (the problem) ──────────────────────────────────────────────
let db = await freshDb();
let r = await as(db, 'authenticated', U.o, `select full_name, salary_min, trust_score from candidate_trust_profiles where user_id=$1`, [U.a]);
check('B1 before the fix a verified recruiter reads name, salary and the practice score with no consent (F-4)', r.rows?.[0]?.salary_min === 90000 && r.rows[0].trust_score === 77, JSON.stringify(r));

// ── with the fix ──────────────────────────────────────────────────────────────
db = await freshDb(read(FIX));

// no consent
r = await as(db, 'authenticated', U.o, `select * from candidate_trust_profiles where user_id=$1`, [U.a]);
check('N1 no consent: the recruiter has no direct access to the profile table', none(r), JSON.stringify(r));
r = await view(db, 'authenticated', U.o, E1);
check('N2 no consent: the recruiter function returns nothing', none(r), JSON.stringify(r));
r = await as(db, 'authenticated', U.o, `select * from employer_view_candidates($1,null)`, [E1]);
check('N3 no consent: listing all candidates returns nothing', none(r), JSON.stringify(r));

// controls: candidate side and others
r = await as(db, 'authenticated', U.a, `select trust_score from candidate_trust_profiles where user_id=$1`, [U.a]);
check('K1 the candidate still reads their own profile', r.rows?.[0]?.trust_score === 77, JSON.stringify(r));
r = await as(db, 'authenticated', U.b, `select * from candidate_trust_profiles where user_id=$1`, [U.a]);
check('K2 another candidate cannot read it', none(r), JSON.stringify(r));
r = await as(db, 'anon', null, `select * from candidate_trust_profiles`);
check('K3 anonymous gets no rows (an error or empty both mean no data)', !!r.error || (r.rows || []).length === 0, JSON.stringify(r));
r = await view(db, 'anon', null, E1);
check('K4 anonymous cannot call the recruiter function', !!r.error, JSON.stringify(r));

// grant profile only
r = await grant(db, E1, ['profile']);
const c1 = r.rows?.[0]?.id;
check('G1 the candidate can grant a consent (profile)', !!c1, JSON.stringify(r));
r = await view(db, 'authenticated', U.o, E1);
let v = r.rows?.[0];
check('G2 consent for "profile": the recruiter sees name, headline, bio, skills, location', v && v.full_name === 'Alice' && v.headline === 'Data analyst' && v.bio === 'private bio' && v.location === 'Singapore', JSON.stringify(r));
check('G3 consent for "profile" only: the salary is hidden', v && v.salary_min === null && v.salary_max === null && v.currency === null, JSON.stringify(v));
check('G4 the practice score is never returned', v && !('trust_score' in v) && !('ats_score' in v), Object.keys(v || {}).join(','));
check('G5 the consented parts are reported', JSON.stringify(v?.consented_parts) === '["profile"]', JSON.stringify(v?.consented_parts));
r = await as(db, 'authenticated', U.o, `select * from candidate_trust_profiles where user_id=$1`, [U.a]);
check('G6 even with consent the base table stays closed to the recruiter', none(r), JSON.stringify(r));
r = await view(db, 'authenticated', U.q, E2);
check('G7 a verified recruiter of ANOTHER employer sees nothing', none(r), JSON.stringify(r));
r = await view(db, 'authenticated', U.q, E1);
check('G8 ...and cannot read as employer E1 either (not a member)', none(r), JSON.stringify(r));
r = await view(db, 'authenticated', U.p, EU);
check('G9 the owner of an unverified employer sees nothing', none(r), JSON.stringify(r));

// salary part, combination
r = await grant(db, E1, ['salary']);
r = await view(db, 'authenticated', U.o, E1);
v = r.rows?.[0];
check('P1 a second consent adds "salary": salary visible, parts combined', v && v.salary_min === 90000 && v.salary_max === 120000 && v.currency === 'SGD' && JSON.stringify([...v.consented_parts].sort()) === '["profile","salary"]', JSON.stringify(v));

// salary alone is not enough
let db2 = await freshDb(read(FIX));
await grant(db2, E1, ['salary']);
check('P2 a consent for "salary" alone exposes nothing (profile is required)', none(await view(db2, 'authenticated', U.o, E1)));
db2 = await freshDb(read(FIX));
await grant(db2, E1, ['evidence']);
check('P3 a consent for "evidence" exposes no profile data', none(await view(db2, 'authenticated', U.o, E1)));
db2 = await freshDb(read(FIX));
await grant(db2, E1, ['profile'], 'verification_share');
check('P4 a consent for another purpose ("verification_share") does not allow profile reads', none(await view(db2, 'authenticated', U.o, E1)));
db2 = await freshDb(read(FIX));
await grant(db2, E2, ['profile']);
check('P5 a consent for employer E2 does not open the profile to E1', none(await view(db2, 'authenticated', U.o, E1)));
db2 = await freshDb(read(FIX));
await db2.query(`update candidate_trust_profiles set is_visible = false where user_id=$1`, [U.a]);
await grant(db2, E1, ['profile']);
check('P6 is_visible = false does not override an explicit consent', (await view(db2, 'authenticated', U.o, E1)).rows?.length === 1);
db2 = await freshDb(read(FIX));
check('P7 is_visible = true without a consent grants nothing', none(await view(db2, 'authenticated', U.o, E1)));

// consent for an unverified employer is useless
db2 = await freshDb(read(FIX));
await grant(db2, EU, ['profile']);
check('P8 a consent to an unverified employer exposes nothing', none(await view(db2, 'authenticated', U.p, EU)));

// revocation and expiry
r = await as(db, 'authenticated', U.a, `update consents set revoked_at = now() where id=$1`, [c1]);
r = await view(db, 'authenticated', U.o, E1);
check('R1 after revoking the profile consent the recruiter sees nothing at once (the salary consent alone is not enough)', none(r), JSON.stringify(r));
db2 = await freshDb(read(FIX));
await grant(db2, E1, ['profile'], 'recruiter_review', '2 seconds');
check('R2 setup: a short consent is readable', (await view(db2, 'authenticated', U.o, E1)).rows?.length === 1);
await db2.query(`select pg_sleep(2.5)`);
check('R3 an expired consent exposes nothing', none(await view(db2, 'authenticated', U.o, E1)));

// consent probing
db2 = await freshDb(read(FIX));
await grant(db2, E1, ['profile']);
r = await as(db2, 'authenticated', U.b, `select employer_has_consent($1,$2,'profile') as ok`, [U.a, E1]);
check('X1 a non-member cannot use the helper to learn that a consent exists', r.rows?.[0]?.ok === false, JSON.stringify(r));
r = await as(db2, 'authenticated', U.o, `select employer_has_consent($1,$2,'profile') as ok`, [U.a, E1]);
check('X2 a verified member sees true for their own employer', r.rows?.[0]?.ok === true, JSON.stringify(r));
r = await as(db2, 'anon', null, `select employer_has_consent($1,$2,'profile')`, [U.a, E1]);
check('X3 anonymous cannot call the helper', !!r.error, JSON.stringify(r));

// matches and pipeline
db2 = await freshDb(read(FIX));
r = await as(db2, 'authenticated', U.o, `insert into trust_matches (employer_id, candidate_id, status) values ($1,$2,'new') returning id`, [E1, U.a]);
check('M1 no consent: a recruiter cannot create a match (even for a visible candidate)', !!r.error, JSON.stringify(r));
r = await as(db2, 'authenticated', U.o, `insert into pipeline_entries (employer_id, candidate_id) values ($1,$2) returning id`, [E1, U.a]);
check('M2 no consent: a recruiter cannot add a pipeline entry', !!r.error, JSON.stringify(r));
const cm = (await grant(db2, E1, ['profile'])).rows?.[0]?.id;
r = await as(db2, 'authenticated', U.o, `insert into trust_matches (employer_id, candidate_id, status) values ($1,$2,'new') returning id`, [E1, U.a]);
check('M3 with consent a recruiter can create a match', !r.error && r.rows?.length === 1, JSON.stringify(r));
r = await as(db2, 'authenticated', U.o, `insert into pipeline_entries (employer_id, candidate_id) values ($1,$2) returning id`, [E1, U.a]);
check('M4 with consent a recruiter can add a pipeline entry', !r.error && r.rows?.length === 1, JSON.stringify(r));
r = await as(db2, 'authenticated', U.q, `insert into trust_matches (employer_id, candidate_id, status) values ($1,$2,'new') returning id`, [E1, U.a]);
check('M5 a recruiter of another employer cannot create a match for E1', !!r.error, JSON.stringify(r));
await as(db2, 'authenticated', U.a, `update consents set revoked_at = now() where id=$1`, [cm]);
r = await as(db2, 'authenticated', U.o, `insert into trust_matches (employer_id, candidate_id, status) values ($1,$2,'new') returning id`, [E1, U.a]);
check('M6 after revocation a recruiter cannot create another match', !!r.error, JSON.stringify(r));
r = await as(db2, 'authenticated', U.o, `select id from trust_matches where employer_id=$1`, [E1]);
check('M7 documented limit: the match created earlier stays visible to its employer (ids and status only)', (r.rows || []).length === 1, JSON.stringify(r));

// ── security matrix: who can touch consents, and what a revocation stops ─────
db2 = await freshDb(read(FIX));
const cA = (await grant(db2, E1, ['profile'])).rows[0].id;
r = await as(db2, 'authenticated', U.b, `select * from consents`);
check('Q1 another candidate cannot read this candidate\'s consents', none(r), JSON.stringify(r));
r = await as(db2, 'authenticated', U.b, `update consents set revoked_at = now() where id=$1 returning id`, [cA]);
check('Q2 another candidate cannot revoke it (no row is changed)', none(r) && (await view(db2, 'authenticated', U.o, E1)).rows?.length === 1, JSON.stringify(r));
r = await as(db2, 'authenticated', U.o, `select * from consents`);
check('Q3 a recruiter cannot read any consent row', none(r), JSON.stringify(r));
r = await as(db2, 'authenticated', U.o, `update consents set revoked_at = now() where id=$1 returning id`, [cA]);
check('Q4 a recruiter cannot revoke or change a consent', none(r) && (await view(db2, 'authenticated', U.o, E1)).rows?.length === 1, JSON.stringify(r));
r = await as(db2, 'authenticated', U.o, `insert into consents (candidate_id, employer_id, scope, purpose, expires_at) values ($1,$2,'{"parts":["profile"]}','recruiter_review', now() + interval '30 days')`, [U.b, E1]);
const forged = await db2.query(`select count(*)::int n from consents where candidate_id = $1`, [U.b]);
check('Q5 a recruiter cannot create a consent in a candidate\'s name', !!r.error || forged.rows[0].n === 0, JSON.stringify({ r, forged: forged.rows[0] }));

for (const [label, setClause] of [
  ['scope (escalation)', `scope = '{"parts":["profile","salary"]}'`],
  ['employer_id', `employer_id = '${E2}'`],
  ['purpose', `purpose = 'matching'`],
  ['expires_at', `expires_at = now() + interval '300 days'`],
  ['candidate_id', `candidate_id = '${U.b}'`],
]) {
  r = await as(db2, 'authenticated', U.a, `update consents set ${setClause} where id=$1`, [cA]);
  check(`Q6 the candidate cannot edit ${label} of a consent`, !!r.error, JSON.stringify(r));
}
check('Q7 after those attempts the consent is unchanged and still gives profile only',
  JSON.stringify((await view(db2, 'authenticated', U.o, E1)).rows?.[0]?.consented_parts) === '["profile"]');

const badConsents = [
  ['an unknown purpose', `'{"parts":["profile"]}'`, `'sell_my_data'`, `now() + interval '30 days'`],
  ['a scope without parts', `'{"x":1}'`, `'recruiter_review'`, `now() + interval '30 days'`],
  ['an expiry beyond 365 days', `'{"parts":["profile"]}'`, `'recruiter_review'`, `now() + interval '400 days'`],
  ['an expiry in the past', `'{"parts":["profile"]}'`, `'recruiter_review'`, `now() - interval '1 day'`],
];
for (const [label, scope, purpose, exp] of badConsents) {
  r = await as(db2, 'authenticated', U.a, `insert into consents (employer_id, scope, purpose, expires_at) values ($1, ${scope}::jsonb, ${purpose}, ${exp})`, [E1]);
  check(`Q8 a consent with ${label} is rejected`, !!r.error, JSON.stringify(r));
}

// revoke everything for one employer in ONE request
db2 = await freshDb(read(FIX));
await grant(db2, E1, ['profile']);
await grant(db2, E1, ['salary']);
const old = (await grant(db2, E1, ['profile'])).rows[0].id;
await as(db2, 'authenticated', U.a, `update consents set revoked_at = now() where id=$1`, [old]);           // one already revoked
await grant(db2, E1, ['profile'], 'recruiter_review', '1 second');                                              // one that will have expired
const other = (await grant(db2, E2, ['profile'])).rows[0].id;                                                  // another employer
await db2.query(`select pg_sleep(1.5)`);
check('H0 setup: the employer is readable with several consents', (await view(db2, 'authenticated', U.o, E1)).rows?.length === 1);
r = await as(db2, 'authenticated', U.a, `update consents set revoked_at = now() where employer_id = $1 and revoked_at is null returning id`, [E1]);
check('H1 one request revokes every consent of that employer that is not yet revoked (active and expired ones; 3 rows)', !r.error && r.rows.length === 3, JSON.stringify(r));
check('H2 the employer reads nothing at once', none(await view(db2, 'authenticated', U.o, E1)));
check('H3 a consent for another employer is untouched', (await view(db2, 'authenticated', U.q, E2)).rows?.length === 1);
r = await as(db2, 'authenticated', U.a, `update consents set revoked_at = now() where employer_id = $1 and revoked_at is null returning id`, [E1]);
check('H4 repeating it changes nothing and does not fail (idempotent)', none(r), JSON.stringify(r));
r = await as(db2, 'authenticated', U.a, `update consents set revoked_at = now() where employer_id = $1`, [E1]);
check('H5 documented: without "revoked_at is null" the request fails on a row that is already revoked, so the filter is part of the contract', !!r.error, JSON.stringify(r));
r = await as(db2, 'authenticated', U.a, `update consents set revoked_at = null where employer_id = $1 returning id`, [E1]);
check('H6 a revocation cannot be undone by the candidate', !!r.error || (r.rows || []).length === 0, JSON.stringify(r));

// after revocation every protected path refuses
db2 = await freshDb(read(FIX));
const cRev = (await grant(db2, E1, ['profile', 'salary'])).rows[0].id;
await as(db2, 'authenticated', U.a, `update consents set revoked_at = now() where id=$1`, [cRev]);
const paths = {
  'recruiter function': none(await view(db2, 'authenticated', U.o, E1)),
  'recruiter list': none(await as(db2, 'authenticated', U.o, `select * from employer_view_candidates($1,null)`, [E1])),
  'base table': none(await as(db2, 'authenticated', U.o, `select * from candidate_trust_profiles where user_id=$1`, [U.a])),
  'helper': (await as(db2, 'authenticated', U.o, `select employer_has_consent($1,$2,'profile') ok`, [U.a, E1])).rows?.[0]?.ok === false,
  'new match': !!(await as(db2, 'authenticated', U.o, `insert into trust_matches (employer_id, candidate_id, status) values ($1,$2,'new')`, [E1, U.a])).error,
  'new pipeline entry': !!(await as(db2, 'authenticated', U.o, `insert into pipeline_entries (employer_id, candidate_id) values ($1,$2)`, [E1, U.a])).error,
};
for (const [k, ok] of Object.entries(paths)) check(`W revocation closes: ${k}`, ok);

// function contract
db2 = await freshDb(read(FIX));
await grant(db2, E1, ['profile', 'salary', 'email', 'credentials', 'resume']);
r = await view(db2, 'authenticated', U.o, E1);
const keys = Object.keys(r.rows?.[0] || {}).sort().join(',');
const expected = ['bio', 'consent_expires_at', 'consented_parts', 'currency', 'full_name', 'headline', 'location', 'salary_max', 'salary_min', 'skills', 'user_id', 'work_preference'].sort().join(',');
check('Z1 the function returns exactly the documented columns, whatever parts are listed (email, credentials, resume, scores never appear)', keys === expected, keys);
r = await as(db2, 'authenticated', U.o, `select * from employer_view_candidates(null, $1)`, [U.a]);
check('Z2 a null employer id returns nothing', none(r), JSON.stringify(r));
r = await as(db2, 'authenticated', U.o, `select * from employer_view_candidates('99999999-9999-9999-9999-999999999999', $1)`, [U.a]);
check('Z3 an unknown employer id returns nothing', none(r), JSON.stringify(r));
await db2.exec(`set role authenticated`);
await db2.query(`select set_config('request.jwt.claims', '{"role":"authenticated"}', false)`);
let noSub; try { noSub = { rows: (await db2.query(`select * from employer_view_candidates($1,$2)`, [E1, U.a])).rows }; } catch (e) { noSub = { error: e.message }; }
await db2.exec('reset role');
check('Z4 a token without a user id (role authenticated, no sub) returns nothing', none(noSub), JSON.stringify(noSub));
// the employer id sent by the client is never trusted: a recruiter who lists himself under another employer's id gets nothing
await db2.query(`insert into employer_members (employer_id, user_id, role) values ($1,$2,'recruiter')`, [EU, U.q]);   // Q is a member of the UNverified employer
check('Z5 membership of an unverified employer gives nothing even with a consent addressed to it', none(await view(db2, 'authenticated', U.q, EU)));

// service role and editor unaffected
r = await as(db, 'service_role', null, `select user_id, trust_score from candidate_trust_profiles`);
check('S1 the service role still reads profiles', r.rows?.length === 1 && r.rows[0].trust_score === 77, JSON.stringify(r));

// idempotent
await db.exec(read(FIX));
check('I1 the script can be applied twice', ((await db.query(`select count(*)::int n from pg_policies where tablename='trust_matches' and policyname='verified recruiter creates matches'`)).rows[0].n) === 1);

// tests test themselves
const mutants = [
  ['no consent check in the function', (s) => s.replace("and c.revoked_at is null and c.expires_at > now()\n      and (p_candidate_id is null or c.candidate_id = p_candidate_id)", "and (p_candidate_id is null or c.candidate_id = p_candidate_id)"), 'revocation'],
  ['no membership check in the function', (s) => s.replace('if auth.uid() is null or not public.is_verified_employer_member(p_employer_id) then', 'if auth.uid() is null then'), 'member'],
  ['salary always shown', (s) => s.replace("case when a.parts @> array['salary'] then p.salary_min end", 'p.salary_min'), 'salary'],
  ['matches still use visibility', (s) => s.replace("with check (public.employer_has_consent(candidate_id, employer_id, 'profile'));\n\ndrop policy if exists \"verified recruiter creates pipeline\"", "with check (public.is_verified_employer_member(employer_id));\n\ndrop policy if exists \"verified recruiter creates pipeline\""), 'match'],
];
for (const [name, mutate, kind] of mutants) {
  const src = mutate(read(FIX));
  const d = await freshDb(src);
  let caught = false;
  if (kind === 'revocation') { const id = (await grant(d, E1, ['profile'])).rows[0].id; await as(d, 'authenticated', U.a, `update consents set revoked_at=now() where id=$1`, [id]); caught = (await view(d, 'authenticated', U.o, E1)).rows?.length === 1; }
  if (kind === 'member') { await grant(d, E1, ['profile']); caught = (await view(d, 'authenticated', U.q, E1)).rows?.length === 1; }
  if (kind === 'salary') { await grant(d, E1, ['profile']); caught = (await view(d, 'authenticated', U.o, E1)).rows?.[0]?.salary_min === 90000; }
  if (kind === 'match') { const mm = await as(d, 'authenticated', U.o, `insert into trust_matches (employer_id, candidate_id, status) values ($1,$2,'new') returning id`, [E1, U.a]); caught = !mm.error; }
  check(`T control: with "${name}" a test fails (so the tests are meaningful)`, caught);
}

// down script
db = await freshDb(read(FIX));
await db.exec(read(DOWN));
r = await as(db, 'authenticated', U.o, `select full_name from candidate_trust_profiles where user_id=$1`, [U.a]);
check('D1 the down script restores the old behaviour (recruiter reads the visible profile again)', r.rows?.[0]?.full_name === 'Alice', JSON.stringify(r));
check('D2 the down script removes the two functions', ((await db.query(`select count(*)::int n from pg_proc where proname in ('employer_view_candidates','employer_has_consent')`)).rows[0].n) === 0);
r = await as(db, 'authenticated', U.o, `insert into trust_matches (employer_id, candidate_id, status) values ($1,$2,'new') returning id`, [E1, U.a]);
check('D3 the down script restores match creation for a visible candidate', !r.error && r.rows?.length === 1, JSON.stringify(r));

for (const t of results) console.log(`${t.ok ? 'PASS' : 'FAIL'}  ${t.name}`);
const bad = results.filter((t) => !t.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
for (const t of bad) console.log('  ', t.name, t.detail);
process.exit(bad.length ? 1 : 0);
