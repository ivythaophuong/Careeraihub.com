// Runs the Phase 1 migration on an in-memory Postgres (PGlite) built from the audited production schema plus the
// 2026-10-05 migration, then exercises attacks and normal use.
//   npm i @electric-sql/pglite   (in any scratch folder)
//   REPO=/path/to/repo node test.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const REPO = process.env.REPO || path.resolve(process.cwd(), '../../..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
const P1 = 'docs/database/phase1/001_phase1_foundation.sql';
const P1_DOWN = 'docs/database/phase1/001_phase1_foundation.down.sql';

async function freshDb() {
  const db = new PGlite();
  await db.exec(read('docs/database/replica-test/replica.sql'));
  await db.exec(read('docs/database/2026-10-05-lock-scores-and-verify-employers.sql'));
  await db.exec(`create role service_role nologin bypassrls;
    grant usage on schema public, auth to service_role;
    grant all on all tables in schema public to service_role;
    grant execute on all functions in schema public to service_role;`);
  return db;
}

const U = { a: '00000000-0000-0000-0000-00000000000a', b: '00000000-0000-0000-0000-00000000000b', c: '00000000-0000-0000-0000-00000000000c', o: '00000000-0000-0000-0000-0000000000f0' };
const EMP = '11111111-1111-1111-1111-1111111111e1';

const db = await freshDb();
await db.exec(read(P1));
for (const [k, id] of Object.entries(U)) await db.query('insert into auth.users values ($1,$2)', [id, `${k}@x.test`]);
await db.query(`insert into employers (id, owner_id, name) values ($1,$2,'Real Co')`, [EMP, U.o]);

async function as(role, uid, sql, params = []) {
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [uid ? JSON.stringify({ sub: uid, role }) : '{}']);
  try { return { rows: (await db.query(sql, params)).rows }; }
  catch (e) { return { error: e.message }; }
  finally { await db.exec('reset role'); }
}
const A = (sql, p) => as('authenticated', U.a, sql, p);
const B = (sql, p) => as('authenticated', U.b, sql, p);
const C = (sql, p) => as('authenticated', U.c, sql, p);   // a bystander who owns nothing
const ANON = (sql, p) => as('anon', null, sql, p);
const SVC = (sql, p) => as('service_role', null, sql, p);

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });
const denied = (r) => !!r.error;
const J = (o) => JSON.stringify(o);

const ALL_TRUE = { credential_valid: true, signature_valid: true, issuer_trusted: true, revocation_checked: true, recipient_binding_verified: true, expiration_valid: true, schema_valid: true, source_reachable: true };
const apply = (ev, req, o = {}) => SVC(
  `select apply_verification_attempt($1::uuid,$2::uuid,$3,$4,$5, now(), $6,$7,$8,$9::jsonb,$10,$11,$12::jsonb,$13)`,
  [ev, req, o.provider || 'opencerts', o.adapter || 'v1', o.policy || 'policy-v1', o.outcome || 'VERIFIED', o.method ?? 'opencerts',
   o.confidence ?? 'HIGH', J(o.checks || ALL_TRUE), o.subject_id ?? 'a@x.test', o.binding ?? 'email_verified', '{}', o.error ?? null]);

// ── isolation and browser privileges: evidence ───────────────────────────────
let r = await A(`insert into evidence (type, claim, source_type) values ('education','BBA, NUS','user_claim') returning id, candidate_id, verification_status, trust_status, version`);
const ev1 = r.rows?.[0];
check('E1 candidate adds a claim: owned, UNVERIFIED, NOT_ELIGIBLE, version 1', ev1 && ev1.candidate_id === U.a && ev1.verification_status === 'UNVERIFIED' && ev1.trust_status === 'NOT_ELIGIBLE' && ev1.version === 1, J(r));

r = await A(`insert into evidence (type, claim, source_type, verification_status) values ('education','forged','user_claim','VERIFIED')`);
check('E2 candidate cannot set verification_status', denied(r), J(r));
r = await A(`insert into evidence (type, claim, source_type, trust_status) values ('education','forged','user_claim','ELIGIBLE')`);
check('E3 candidate cannot set trust_status', denied(r), J(r));
r = await A(`insert into evidence (type, claim, source_type, checks) values ('education','forged','user_claim','{"issuer_trusted":true}')`);
check('E4 candidate cannot set checks', denied(r), J(r));
r = await A(`insert into evidence (candidate_id, type, claim, source_type) values ($1,'education','for someone else','user_claim')`, [U.b]);
check('E5 candidate cannot write evidence for another candidate', denied(r), J(r));
r = await A(`update evidence set claim = 'edited' where id = $1`, [ev1.id]);
check('E6 candidate cannot update evidence', denied(r), J(r));
r = await A(`delete from evidence where id = $1`, [ev1.id]);
check('E7 candidate cannot delete evidence', denied(r), J(r));
r = await C(`select id from evidence`);
check('E8 another candidate sees none of it', (r.rows || []).length === 0 && !r.error, J(r));
r = await ANON(`select id from evidence`);
check('E9 anonymous cannot read evidence', denied(r), J(r));

// immutable versions
r = await A(`insert into evidence (type, claim, source_type, supersedes_id) values ('education','BBA (Hons), NUS','user_claim',$1) returning id, version`, [ev1.id]);
const ev2 = r.rows?.[0];
check('V1 an edit is a new version that supersedes the old', ev2 && ev2.version === 2, J(r));
r = await A(`insert into evidence (type, claim, source_type, supersedes_id) values ('education','another successor','user_claim',$1)`, [ev1.id]);
check('V2 a version can have only one successor', denied(r), J(r));
r = await B(`insert into evidence (type, claim, source_type, supersedes_id) values ('education','hijack','user_claim',$1)`, [ev1.id]);
check('V3 cannot supersede another candidate\'s evidence', denied(r), J(r));
r = await A(`select id, version from evidence_current`);
check('V4 evidence_current shows only the latest version', r.rows?.length === 1 && r.rows[0].id === ev2.id, J(r));
r = await SVC(`update evidence set claim = 'service edit' where id = $1`, [ev2.id]);
check('V5 even the service cannot edit claim fields', denied(r), J(r));
r = await SVC(`update evidence set source_url = 'https://x.example' where id = $1`, [ev2.id]);
check('V6 even the service cannot edit artifact fields', denied(r), J(r));

// ── verification requests ────────────────────────────────────────────────────
r = await A(`insert into verification_requests (evidence_id) values ($1) returning id, status, evidence_version, candidate_id`, [ev2.id]);
const rq1 = r.rows?.[0];
check('R1 candidate requests verification: QUEUED, version recorded', rq1 && rq1.status === 'QUEUED' && rq1.evidence_version === 2 && rq1.candidate_id === U.a, J(r));
r = await A(`insert into verification_requests (evidence_id) values ($1)`, [ev2.id]);
check('R2 only one open request per evidence', denied(r), J(r));
r = await A(`insert into verification_requests (evidence_id) values ($1)`, [ev1.id]);
check('R3 cannot verify a superseded version', denied(r), J(r));
r = await B(`insert into verification_requests (evidence_id) values ($1)`, [ev2.id]);
check('R4 cannot request verification of someone else\'s evidence', denied(r), J(r));
r = await A(`insert into verification_requests (evidence_id, status) values ($1, 'DONE')`, [ev2.id]);
check('R5 candidate cannot set a request status', denied(r), J(r));
r = await C(`select id from verification_requests`);
check('R6 another candidate sees no requests', (r.rows || []).length === 0 && !r.error, J(r));

// rate limit: 5 per hour
// (run as candidate B so it does not use up candidate A's hourly allowance)
let failedAt = 0;
for (let i = 1; i <= 7; i++) {
  const e = await B(`insert into evidence (type, claim, source_type) values ('certification',$1,'platform_url') returning id`, [`cert ${i}`]);
  const q = await B(`insert into verification_requests (evidence_id) values ($1)`, [e.rows[0].id]);
  if (q.error) { failedAt = i; break; }
}
check('R7 the 6th request within an hour is refused (rate limit)', failedAt === 6, `failed at request #${failedAt}`);

// ── the server path: start, apply, audit trail ───────────────────────────────
r = await A(`select start_verification($1)`, [rq1.id]);
check('S1 candidate cannot call start_verification', denied(r), J(r));
r = await A(`select apply_verification_attempt($1,null,'x','v','p',now(),'VERIFIED','opencerts','HIGH','{}'::jsonb,null,'did_proof','{}'::jsonb,null)`, [ev2.id]);
check('S2 candidate cannot call apply_verification_attempt', denied(r), J(r));
r = await SVC(`select start_verification($1)`, [rq1.id]);
let st = await SVC(`select verification_status from evidence where id = $1`, [ev2.id]);
check('S3 start_verification moves evidence to PENDING', !r.error && st.rows[0].verification_status === 'PENDING', J(r) + J(st));

r = await apply(ev2.id, rq1.id);
st = await SVC(`select verification_status, trust_status, confidence, verified_by, verified_at is not null as has_time from evidence where id = $1`, [ev2.id]);
check('S4 valid, trusted, bound credential: VERIFIED and ELIGIBLE, signed by the verifier', !r.error && st.rows[0].verification_status === 'VERIFIED' && st.rows[0].trust_status === 'ELIGIBLE' && st.rows[0].verified_by === 'verifier:opencerts:v1' && st.rows[0].has_time, J(r) + J(st));
let at = await SVC(`select count(*)::int as n, min(previous_status) as prev, max(new_status) as new from verification_attempts where evidence_id = $1`, [ev2.id]);
check('S5 the attempt is recorded with before/after status', at.rows[0].n === 1 && at.rows[0].prev === 'PENDING' && at.rows[0].new === 'VERIFIED', J(at));
st = await SVC(`select status from verification_requests where id = $1`, [rq1.id]);
check('S6 the request is marked DONE', st.rows[0].status === 'DONE', J(st));

// authentic but not bound to the candidate
let e2 = (await A(`insert into evidence (type, claim, source_type) values ('education','MSc','signed_credential') returning id`)).rows[0].id;
let q2 = (await A(`insert into verification_requests (evidence_id) values ($1) returning id`, [e2])).rows[0].id;
await SVC(`select start_verification($1)`, [q2]);
r = await apply(e2, q2, { checks: { ...ALL_TRUE, recipient_binding_verified: false }, binding: 'none' });
st = await SVC(`select verification_status, trust_status from evidence where id = $1`, [e2]);
check('S7 authentic credential with unconfirmed recipient: VERIFIED but NOT_ELIGIBLE', !r.error && st.rows[0].verification_status === 'VERIFIED' && st.rows[0].trust_status === 'NOT_ELIGIBLE', J(r) + J(st));

// untrusted issuer
let e3 = (await A(`insert into evidence (type, claim, source_type) values ('education','Diploma','signed_credential') returning id`)).rows[0].id;
let q3 = (await A(`insert into verification_requests (evidence_id) values ($1) returning id`, [e3])).rows[0].id;
await SVC(`select start_verification($1)`, [q3]);
await apply(e3, q3, { checks: { ...ALL_TRUE, issuer_trusted: false } });
st = await SVC(`select verification_status, trust_status from evidence where id = $1`, [e3]);
check('S8 valid signature from an issuer that is not trusted: NOT_ELIGIBLE', st.rows[0].trust_status === 'NOT_ELIGIBLE', J(st));

// platform_page can never be HIGH confidence
let e4 = (await A(`insert into evidence (type, claim, source_type) values ('certification','Coursera ML','platform_url') returning id`)).rows[0].id;
let q4 = (await A(`insert into verification_requests (evidence_id) values ($1) returning id`, [e4])).rows[0].id;
await SVC(`select start_verification($1)`, [q4]);
r = await apply(e4, q4, { provider: 'platform_page', method: 'platform_page', confidence: 'HIGH', binding: 'none', checks: { source_reachable: true } });
check('S9 a platform page can never produce HIGH confidence', denied(r), J(r));
r = await apply(e4, q4, { provider: 'platform_page', method: 'platform_page', confidence: 'MEDIUM', binding: 'none', checks: { source_reachable: true } });
st = await SVC(`select verification_status, trust_status, confidence from evidence where id = $1`, [e4]);
check('S10 a platform page can be VERIFIED at MEDIUM but is never trust-eligible without binding', !r.error && st.rows[0].verification_status === 'VERIFIED' && st.rows[0].trust_status === 'NOT_ELIGIBLE', J(r) + J(st));

// state machine
let e5 = (await A(`insert into evidence (type, claim, source_type) values ('skill','SQL','user_claim') returning id`)).rows[0].id;
r = await SVC(`update evidence set verification_status = 'VERIFIED', verified_by = 'verifier:x:v1', verified_at = now() where id = $1`, [e5]);
check('M1 UNVERIFIED cannot jump to VERIFIED', denied(r), J(r));
r = await SVC(`update evidence set verification_status = 'PENDING' where id = $1`, [e5]);
check('M2 UNVERIFIED -> PENDING is allowed', !r.error, J(r));
r = await SVC(`update evidence set trust_status = 'ELIGIBLE' where id = $1`, [e5]);
check('M3 ELIGIBLE needs VERIFIED, binding and trusted issuer (database constraint)', denied(r), J(r));

// revoke chain, REVOKED is final
r = await apply(ev2.id, null, { outcome: 'REVOKED', checks: { ...ALL_TRUE, revocation_checked: true } });
st = await SVC(`select verification_status, trust_status from evidence where id = $1`, [ev2.id]);
check('M4 VERIFIED -> REVOKED by a re-check: trust is withdrawn', !r.error && st.rows[0].verification_status === 'REVOKED' && st.rows[0].trust_status === 'NOT_ELIGIBLE', J(r) + J(st));
r = await apply(ev2.id, null, { outcome: 'VERIFIED' });
check('M5 REVOKED cannot go back to VERIFIED', denied(r), J(r));
at = await SVC(`select previous_status, new_status from verification_attempts where evidence_id = $1 order by finished_at, id`, [ev2.id]);
check('M6 the history reads as a chain: PENDING->VERIFIED, VERIFIED->REVOKED', at.rows.length === 2 && at.rows[0].new_status === 'VERIFIED' && at.rows[1].previous_status === 'VERIFIED' && at.rows[1].new_status === 'REVOKED', J(at));

// append-only attempts
r = await SVC(`update verification_attempts set error = 'edited' where evidence_id = $1`, [ev2.id]);
check('T1 attempts cannot be updated, even by the service', denied(r), J(r));
r = await SVC(`delete from verification_attempts where evidence_id = $1`, [ev2.id]);
check('T2 attempts cannot be deleted, even by the service', denied(r), J(r));
r = await A(`select count(*)::int as n from verification_attempts`);
check('T3 candidate reads own attempts', r.rows?.[0]?.n >= 2, J(r));
r = await C(`select count(*)::int as n from verification_attempts`);
check('T4 another candidate sees none', r.rows?.[0]?.n === 0, J(r));
r = await A(`insert into verification_attempts (evidence_id, evidence_version, provider, adapter_version, policy_version, started_at, outcome, previous_status, new_status, checks) values ($1,1,'x','v','p',now(),'VERIFIED','PENDING','VERIFIED','{}')`, [ev2.id]);
check('T5 candidate cannot write an attempt', denied(r), J(r));

// ── withdraw (never a delete, never a revocation) ───────────────────────────
// helper: a verified, trust-eligible evidence for candidate A (the request is made by the service so it does not use A's hourly allowance)
async function verifiedEvidenceForA(claim) {
  const id = (await A(`insert into evidence (type, claim, source_type) values ('education',$1,'signed_credential') returning id`, [claim])).rows[0].id;
  const rq = (await SVC(`insert into verification_requests (evidence_id) values ($1) returning id`, [id])).rows[0].id;
  await SVC(`select start_verification($1)`, [rq]);
  await apply(id, rq);
  return id;
}
const wid = await verifiedEvidenceForA('Degree to be withdrawn');
let before = await SVC(`select count(*)::int as n from verification_attempts where evidence_id = $1`, [wid]);
let s0 = await SVC(`select trust_status from evidence where id = $1`, [wid]);
r = await A(`update evidence set withdrawn_at = now() where id = $1 returning withdrawn_at, verification_status, trust_status`, [wid]);
check('W1 candidate withdraws: stays VERIFIED in history, trust is withdrawn', s0.rows[0].trust_status === 'ELIGIBLE' && r.rows?.[0]?.withdrawn_at && r.rows[0].verification_status === 'VERIFIED' && r.rows[0].trust_status === 'NOT_ELIGIBLE', J(s0) + J(r));
let after = await SVC(`select count(*)::int as n from verification_attempts where evidence_id = $1`, [wid]);
check('W2 withdrawing does not touch the verification history', before.rows[0].n === after.rows[0].n && after.rows[0].n === 1, J(before) + J(after));
r = await A(`update evidence set withdrawn_at = null where id = $1`, [wid]);
check('W3 a withdrawal cannot be undone', denied(r), J(r));
r = await A(`update evidence set withdrawn_at = now() where id = $1`, [wid]);
check('W4 withdrawing twice is refused', denied(r), J(r));
r = await A(`update evidence set withdrawn_at = now(), claim = 'sneaky' where id = $1`, [ev1.id]);
check('W5 withdraw cannot be combined with an edit', denied(r), J(r));
r = await A(`update evidence set withdrawn_at = now(), verification_status = 'VERIFIED' where id = $1`, [ev1.id]);
check('W6 withdraw cannot be combined with a status change', denied(r), J(r));
r = await C(`update evidence set withdrawn_at = now() where id = $1 returning id`, [e5]);
check('W7 another candidate cannot withdraw it (no rows touched)', !r.error && (r.rows || []).length === 0, J(r));
r = await A(`insert into verification_requests (evidence_id) values ($1)`, [wid]);
check('W8 withdrawn evidence cannot be sent for verification', denied(r), J(r));
r = await A(`insert into evidence (type, claim, source_type, supersedes_id) values ('education','again','user_claim',$1)`, [wid]);
check('W9 withdrawn evidence cannot be superseded', denied(r), J(r));
r = await apply(wid, null, { outcome: 'VERIFIED' });
let wst = await SVC(`select trust_status from evidence where id = $1`, [wid]);
check('W10 a later re-check records its result but cannot make withdrawn evidence trust-eligible', !r.error && wst.rows[0].trust_status === 'NOT_ELIGIBLE', J(r) + J(wst));
r = await SVC(`select count(*)::int as n from evidence_active where id = $1`, [wid]);
check('W11 withdrawn evidence is not in evidence_active', r.rows[0].n === 0, J(r));
r = await SVC(`update evidence set trust_status = 'ELIGIBLE' where id = $1`, [wid]);
check('W12 the database refuses ELIGIBLE on withdrawn evidence', denied(r), J(r));
r = await SVC(`update evidence set withdrawn_at = null where id = $1`, [wid]);
check('W13 not even the service can undo a withdrawal', denied(r), J(r));
r = await SVC(`update evidence set withdrawn_at = now() where id = $1`, [wid]);
check('W14 not even the service can re-stamp a withdrawal', denied(r), J(r));

// ── raw credential retention, identity documents ────────────────────────────
r = await A(`insert into evidence (type, claim, source_type, raw_credential) values ('identity','Passport check','user_upload','{"scan":"base64..."}')`);
check('K1 identity evidence cannot hold a raw document (store the proof, not the document)', denied(r), J(r));
r = await A(`insert into evidence (type, claim, source_type, raw_credential) values ('certification','Signed cert','signed_credential','{"@context":"x","proof":{}}') returning id`);
const rawId = r.rows?.[0]?.id;
check('K2 a certification may keep its raw signed credential', !!rawId, J(r));
await SVC(`insert into verification_attempts (evidence_id, evidence_version, provider, adapter_version, policy_version, started_at, outcome, previous_status, new_status, checks, raw_result) values ($1,1,'opencerts','v1','p1',now(),'ERROR','UNVERIFIED','UNVERIFIED','{}','{"provider":"payload"}')`, [rawId]);
r = await SVC(`update verification_attempts set outcome = 'VERIFIED', raw_result = null where evidence_id = $1`, [rawId]);
check('K7 redacting raw_result cannot carry any other change with it', denied(r), J(r));
r = await SVC(`update evidence set raw_credential = '{"swapped":true}' where id = $1`, [rawId]);
check('K3 raw_credential cannot be replaced with another value', denied(r), J(r));
r = await A(`select purge_raw_credential($1)`, [rawId]);
check('K4 a candidate cannot run the purge', denied(r), J(r));
r = await SVC(`select purge_raw_credential($1)`, [rawId]);
let pr = await SVC(`select e.raw_credential is null as raw_gone, e.raw_purged_at is not null as stamped, (select count(*) from verification_attempts a where a.evidence_id = e.id and a.raw_result is not null)::int as attempt_raw, (select count(*) from verification_attempts a where a.evidence_id = e.id)::int as attempts, e.claim from evidence e where e.id = $1`, [rawId]);
check('K5 the purge removes raw data, stamps the time, keeps the claim and the attempt rows', !r.error && pr.rows[0].raw_gone && pr.rows[0].stamped && pr.rows[0].attempt_raw === 0 && pr.rows[0].attempts === 1 && pr.rows[0].claim === 'Signed cert', J(r) + J(pr));
r = await SVC(`update verification_attempts set outcome = 'VERIFIED' where evidence_id = $1`, [rawId]);
check('K6 an attempt still cannot be changed in any other way', denied(r), J(r));

// ── erasure: deleting an account removes everything, including the append-only audit rows ──
const gone = '00000000-0000-0000-0000-0000000000d1';
await db.query('insert into auth.users values ($1,$2)', [gone, 'gone@x.test']);
const ge = (await as('authenticated', gone, `insert into evidence (type, claim, source_type) values ('education','to be erased','user_claim') returning id`)).rows[0].id;
const gr = (await SVC(`insert into verification_requests (evidence_id) values ($1) returning id`, [ge])).rows[0].id;
await SVC(`select start_verification($1)`, [gr]);
await apply(ge, gr);
await as('authenticated', gone, `insert into evidence (type, claim, source_type, supersedes_id) values ('education','to be erased v2','user_claim',$1)`, [ge]).then(x => x);
await as('authenticated', gone, `insert into career_profiles (full_name) values ('Gone')`);
r = await SVC(`delete from verification_attempts where evidence_id = $1`, [ge]);
check('Z1 attempts still cannot be deleted directly', denied(r), J(r));
try { await db.query('delete from auth.users where id = $1', [gone]); r = {}; } catch (e) { r = { error: e.message }; }
let left2 = await SVC(`select (select count(*) from evidence where candidate_id = $1)::int as ev, (select count(*) from verification_attempts where evidence_id = $2)::int as at, (select count(*) from verification_requests where candidate_id = $1)::int as rq, (select count(*) from career_profiles where candidate_id = $1)::int as pr`, [gone, ge]);
check('Z2 deleting the account removes evidence (all versions), requests, attempts and profile', !r.error && left2.rows[0].ev === 0 && left2.rows[0].at === 0 && left2.rows[0].rq === 0 && left2.rows[0].pr === 0, J(r) + J(left2));

// ── trusted issuers ──────────────────────────────────────────────────────────
r = await A(`select * from trusted_issuers`);
check('I1 candidates cannot read the trusted-issuer policy', denied(r), J(r));
r = await SVC(`insert into trusted_issuers (issuer_identifier, issuer_name, issuer_type, verification_method, policy_version, allowed_domains) values ('nus.edu.sg','NUS','university','opencerts','v1','{nus.edu.sg}')`);
check('I2 the service can add an issuer', !r.error, J(r));
r = await SVC(`insert into trusted_issuers (issuer_identifier, issuer_name, issuer_type, verification_method, policy_version) values ('nus.edu.sg','NUS again','university','opencerts','v1')`);
check('I3 one entry per issuer, method and policy version', denied(r), J(r));
r = await SVC(`insert into trusted_issuers (issuer_identifier, issuer_name, issuer_type, verification_method, policy_version, effective_from, effective_until) values ('x.edu','X','university','opencerts','v1', now(), now() - interval '1 day')`);
check('I4 an issuer window must end after it starts', denied(r), J(r));

// ── consents ─────────────────────────────────────────────────────────────────
r = await A(`insert into consents (employer_id, scope, purpose, expires_at) values ($1,'{"parts":["profile"]}','recruiter_review', now() + interval '30 days') returning id, candidate_id, revoked_at`, [EMP]);
const c1 = r.rows?.[0];
check('C1 candidate grants a consent', c1 && c1.candidate_id === U.a && c1.revoked_at === null, J(r));
r = await A(`insert into consents (employer_id, scope, purpose, expires_at) values ($1,'{"parts":["profile"]}','recruiter_review', now() + interval '400 days')`, [EMP]);
check('C2 a consent cannot last more than a year', denied(r), J(r));
r = await A(`insert into consents (employer_id, scope, purpose, expires_at) values ($1,'{"parts":"profile"}','recruiter_review', now() + interval '10 days')`, [EMP]);
check('C3 scope must list its parts as an array', denied(r), J(r));
r = await A(`insert into consents (employer_id, scope, purpose, expires_at) values ('99999999-9999-9999-9999-999999999999','{"parts":["profile"]}','recruiter_review', now() + interval '10 days')`);
check('C4 consent must name a real employer', denied(r), J(r));
r = await A(`update consents set scope = '{"parts":["profile","evidence"]}' where id = $1`, [c1.id]);
check('C5 a consent cannot be edited', denied(r), J(r));
r = await A(`delete from consents where id = $1`, [c1.id]);
check('C6 a consent cannot be deleted (history is kept)', denied(r), J(r));
r = await C(`select id from consents`);
check('C7 another candidate cannot see it', (r.rows || []).length === 0 && !r.error, J(r));
let hc = await SVC(`select has_consent($1,$2,'recruiter_review','profile') as ok, has_consent($1,$2,'recruiter_review','evidence') as other_part, has_consent($1,$2,'matching','profile') as other_purpose`, [U.a, EMP]);
check('C8 has_consent: true for the granted part and purpose only', hc.rows[0].ok === true && hc.rows[0].other_part === false && hc.rows[0].other_purpose === false, J(hc));
r = await A(`update consents set revoked_at = now() where id = $1 returning revoked_at`, [c1.id]);
check('C9 candidate revokes a consent', r.rows?.[0]?.revoked_at, J(r));
r = await A(`update consents set revoked_at = null where id = $1`, [c1.id]);
check('C10 a revoked consent cannot be revived', denied(r), J(r));
hc = await SVC(`select has_consent($1,$2,'recruiter_review','profile') as ok`, [U.a, EMP]);
check('C11 has_consent is false after revoking', hc.rows[0].ok === false, J(hc));
await SVC(`insert into consents (candidate_id, employer_id, scope, purpose, granted_at, expires_at) values ($1,$2,'{"parts":["profile"]}','matching', now() - interval '2 days', now() - interval '1 day')`, [U.a, EMP]);
hc = await SVC(`select has_consent($1,$2,'matching','profile') as ok`, [U.a, EMP]);
check('C12 has_consent is false once a consent has expired', hc.rows[0].ok === false, J(hc));
r = await A(`select has_consent($1,$2,'matching','profile')`, [U.a, EMP]);
check('C13 candidates cannot call has_consent', denied(r), J(r));

// ── profile and targets ──────────────────────────────────────────────────────
r = await A(`insert into career_profiles (full_name, headline) values ('Ivy Test','PM') returning candidate_id`);
check('P1 candidate creates a career profile', r.rows?.[0]?.candidate_id === U.a, J(r));
r = await A(`insert into career_profiles (full_name) values ('Second')`);
check('P2 only one profile per candidate', denied(r), J(r));
r = await A(`update career_profiles set candidate_id = $1`, [U.b]);
check('P3 cannot reassign a profile to someone else', denied(r), J(r));
r = await C(`select id from career_profiles`);
check('P4 another candidate cannot read it', (r.rows || []).length === 0 && !r.error, J(r));
r = await A(`insert into career_targets (role_title, is_primary) values ('AI Product Manager', true) returning id`);
check('P5 candidate sets a primary target', !r.error, J(r));
r = await A(`insert into career_targets (role_title, is_primary) values ('Other', true)`);
check('P6 only one primary target', denied(r), J(r));
r = await ANON(`select id from career_profiles`);
check('P7 anonymous cannot read profiles', denied(r), J(r));

// ── existing production behaviour is untouched ──────────────────────────────
r = await A(`insert into candidate_trust_profiles (user_id, full_name, trust_score) values ($1,'Legacy',99) returning trust_score`, [U.a]);
check('X1 the 2026-10-05 score lock still holds', r.rows?.[0]?.trust_score === 0, J(r));

// ── down migration ──────────────────────────────────────────────────────────
const db2 = await freshDb();
await db2.exec(read(P1));
await db2.exec(read(P1_DOWN));
const left = (await db2.query(`select count(*)::int as n from information_schema.tables where table_schema='public' and table_name in ('career_profiles','career_targets','evidence','trusted_issuers','verification_requests','verification_attempts','consents')`)).rows[0].n;
const legacy = (await db2.query(`select count(*)::int as n from information_schema.tables where table_schema='public' and table_name in ('candidate_trust_profiles','employers','trust_matches')`)).rows[0].n;
check('D1 the down migration removes every new table', left === 0, `left: ${left}`);
check('D2 the down migration leaves existing tables alone', legacy === 3, `legacy: ${legacy}`);
await db2.exec(read(P1));
check('D3 the migration can be applied again after the down migration', true);

for (const x of results) console.log(`${x.ok ? 'PASS' : 'FAIL'}  ${x.name}${x.ok ? '' : '\n        ' + x.detail}`);
console.log(`\n${results.filter(x => x.ok).length}/${results.length} passed`);
process.exit(results.every(x => x.ok) ? 0 : 1);
