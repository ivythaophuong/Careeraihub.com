// End-to-end checks of the Phase 1 security model on a real Supabase STAGING project, through the public API
// (PostgREST + Auth), exactly as a browser, an anonymous visitor and the verification service would use it.
//
//   node staging-test.mjs
//
// Reads ~/.careeraihub-staging.env (or $STAGING_ENV) with three lines: STAGING_URL, STAGING_ANON_KEY, STAGING_SERVICE_ROLE_KEY.
// It never prints a key. It creates three throw-away users and deletes them at the end (which also tests erasure).
// It REFUSES to run against the production project.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const PRODUCTION_REF = 'ruibdsvrcctxgxctaxwe';
const envPath = process.env.STAGING_ENV || path.join(os.homedir(), '.careeraihub-staging.env');
const env = Object.fromEntries(fs.readFileSync(envPath, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const URL_ = (env.STAGING_URL || '').replace(/\/$/, '');
const ANON = env.STAGING_ANON_KEY, SERVICE = env.STAGING_SERVICE_ROLE_KEY;
if (!URL_ || !ANON || !SERVICE) { console.error('Missing STAGING_URL / STAGING_ANON_KEY / STAGING_SERVICE_ROLE_KEY in ' + envPath); process.exit(2); }
if (URL_.includes(PRODUCTION_REF)) { console.error('Refusing to run: that is the PRODUCTION project.'); process.exit(2); }

async function api(method, p, { token, key = ANON, body, prefer } = {}) {
  const headers = { apikey: key, Authorization: `Bearer ${token || key}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(URL_ + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null; const text = await res.text();
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json };
}
const rest = (method, table, o = {}) => api(method, `/rest/v1/${table}`, { prefer: 'return=representation', ...o });
const rpc = (name, args, o = {}) => api('POST', `/rest/v1/rpc/${name}`, { body: args, ...o });
const refused = (r) => r.status >= 400 && r.status < 500;
const rows = (r) => (Array.isArray(r.body) ? r.body : []);

const stamp = Date.now();
const users = {};
async function makeUser(tag) {
  const email = `staging-${tag}-${stamp}@example.test`, password = crypto.randomUUID() + 'Aa1!';
  const c = await api('POST', '/auth/v1/admin/users', { key: SERVICE, body: { email, password, email_confirm: true } });
  if (c.status >= 300) throw new Error(`could not create user ${tag}: HTTP ${c.status}`);
  const s = await api('POST', '/auth/v1/token?grant_type=password', { body: { email, password } });
  if (!s.body?.access_token) throw new Error(`could not sign in ${tag}: HTTP ${s.status}`);
  users[tag] = { id: c.body.id, token: s.body.access_token };
}

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });
const A = () => ({ token: users.a.token }), B = () => ({ token: users.b.token }), SVC = () => ({ key: SERVICE });

try {
  await makeUser('a'); await makeUser('b'); await makeUser('c');

  // evidence: what a candidate can and cannot do
  let r = await rest('POST', 'evidence', { ...A(), body: { type: 'education', claim: 'BBA, NUS', source_type: 'user_claim' } });
  const ev = rows(r)[0];
  check('E1 candidate adds a claim: owned, UNVERIFIED, NOT_ELIGIBLE', r.status === 201 && ev?.candidate_id === users.a.id && ev.verification_status === 'UNVERIFIED' && ev.trust_status === 'NOT_ELIGIBLE', `HTTP ${r.status}`);
  r = await rest('POST', 'evidence', { ...A(), body: { type: 'education', claim: 'forged', source_type: 'user_claim', verification_status: 'VERIFIED' } });
  check('E2 candidate cannot set verification_status', refused(r), `HTTP ${r.status}`);
  r = await rest('POST', 'evidence', { ...A(), body: { type: 'education', claim: 'forged', source_type: 'user_claim', trust_status: 'ELIGIBLE' } });
  check('E3 candidate cannot set trust_status', refused(r), `HTTP ${r.status}`);
  r = await rest('POST', 'evidence', { ...A(), body: { candidate_id: users.b.id, type: 'education', claim: 'for B', source_type: 'user_claim' } });
  check('E4 candidate cannot write evidence for someone else', refused(r), `HTTP ${r.status}`);
  r = await rest('PATCH', `evidence?id=eq.${ev.id}`, { ...A(), body: { claim: 'edited' } });
  check('E5 candidate cannot edit a claim', refused(r), `HTTP ${r.status}`);
  r = await rest('PATCH', `evidence?id=eq.${ev.id}`, { ...A(), body: { verification_status: 'VERIFIED' } });
  check('E6 candidate cannot change verification_status', refused(r), `HTTP ${r.status}`);
  r = await rest('DELETE', `evidence?id=eq.${ev.id}`, { ...A() });
  check('E7 candidate cannot delete evidence', refused(r), `HTTP ${r.status}`);
  r = await rest('POST', 'evidence', { ...A(), body: { type: 'identity', claim: 'Passport', source_type: 'user_upload', raw_credential: { scan: 'x' } } });
  check('E8 identity evidence cannot hold a raw document', refused(r) || r.status === 400, `HTTP ${r.status}`);

  // RLS: other candidates, anonymous
  r = await rest('GET', 'evidence', { ...B() });
  check('R1 another candidate sees none of it', r.status === 200 && rows(r).length === 0, `HTTP ${r.status}, ${rows(r).length} rows`);
  r = await rest('GET', 'evidence', { key: ANON });
  check('R2 anonymous cannot read evidence', refused(r) || (r.status === 200 && rows(r).length === 0), `HTTP ${r.status}`);
  r = await rest('GET', 'evidence_current', { ...A() });
  check('R3 the view shows the owner their evidence', r.status === 200 && rows(r).length === 1, `HTTP ${r.status}, ${rows(r).length} rows`);
  r = await rest('GET', 'evidence_current', { ...B() });
  check('R4 the view obeys row level security (security_invoker): B sees nothing', r.status === 200 && rows(r).length === 0, `HTTP ${r.status}, ${rows(r).length} rows`);

  // withdraw
  const e2 = rows(await rest('POST', 'evidence', { ...A(), body: { type: 'skill', claim: 'SQL', source_type: 'user_claim' } }))[0];
  r = await rest('PATCH', `evidence?id=eq.${e2.id}`, { ...A(), body: { withdrawn_at: new Date().toISOString() } });
  check('W1 candidate withdraws their own evidence', r.status === 200 && rows(r)[0]?.withdrawn_at, `HTTP ${r.status}`);
  r = await rest('PATCH', `evidence?id=eq.${e2.id}`, { ...A(), body: { withdrawn_at: null } });
  check('W2 a withdrawal cannot be undone', refused(r), `HTTP ${r.status}`);
  r = await rest('PATCH', `evidence?id=eq.${ev.id}`, { ...B(), body: { withdrawn_at: new Date().toISOString() } });
  check('W3 another candidate cannot withdraw it', (r.status === 200 && rows(r).length === 0) || refused(r), `HTTP ${r.status}`);

  // requests and the service workflow
  r = await rest('POST', 'verification_requests', { ...A(), body: { evidence_id: ev.id } });
  const rq = rows(r)[0];
  check('Q1 candidate requests verification: QUEUED', r.status === 201 && rq?.status === 'QUEUED', `HTTP ${r.status}`);
  r = await rest('POST', 'verification_requests', { ...A(), body: { evidence_id: ev.id } });
  check('Q2 only one open request per evidence', refused(r) || r.status === 409, `HTTP ${r.status}`);
  r = await rest('POST', 'verification_requests', { ...A(), body: { evidence_id: e2.id } });
  check('Q3 withdrawn evidence cannot be sent for verification', refused(r) || r.status === 409, `HTTP ${r.status}`);

  r = await rpc('start_verification', { p_request_id: rq.id }, { ...A() });
  check('F1 candidate cannot call start_verification', refused(r), `HTTP ${r.status}`);
  r = await rpc('apply_verification_attempt', { p_evidence_id: ev.id, p_request_id: null, p_provider: 'x', p_adapter_version: 'v', p_policy_version: 'p', p_started_at: new Date().toISOString(), p_outcome: 'VERIFIED', p_method: 'opencerts', p_confidence: 'HIGH', p_checks: {}, p_subject_id: null, p_subject_binding: 'did_proof', p_raw: {}, p_error: null }, { ...A() });
  check('F2 candidate cannot call apply_verification_attempt', refused(r), `HTTP ${r.status}`);
  r = await rpc('has_consent', { p_candidate: users.a.id, p_employer: users.a.id, p_purpose: 'matching', p_part: 'profile' }, { key: ANON });
  check('F3 anonymous cannot call has_consent', refused(r), `HTTP ${r.status}`);
  r = await rpc('purge_raw_credential', { p_evidence_id: ev.id }, { ...A() });
  check('F4 candidate cannot call purge_raw_credential', refused(r), `HTTP ${r.status}`);

  r = await rpc('start_verification', { p_request_id: rq.id }, { ...SVC() });
  check('F5 service role can start a verification', r.status < 300, `HTTP ${r.status}`);
  let cur = rows(await rest('GET', `evidence?id=eq.${ev.id}`, { ...SVC() }))[0];
  check('F6 the evidence is now PENDING', cur?.verification_status === 'PENDING', cur?.verification_status);
  const ALL_TRUE = { credential_valid: true, signature_valid: true, issuer_trusted: true, revocation_checked: true, recipient_binding_verified: true, expiration_valid: true, schema_valid: true, source_reachable: true };
  r = await rpc('apply_verification_attempt', { p_evidence_id: ev.id, p_request_id: rq.id, p_provider: 'opencerts', p_adapter_version: 'staging-test', p_policy_version: 'policy-v1', p_started_at: new Date().toISOString(), p_outcome: 'VERIFIED', p_method: 'opencerts', p_confidence: 'HIGH', p_checks: ALL_TRUE, p_subject_id: 'a@example.test', p_subject_binding: 'email_verified', p_raw: {}, p_error: null }, { ...SVC() });
  cur = rows(await rest('GET', `evidence?id=eq.${ev.id}`, { ...SVC() }))[0];
  check('F7 service role applies a result: VERIFIED and ELIGIBLE, signed by the verifier', r.status < 300 && cur?.verification_status === 'VERIFIED' && cur.trust_status === 'ELIGIBLE' && cur.verified_by === 'verifier:opencerts:staging-test', `HTTP ${r.status} ${cur?.verification_status}/${cur?.trust_status}`);
  r = await rest('GET', 'verification_attempts', { ...A() });
  check('F8 the candidate can read their own audit trail', r.status === 200 && rows(r).length === 1, `HTTP ${r.status}, ${rows(r).length} rows`);
  r = await rest('GET', 'verification_attempts', { ...B() });
  check('F9 another candidate cannot', r.status === 200 && rows(r).length === 0, `HTTP ${r.status}, ${rows(r).length} rows`);
  r = await rest('PATCH', `verification_attempts?evidence_id=eq.${ev.id}`, { ...SVC(), body: { outcome: 'FAILED' } });
  check('F10 the audit trail cannot be edited, even with the service role', r.status >= 400, `HTTP ${r.status}`);

  // trusted issuers
  r = await rest('GET', 'trusted_issuers', { ...A() });
  check('I1 candidates cannot read the trusted-issuer policy', refused(r) || (r.status === 200 && rows(r).length === 0), `HTTP ${r.status}`);
  r = await rest('POST', 'trusted_issuers', { ...SVC(), body: { issuer_identifier: 'staging.example.edu', issuer_name: 'Staging U', issuer_type: 'university', verification_method: 'opencerts', policy_version: 'v1' } });
  check('I2 the service role can add an issuer', r.status === 201, `HTTP ${r.status}`);

  // consents
  const emp = rows(await rest('POST', 'employers', { ...SVC(), body: { owner_id: users.c.id, name: 'Staging Co' } }))[0];
  r = await rest('POST', 'consents', { ...A(), body: { employer_id: emp.id, scope: { parts: ['profile'] }, purpose: 'recruiter_review', expires_at: new Date(Date.now() + 30 * 864e5).toISOString() } });
  const cs = rows(r)[0];
  check('C1 candidate grants a consent', r.status === 201 && cs?.candidate_id === users.a.id, `HTTP ${r.status}`);
  r = await rest('POST', 'consents', { ...A(), body: { employer_id: emp.id, scope: { parts: ['profile'] }, purpose: 'matching', expires_at: new Date(Date.now() + 400 * 864e5).toISOString() } });
  check('C2 a consent cannot last more than a year', refused(r), `HTTP ${r.status}`);
  r = await rest('PATCH', `consents?id=eq.${cs.id}`, { ...A(), body: { scope: { parts: ['profile', 'evidence'] } } });
  check('C3 a consent cannot be edited', refused(r), `HTTP ${r.status}`);
  r = await rest('PATCH', `consents?id=eq.${cs.id}`, { ...A(), body: { revoked_at: new Date().toISOString() } });
  check('C4 candidate revokes it', r.status === 200 && rows(r)[0]?.revoked_at, `HTTP ${r.status}`);
  r = await rest('PATCH', `consents?id=eq.${cs.id}`, { ...A(), body: { revoked_at: null } });
  check('C5 a revoked consent cannot be revived', refused(r), `HTTP ${r.status}`);
  r = await rest('GET', 'consents', { ...B() });
  check('C6 another candidate cannot see it', r.status === 200 && rows(r).length === 0, `HTTP ${r.status}`);

  // profile
  r = await rest('POST', 'career_profiles', { ...A(), body: { full_name: 'Staging A' } });
  check('P1 candidate creates a career profile', r.status === 201, `HTTP ${r.status}`);
  r = await rest('GET', 'career_profiles', { ...B() });
  check('P2 another candidate cannot read it', r.status === 200 && rows(r).length === 0, `HTTP ${r.status}`);

  // the 2026-10-05 score lock still holds on the real platform
  r = await rest('POST', 'candidate_trust_profiles', { ...A(), body: { user_id: users.a.id, full_name: 'Staging A', trust_score: 100 }, prefer: 'resolution=merge-duplicates,return=representation' });
  check('X1 the earlier score lock still holds (trust_score forced to 0)', r.status < 300 ? rows(r)[0]?.trust_score === 0 : refused(r), `HTTP ${r.status}`);
} catch (e) {
  check('SETUP the test could not run to the end', false, e.message);
} finally {
  // erasure: deleting the users must remove everything, including the append-only audit rows
  const ids = Object.values(users).map(u => u.id);
  for (const id of ids) await api('DELETE', `/auth/v1/admin/users/${id}`, { key: SERVICE });
  if (ids.length) {
    const list = `(${ids.join(',')})`;
    const ev = rows(await rest('GET', `evidence?candidate_id=in.${list}`, { key: SERVICE }));
    const at = rows(await rest('GET', `verification_attempts?select=id,evidence_id`, { key: SERVICE })).filter(a => ev.some(e => e.id === a.evidence_id));
    check('Z1 deleting the accounts removes their evidence and audit rows (erasure works on Supabase)', ev.length === 0 && at.length === 0, `${ev.length} evidence, ${at.length} attempts left`);
  }
  await api('DELETE', `/rest/v1/employers?name=eq.Staging%20Co`, { key: SERVICE });
  await api('DELETE', `/rest/v1/trusted_issuers?issuer_identifier=eq.staging.example.edu`, { key: SERVICE });
}

for (const x of results) console.log(`${x.ok ? 'PASS' : 'FAIL'}  ${x.name}${x.ok ? '' : '\n        ' + x.detail}`);
console.log(`\n${results.filter(x => x.ok).length}/${results.length} passed`);
process.exit(results.every(x => x.ok) ? 0 : 1);
