// S0: reproduce the integrity findings on an in-memory Postgres (PGlite). Tests only; no production access.
//
// Findings reproduced (ids from docs/architecture/EVIDENCE_RESULTS_2026-10-09.md):
//   F-1 a candidate can raise their own trust score by writing score rows
//   F-2 a candidate can edit match_score / recruiter_action on their own match
//   F-4 a verified recruiter can read a visible profile with no consent; revoking a consent changes nothing
//   F-5 deleting score inputs leaves the stored score unchanged
//
// Each scenario reports OPEN (the problem is present on the schema being tested) or FIXED (the desired behaviour holds).
// Default mode always exits 0 so it can run before any fix exists. With --desired it exits 1 if any scenario is still OPEN,
// which is how a fix PR proves itself. Controls (behaviour that must hold before and after a fix) always fail the run if broken.
//
// Example after a fix exists: REPO=... node s0-integrity-findings.mjs --desired --apply=docs/database/proposed/2026-10-09-recompute-score-on-delete.sql
//
// Run (the package is not a project dependency; install it in any scratch folder):
//   npm i @electric-sql/pglite
//   cp docs/database/replica-test/s0-integrity-findings.mjs <scratch>/ && cd <scratch>
//   REPO=/path/to/repo node s0-integrity-findings.mjs [--desired]
//
// Fidelity: the base schema is the earlier audited replica plus the 2026-10-05 and Phase 1 scripts, as the Phase 1 tests build it.
// This script adds the live trust_matches columns (match_score, recruiter_action, candidate_action, job_id) and grants all table privileges
// to anon/authenticated, which matches the live privileges read on 2026-10-09 for these tables. Policy and function bodies used by the
// scenarios were compared by name and text with the live catalog output (policies "Users manage own ...", "candidate updates own match",
// "recruiters can read visible profiles"; functions recompute_trust_score, is_verified_employer_member, lock_row_parties).
// Anything not listed here is not claimed to match.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const REPO = process.env.REPO || path.resolve(process.cwd(), '../../..');
const DESIRED = process.argv.includes('--desired');
// --apply=<path relative to the repo> (repeatable): apply a proposed fix script after the baseline, so the scenarios show what it fixes.
const APPLY = process.argv.filter((a) => a.startsWith('--apply=')).map((a) => a.slice('--apply='.length));
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

async function freshDb() {
  const db = new PGlite();
  await db.exec(read('docs/database/replica-test/replica.sql'));
  await db.exec(read('docs/database/2026-10-05-lock-scores-and-verify-employers.sql'));
  await db.exec(`create role service_role nologin bypassrls;
    grant usage on schema public, auth to service_role;
    grant all on all tables in schema public to service_role;
    grant execute on all functions in schema public to service_role;`);
  await db.exec(read('docs/database/phase1/001_phase1_foundation.sql'));
  // live trust_matches columns (evidence 1.2)
  await db.exec(`alter table public.trust_matches
      add column if not exists job_id uuid, add column if not exists match_score int default 0,
      add column if not exists recruiter_action text, add column if not exists candidate_action text;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant select, insert, update, delete on public.trust_matches, public.candidate_trust_profiles,
      public.resume_scans, public.mock_sessions, public.star_stories to anon;`);
  for (const f of APPLY) await db.exec(read(f));
  return db;
}

const U = {
  a: '00000000-0000-0000-0000-00000000000a', // candidate under test
  b: '00000000-0000-0000-0000-00000000000b', // another candidate
  o: '00000000-0000-0000-0000-0000000000a0', // owner/member of the verified employer
  p: '00000000-0000-0000-0000-0000000000a1', // owner of an UNverified employer
};
const EMP = '11111111-1111-1111-1111-1111111111e1';  // verified
const EMPU = '11111111-1111-1111-1111-1111111111e2'; // unverified

const db = await freshDb();
for (const [k, id] of Object.entries(U)) await db.query('insert into auth.users values ($1,$2)', [id, `${k}@x.test`]);
await db.query(`insert into employers (id, owner_id, name) values ($1,$2,'Verified Co'),($3,$4,'Unverified Co')`, [EMP, U.o, EMPU, U.p]);

async function as(role, uid, sql, params = []) {
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [uid ? JSON.stringify({ sub: uid, role }) : '{}']);
  try { return { rows: (await db.query(sql, params)).rows }; }
  catch (e) { return { error: e.message }; }
  finally { await db.exec('reset role'); }
}
const A = (s, p) => as('authenticated', U.a, s, p);
const B = (s, p) => as('authenticated', U.b, s, p);
const O = (s, p) => as('authenticated', U.o, s, p);   // verified recruiter
const P = (s, p) => as('authenticated', U.p, s, p);   // unverified employer owner
const ANON = (s, p) => as('anon', null, s, p);
const SVC = (s, p) => as('service_role', null, s, p);
// admin verifies the first employer (done with the superuser, as the owner does in the SQL editor)
await db.query(`update employers set verified_at = now() where id = $1`, [EMP]);

const rows = [];
// kind: 'issue' (OPEN when the problem is present), 'control' (must always hold), 'observe' (informational)
const record = (id, kind, name, ok, detail = '') => rows.push({ id, kind, name, ok: !!ok, detail });
const trust = async (uid) => (await SVC(`select trust_score, ats_score, interview_score, star_score, is_visible from candidate_trust_profiles where user_id=$1`, [uid])).rows?.[0];

// ── Controls: what must hold before and after any fix ──────────────────────────
let r = await A(`insert into candidate_trust_profiles (user_id, full_name, is_visible, trust_score) values ($1,'Candidate A',true,99) returning trust_score`, [U.a]);
record('C1', 'control', 'candidate cannot write trust_score directly (the 2026-10-05 lock)', !r.error && r.rows?.[0]?.trust_score === 0, JSON.stringify(r));
r = await B(`select user_id from candidate_trust_profiles where user_id = $1`, [U.a]);
record('C2', 'control', 'another candidate cannot read this profile', !r.error && (r.rows || []).length === 0, JSON.stringify(r));
r = await ANON(`select user_id from candidate_trust_profiles`);
record('C3', 'control', 'anonymous cannot read profiles (an error or no rows both mean no data)', !!r.error || (r.rows || []).length === 0, JSON.stringify(r));
r = await P(`select user_id from candidate_trust_profiles`);
record('C4', 'control', 'owner of an unverified employer cannot read profiles', !r.error && (r.rows || []).length === 0, JSON.stringify(r));

// ── F-12 observation: perfect interview and STAR, no scan ─────────────────────
await A(`insert into mock_sessions (user_id, avg_score) values ($1, 100)`, [U.a]);
await A(`insert into star_stories (user_id, score) values ($1, 100)`, [U.a]);
let t = await trust(U.a);
record('F-12', 'observe', `perfect interview and STAR, no scan → trust_score ${t?.trust_score} (ats ${t?.ats_score}); the maximum without a scan is 60`, t?.trust_score === 60, JSON.stringify(t));

// ── F-1: forged inputs raise the score ────────────────────────────────────────
r = await A(`insert into resume_scans (user_id, credibility_score) values ($1, 100)`, [U.a]);
t = await trust(U.a);
const forged = !r.error && t?.trust_score === 100;
record('F-1', 'issue', `candidate writes a scan row with score 100 → trust_score ${t?.trust_score}`, !forged, JSON.stringify({ insert: r.error || 'accepted', trust: t }));
// a recruiter can see it
r = await O(`select trust_score from candidate_trust_profiles where user_id = $1`, [U.a]);
record('F-1b', 'issue', `a verified recruiter reads that score (${r.rows?.[0]?.trust_score ?? 'none'})`, (r.rows || []).length === 0 || r.rows[0].trust_score !== 100, JSON.stringify(r));

// ── F-5: deleting the inputs leaves the score ─────────────────────────────────
const before = (await trust(U.a))?.trust_score;
await A(`delete from resume_scans where user_id = $1`, [U.a]);
await A(`delete from mock_sessions where user_id = $1`, [U.a]);
await A(`delete from star_stories where user_id = $1`, [U.a]);
t = await trust(U.a);
record('F-5', 'issue', `all score inputs deleted → trust_score ${before} → ${t?.trust_score}`, t?.trust_score !== before, JSON.stringify({ before, after: t }));

// ── F-4: recruiter reads without consent; revocation changes nothing ─────────
await SVC(`update candidate_trust_profiles set salary_min = 90000, salary_max = 120000, bio = 'private bio' where user_id = $1`, [U.a]);
r = await O(`select full_name, salary_min, salary_max, bio from candidate_trust_profiles where user_id = $1`, [U.a]);
record('F-4a', 'issue', `verified recruiter, NO consent: reads ${r.rows?.length || 0} row(s)${r.rows?.[0] ? ` incl. salary ${r.rows[0].salary_min}-${r.rows[0].salary_max}` : ''}`, !r.error && (r.rows || []).length === 0, JSON.stringify(r));

r = await A(`insert into consents (employer_id, scope, purpose, expires_at) values ($1, '{"parts":["profile"]}', 'recruiter_review', now() + interval '30 days') returning id`, [EMP]);
const consentId = r.rows?.[0]?.id;
record('F-4s', 'control', 'candidate can grant a consent to the employer (setup)', !!consentId, JSON.stringify(r));
r = await O(`select user_id from candidate_trust_profiles where user_id = $1`, [U.a]);
record('F-4b', 'control', 'verified recruiter WITH an active consent can read the profile', (r.rows || []).length === 1, JSON.stringify(r));

r = await A(`update consents set revoked_at = now() where id = $1`, [consentId]);
r = await O(`select user_id from candidate_trust_profiles where user_id = $1`, [U.a]);
record('F-4c', 'issue', `after the consent is revoked the recruiter still reads ${r.rows?.length || 0} row(s)`, !r.error && (r.rows || []).length === 0, JSON.stringify(r));

// a different verified employer without any consent
await SVC(`update employers set verified_at = now() where id = $1`, [EMPU]);
r = await P(`select user_id from candidate_trust_profiles where user_id = $1`, [U.a]);
record('F-4d', 'issue', `a second verified employer, no consent: reads ${r.rows?.length || 0} row(s)`, !r.error && (r.rows || []).length === 0, JSON.stringify(r));
await SVC(`update employers set verified_at = null where id = $1`, [EMPU]);

// ── F-2: candidate edits match fields on their own match ───────────────────────
r = await O(`insert into trust_matches (employer_id, candidate_id, status) values ($1,$2,'new') returning id`, [EMP, U.a]);
const matchId = r.rows?.[0]?.id;
record('F-2s', 'control', 'verified recruiter can create a match for a visible candidate (setup)', !!matchId, JSON.stringify(r));
r = await A(`update trust_matches set match_score = 100, recruiter_action = 'shortlisted', status = 'matched' where id = $1 returning match_score, recruiter_action, status`, [matchId]);
record('F-2', 'issue', `candidate sets match_score/recruiter_action/status on own match → ${r.error ? 'denied' : JSON.stringify(r.rows?.[0] || 'no row')}`, !!r.error || (r.rows || []).length === 0, JSON.stringify(r));
r = await A(`update trust_matches set candidate_action = 'interested' where id = $1 returning candidate_action`, [matchId]);
record('F-2c', 'control', 'candidate can still record their own action (candidate_action)', r.rows?.[0]?.candidate_action === 'interested', JSON.stringify(r));
r = await A(`update trust_matches set employer_id = $1 where id = $2`, [EMPU, matchId]);
record('F-2d', 'control', 'candidate cannot change the employer of a match (lock_row_parties)', !!r.error, JSON.stringify(r));

// ── report ────────────────────────────────────────────────────────────────────
const label = (x) => x.kind === 'issue' ? (x.ok ? 'FIXED ' : 'OPEN  ') : x.kind === 'control' ? (x.ok ? 'PASS  ' : 'BROKEN') : (x.ok ? 'OBSERV' : 'DIFFER');
for (const x of rows) console.log(`${label(x)} ${x.id.padEnd(5)} ${x.name}`);
const open = rows.filter((x) => x.kind === 'issue' && !x.ok);
const broken = rows.filter((x) => x.kind === 'control' && !x.ok);
console.log(`\n${rows.filter((x) => x.kind === 'issue').length} issue scenarios: ${open.length} OPEN, ${rows.filter((x) => x.kind === 'issue' && x.ok).length} FIXED; ` +
  `${rows.filter((x) => x.kind === 'control').length} controls: ${broken.length} broken`);
if (process.env.VERBOSE) for (const x of rows) console.log(x.id, x.detail);
if (broken.length) { console.log('A control is broken: the replica no longer represents the expected baseline.'); process.exit(2); }
if (DESIRED && open.length) process.exit(1);
