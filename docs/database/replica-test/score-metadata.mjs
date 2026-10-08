// Tests the PROPOSED resume_scans score-metadata migration against the replica schema, after the
// 2026-10-05 migration. Run from this folder:  node score-metadata.mjs
// Needs @electric-sql/pglite (npm i --no-save @electric-sql/pglite).
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const db = new PGlite();
await db.exec(fs.readFileSync('replica.sql', 'utf8'));
await db.exec(fs.readFileSync('../2026-10-05-lock-scores-and-verify-employers.sql', 'utf8'));
const MIGRATION = fs.readFileSync('../proposed/2026-10-08-resume-scans-score-metadata.sql', 'utf8');

const U = '00000000-0000-0000-0000-0000000000a1';
const V = '00000000-0000-0000-0000-0000000000b2';
for (const id of [U, V]) await db.query('insert into auth.users values ($1,$2)', [id, `${id}@x.test`]);

const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const tryq = async (sql, p = []) => { try { return { rows: await q(sql, p) }; } catch (e) { return { error: e.message }; } };
const asUser = async (uid, sql, p = []) => {
  await db.exec('set role authenticated');
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: uid, role: 'authenticated' })]);
  try { return { rows: (await db.query(sql, p)).rows }; } catch (e) { return { error: e.message }; } finally { await db.exec('reset role'); }
};
const trust = async (uid) => (await q('select ats_score, trust_score from candidate_trust_profiles where user_id=$1', [uid]))[0];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });

// Before: an old-style AI row, and the trust score it produces.
await q('insert into resume_scans (user_id, credibility_score) values ($1, 60)', [U]);
const before = await trust(U);
check('B0 baseline: old row gives ats_score 60, trust 24', before?.ats_score === 60 && before?.trust_score === 24, JSON.stringify(before));

await db.exec(MIGRATION);
const cols = await q(`select column_name, data_type, is_nullable from information_schema.columns where table_name='resume_scans' and column_name in ('deterministic_score','score_type','score_version') order by 1`);
check('M1 three nullable columns added', cols.length === 3 && cols.every(c => c.is_nullable === 'YES'), JSON.stringify(cols));
const old = (await q('select deterministic_score, score_type, score_version from resume_scans'))[0];
check('M2 existing row keeps NULL in all three', old.deterministic_score === null && old.score_type === null && old.score_version === null, JSON.stringify(old));
const afterMig = await trust(U);
check('M3 migration alone does not change the trust score', JSON.stringify(afterMig) === JSON.stringify(before), JSON.stringify(afterMig));

// A rule-based row must not move the trust score (credibility_score stays NULL).
let r = await tryq(`insert into resume_scans (user_id, credibility_score, deterministic_score, score_type, score_version) values ($1, null, 95, 'careeraihub_ats_readiness', '1.0.0')`, [U]);
check('T1 rule-based row is accepted', !r.error, JSON.stringify(r));
const t = await trust(U);
check('T2 trigger fired, but MAX ignores NULL: ats_score still 60, trust still 24', t?.ats_score === 60 && t?.trust_score === 24, JSON.stringify(t));

// Old-style insert (what the app does today) still works and still feeds the trust score.
r = await tryq(`insert into resume_scans (user_id, credibility_score) values ($1, 80)`, [U]);
const t2 = await trust(U);
check('T3 app-style insert unchanged: ats_score 80, trust 32', !r.error && t2?.ats_score === 80 && t2?.trust_score === 32, JSON.stringify([r, t2]));

// Constraints
r = await tryq(`insert into resume_scans (user_id, deterministic_score, score_type, score_version) values ($1, 101, 't', '1.0.0')`, [U]);
check('C1 score above 100 rejected', !!r.error, JSON.stringify(r));
r = await tryq(`insert into resume_scans (user_id, deterministic_score, score_type, score_version) values ($1, -1, 't', '1.0.0')`, [U]);
check('C2 negative score rejected', !!r.error, JSON.stringify(r));
r = await tryq(`insert into resume_scans (user_id, deterministic_score, score_version) values ($1, 70, '1.0.0')`, [U]);
check('C3 score without score_type rejected', !!r.error, JSON.stringify(r));
r = await tryq(`insert into resume_scans (user_id, deterministic_score, score_type) values ($1, 70, 't')`, [U]);
check('C4 score without version rejected', !!r.error, JSON.stringify(r));
r = await tryq(`insert into resume_scans (user_id, deterministic_score, score_type, score_version) values ($1, 70, 't', 'v2')`, [U]);
check('C5 non-semver version rejected', !!r.error, JSON.stringify(r));
r = await tryq(`insert into resume_scans (user_id, deterministic_score, score_type, score_version) values ($1, 0, 't', '1.0.0')`, [U]);
check('C6 a real 0 is accepted (0 is not null)', !r.error, JSON.stringify(r));
r = await tryq(`insert into resume_scans (user_id, score_type) values ($1, 'label only')`, [U]);
check('C7 a label with no score is accepted (nothing to protect)', !r.error, JSON.stringify(r));

// RLS: a signed-in user can write their own row with the new columns, not someone else's.
r = await asUser(U, `insert into resume_scans (user_id, deterministic_score, score_type, score_version) values ($1, 55, 't', '1.0.0') returning id`, [U]);
check('R1 user can insert own row with new columns', !r.error && r.rows?.length === 1, JSON.stringify(r));
r = await asUser(U, `insert into resume_scans (user_id, deterministic_score, score_type, score_version) values ($1, 55, 't', '1.0.0') returning id`, [V]);
check('R2 user cannot insert a row for someone else', !!r.error, JSON.stringify(r));
r = await asUser(V, `select count(*)::int as n from resume_scans where deterministic_score is not null`);
check('R3 another user cannot read those rows', r.rows?.[0]?.n === 0, JSON.stringify(r));

// Re-running the migration is harmless, and rollback leaves the original behaviour.
try { await db.exec(MIGRATION); r = {}; } catch (e) { r = { error: e.message }; }
check('I1 migration is idempotent', !r.error, JSON.stringify(r));
await db.exec(`alter table public.resume_scans drop constraint if exists resume_scans_deterministic_score_labelled;
  alter table public.resume_scans drop constraint if exists resume_scans_deterministic_score_range;
  alter table public.resume_scans drop column if exists deterministic_score, drop column if exists score_type, drop column if exists score_version;`);
const left = await q(`select count(*)::int as n from information_schema.columns where table_name='resume_scans' and column_name in ('deterministic_score','score_type','score_version')`);
check('Z1 rollback removes the columns', left[0].n === 0, JSON.stringify(left));
r = await tryq(`insert into resume_scans (user_id, credibility_score) values ($1, 90)`, [U]);
const t3 = await trust(U);
check('Z2 after rollback the trigger still works (ats_score 90)', !r.error && t3?.ats_score === 90, JSON.stringify([r, t3]));

for (const x of results) console.log(`${x.ok ? 'PASS' : 'FAIL'}  ${x.name}${x.ok ? '' : '   ' + x.detail}`);
const failed = results.filter(x => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
