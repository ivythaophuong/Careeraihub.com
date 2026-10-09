// REST-level checks of the integrity findings and of the proposed fixes S1, S2, S3 and S3b, through the PUBLIC API of a Supabase stack
// (PostgREST + Auth), as a browser, a recruiter and an anonymous visitor would use it. Use a LOCAL stack (`supabase start`) or a staging project.
//
//   node rest-consent-test.mjs --expect=before   # none of the fixes applied: the issues must be reproduced (OPEN)
//   node rest-consent-test.mjs --expect=after    # S1, S2, S3 and S3b applied: F-5, F-2, F-4 must be FIXED, F-1 stays OPEN (needs S4)
//
// Reads ~/.careeraihub-staging.env (or $STAGING_ENV): STAGING_URL, STAGING_ANON_KEY, STAGING_SERVICE_ROLE_KEY. For a local stack the values come from
// `supabase status -o env` (API_URL, ANON_KEY, SERVICE_ROLE_KEY). It never prints a key. It creates throw-away users and rows and removes them at the end.
// It REFUSES to run against the production project.
//
// STATUS: run 2026-10-09 on a local Supabase stack, first with the reduced bootstrap schema and then with the real production schema restored from a dump
// (see LOCAL.md). It sets job_id on matches because production's trust_matches.job_id is NOT NULL.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const PRODUCTION_REF = 'ruibdsvrcctxgxctaxwe';
const MODE = (process.argv.find((a) => a.startsWith('--expect=')) || '').slice('--expect='.length);
if (!['before', 'after'].includes(MODE)) { console.error('Use --expect=before or --expect=after'); process.exit(2); }
const envPath = process.env.STAGING_ENV || path.join(os.homedir(), '.careeraihub-staging.env');
const env = Object.fromEntries(fs.readFileSync(envPath, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('='))
  .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]));
const BASE = (env.STAGING_URL || '').replace(/\/$/, '');
const ANON = env.STAGING_ANON_KEY, SERVICE = env.STAGING_SERVICE_ROLE_KEY;
if (!BASE || !ANON || !SERVICE) { console.error('Missing STAGING_URL / STAGING_ANON_KEY / STAGING_SERVICE_ROLE_KEY in ' + envPath); process.exit(2); }
if (BASE.includes(PRODUCTION_REF)) { console.error('Refusing to run: that is the PRODUCTION project.'); process.exit(2); }

async function api(method, p, { token, key = ANON, body, prefer } = {}) {
  const headers = { apikey: key, Authorization: `Bearer ${token || key}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(BASE + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text(); let json = null;
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
  const email = `rest-${tag}-${stamp}@example.test`, password = crypto.randomUUID() + 'Aa1!';
  const c = await api('POST', '/auth/v1/admin/users', { key: SERVICE, body: { email, password, email_confirm: true } });
  if (c.status >= 300) throw new Error(`could not create user ${tag}: HTTP ${c.status}`);
  const s = await api('POST', '/auth/v1/token?grant_type=password', { body: { email, password } });
  if (!s.body?.access_token) throw new Error(`could not sign in ${tag}: HTTP ${s.status}`);
  users[tag] = { id: c.body.id, token: s.body.access_token };
}
const T = (tag) => ({ token: users[tag].token });
const SVC = { key: SERVICE };

const results = [];
// kind 'issue': OPEN means the problem is present; 'control' must always hold; 'fix' only applies after the fixes.
const rec = (id, kind, name, ok, detail = '') => results.push({ id, kind, name, ok: !!ok, detail });

let E1, E2;
try {
  for (const t of ['a', 'b', 'o', 'q']) await makeUser(t);
  E1 = crypto.randomUUID(); E2 = crypto.randomUUID();
  await rest('POST', 'employers', { ...SVC, body: [{ id: E1, owner_id: users.o.id, name: 'REST Verified Co' }, { id: E2, owner_id: users.q.id, name: 'REST Other Co' }] });
  await rest('PATCH', 'employers?id=in.(' + E1 + ',' + E2 + ')', { ...SVC, body: { verified_at: new Date().toISOString() } });
  await rest('POST', 'candidate_trust_profiles', { ...T('a'), body: { user_id: users.a.id, full_name: 'Alice REST', headline: 'Analyst', bio: 'private bio', is_visible: true } });
  await rest('PATCH', `candidate_trust_profiles?user_id=eq.${users.a.id}`, { ...SVC, body: { salary_min: 90000, salary_max: 120000, currency: 'SGD' } });

  // controls
  let r = await rest('PATCH', `candidate_trust_profiles?user_id=eq.${users.a.id}`, { ...T('a'), body: { trust_score: 99 } });
  const own = rows(await rest('GET', `candidate_trust_profiles?user_id=eq.${users.a.id}`, { ...T('a') }))[0];
  rec('C1', 'control', 'a candidate cannot write trust_score directly', own && own.trust_score !== 99, `HTTP ${r.status}`);
  r = await rest('GET', `candidate_trust_profiles?user_id=eq.${users.a.id}`, { ...T('b') });
  rec('C2', 'control', 'another candidate cannot read the profile', rows(r).length === 0, `HTTP ${r.status}`);
  r = await rest('GET', 'candidate_trust_profiles', { });
  rec('C3', 'control', 'anonymous gets no profile rows', refused(r) || rows(r).length === 0, `HTTP ${r.status}`);

  // F-1: forged scores (stays OPEN until S4)
  await rest('POST', 'resume_scans', { ...T('a'), body: { user_id: users.a.id, credibility_score: 100 } });
  await rest('POST', 'mock_sessions', { ...T('a'), body: { user_id: users.a.id, avg_score: 100 } });
  await rest('POST', 'star_stories', { ...T('a'), body: { user_id: users.a.id, score: 100 } });
  let prof = rows(await rest('GET', `candidate_trust_profiles?user_id=eq.${users.a.id}`, { ...SVC }))[0];
  rec('F-1', 'issue', `candidate writes score rows of 100 → trust_score ${prof?.trust_score}`, prof?.trust_score !== 100, JSON.stringify(prof));

  // F-5: delete the inputs
  const before = prof?.trust_score;
  await rest('DELETE', `resume_scans?user_id=eq.${users.a.id}`, { ...T('a') });
  await rest('DELETE', `mock_sessions?user_id=eq.${users.a.id}`, { ...T('a') });
  await rest('DELETE', `star_stories?user_id=eq.${users.a.id}`, { ...T('a') });
  prof = rows(await rest('GET', `candidate_trust_profiles?user_id=eq.${users.a.id}`, { ...SVC }))[0];
  rec('F-5', 'issue', `all inputs deleted → trust_score ${before} → ${prof?.trust_score}`, prof?.trust_score !== before, JSON.stringify(prof));

  // F-4a/F-4d: recruiter reads without consent (direct table and, once it exists, the function)
  const direct = rows(await rest('GET', `candidate_trust_profiles?user_id=eq.${users.a.id}`, { ...T('o') }));
  const viaFn = await rpc('employer_view_candidates', { p_employer_id: E1, p_candidate_id: users.a.id }, { ...T('o') });
  const fnRows = rows(viaFn).length;
  rec('F-4a', 'issue', `verified recruiter, no consent: direct ${direct.length} row(s), function ${viaFn.status === 404 ? 'not installed' : fnRows + ' row(s)'}`, direct.length === 0 && fnRows === 0, JSON.stringify({ direct: direct.length, fn: viaFn.status }));
  const other = rows(await rest('GET', `candidate_trust_profiles?user_id=eq.${users.a.id}`, { ...T('q') })).length + rows(await rpc('employer_view_candidates', { p_employer_id: E2, p_candidate_id: users.a.id }, { ...T('q') })).length;
  rec('F-4d', 'issue', `a second verified employer, no consent: ${other} row(s)`, other === 0);

  // F-2: candidate edits their own match
  // production's trust_matches.job_id is NOT NULL, so a real job listing is needed
  const job = rows(await rest('POST', 'job_listings', { ...SVC, body: { employer_id: E1, posted_by: users.o.id, title: 'REST match job', status: 'open' } }))[0];
  const m = rows(await rest('POST', 'trust_matches', { ...SVC, body: { employer_id: E1, candidate_id: users.a.id, job_id: job.id, status: 'new' } }))[0];
  r = await rest('PATCH', `trust_matches?id=eq.${m.id}`, { ...T('a'), body: { match_score: 100, recruiter_action: 'shortlisted', status: 'matched' } });
  const mm = rows(await rest('GET', `trust_matches?id=eq.${m.id}`, { ...SVC }))[0];
  rec('F-2', 'issue', `candidate PATCHes match_score/recruiter_action/status → HTTP ${r.status}, match_score ${mm?.match_score}`, mm?.match_score !== 100 && mm?.recruiter_action !== 'shortlisted', JSON.stringify(mm));
  r = await rest('PATCH', `trust_matches?id=eq.${m.id}`, { ...T('a'), body: { candidate_action: 'interested' } });
  rec('F-2c', 'control', 'the candidate can still record candidate_action', r.status < 300 && rows(r)[0]?.candidate_action === 'interested', `HTTP ${r.status}`);

  if (MODE === 'after') {
    // consent flow through the API
    const grant = (parts, extra = {}) => rest('POST', 'consents', { ...T('a'), body: { employer_id: E1, scope: { parts }, purpose: 'recruiter_review', expires_at: new Date(Date.now() + 30 * 86400000).toISOString(), ...extra } });
    r = await grant(['profile']);
    rec('G1', 'fix', 'the candidate grants a consent (profile)', r.status === 201 && rows(r)[0]?.id, `HTTP ${r.status}`);
    let v = rows(await rpc('employer_view_candidates', { p_employer_id: E1 }, { ...T('o') }));
    rec('G2', 'fix', 'the recruiter now sees name/bio through the function, not the salary', v.length === 1 && v[0].full_name === 'Alice REST' && v[0].salary_min === null, JSON.stringify(v[0] || {}));
    rec('G3', 'fix', 'the function never returns practice scores', v[0] && !('trust_score' in v[0]) && !('ats_score' in v[0]), Object.keys(v[0] || {}).join(','));
    rec('G4', 'fix', 'the base table is still closed to the recruiter even with consent', rows(await rest('GET', `candidate_trust_profiles?user_id=eq.${users.a.id}`, { ...T('o') })).length === 0);
    rec('G5', 'fix', 'a recruiter of ANOTHER employer cannot read as E1 or as E2', rows(await rpc('employer_view_candidates', { p_employer_id: E1 }, { ...T('q') })).length === 0 && rows(await rpc('employer_view_candidates', { p_employer_id: E2 }, { ...T('q') })).length === 0);
    r = await rpc('employer_view_candidates', { p_employer_id: E1 }, {});
    rec('G6', 'fix', 'anonymous cannot call the function', refused(r), `HTTP ${r.status}`);
    rec('G7', 'fix', 'another candidate cannot read or revoke this candidate\'s consents',
      rows(await rest('GET', 'consents', { ...T('b') })).length === 0 && rows(await rest('PATCH', `consents?employer_id=eq.${E1}`, { ...T('b'), body: { revoked_at: new Date().toISOString() } })).length === 0);
    rec('G8', 'fix', 'a recruiter cannot read the consent rows', rows(await rest('GET', 'consents', { ...T('o') })).length === 0);
    r = await rest('PATCH', `consents?employer_id=eq.${E1}`, { ...T('a'), body: { scope: { parts: ['profile', 'salary'] } } });
    rec('G9', 'fix', 'the candidate cannot widen a consent by editing scope', refused(r), `HTTP ${r.status}`);
    r = await grant(['profile'], { purpose: 'sell_my_data' });
    rec('G10', 'fix', 'an unknown purpose is refused', refused(r), `HTTP ${r.status}`);
    r = await grant(['profile'], { expires_at: new Date(Date.now() + 400 * 86400000).toISOString() });
    rec('G11', 'fix', 'an expiry beyond 365 days is refused', refused(r), `HTTP ${r.status}`);
    await grant(['salary']);
    v = rows(await rpc('employer_view_candidates', { p_employer_id: E1 }, { ...T('o') }));
    rec('G12', 'fix', 'a second consent adds the salary range', v[0]?.salary_min === 90000, JSON.stringify(v[0] || {}));
    r = await rest('PATCH', `consents?employer_id=eq.${E1}&revoked_at=is.null`, { ...T('a'), body: { revoked_at: new Date().toISOString() } });
    rec('G13', 'fix', 'one PATCH revokes every consent of the employer', r.status < 300 && rows(r).length >= 2, `HTTP ${r.status}, ${rows(r).length} rows`);
    rec('G14', 'fix', 'after revocation the recruiter reads nothing', rows(await rpc('employer_view_candidates', { p_employer_id: E1 }, { ...T('o') })).length === 0);
    r = await rest('PATCH', `consents?employer_id=eq.${E1}&revoked_at=is.null`, { ...T('a'), body: { revoked_at: new Date().toISOString() } });
    rec('G15', 'fix', 'repeating the revoke is harmless', r.status < 300 && rows(r).length === 0, `HTTP ${r.status}`);
    // a different job: production has UNIQUE (job_id, candidate_id) and the F-2 setup above already used the first one
    const job2 = rows(await rest('POST', 'job_listings', { ...SVC, body: { employer_id: E1, posted_by: users.o.id, title: 'REST match job 2', status: 'open' } }))[0];
    const newMatch = () => rest('POST', 'trust_matches', { ...T('o'), body: { employer_id: E1, candidate_id: users.a.id, job_id: job2.id, status: 'new' } });
    r = await newMatch();
    rec('G16', 'fix', 'without an active consent a recruiter cannot create a match (the request is otherwise valid: it has a job)', refused(r), `HTTP ${r.status}`);
    r = await grant(['profile']);
    const g16 = await newMatch();
    rec('G16b', 'fix', 'with an active consent the same request succeeds (so G16 refused it because of the consent)', g16.status === 201 && rows(g16)[0]?.match_score === 0 && rows(g16)[0]?.candidate_action === null, `HTTP ${g16.status}`);
    await rest('DELETE', `trust_matches?id=eq.${rows(g16)[0]?.id}`, { ...SVC });
    await rest('PATCH', `consents?employer_id=eq.${E1}&revoked_at=is.null`, { ...T('a'), body: { revoked_at: new Date().toISOString() } });
    rec('G16c', 'fix', 'after revoking, the same request is refused again', refused(await newMatch()));
    // open jobs
    await rest('POST', 'job_listings', { ...SVC, body: { employer_id: E1, title: 'REST open job', status: 'open', posted_by: users.o.id } });
    r = await rpc('list_open_jobs', { p_limit: 5 }, { ...T('a') });
    rec('G17', 'fix', 'a candidate sees the open job with the employer name', rows(r).some((j) => j.employer_name === 'REST Verified Co'), `HTTP ${r.status}`);
    rec('G18', 'fix', 'list_open_jobs is closed to anonymous callers', refused(await rpc('list_open_jobs', { p_limit: 5 }, {})));
  }
} finally {
  // clean up: users (cascade removes their rows) and the employers
  for (const u of Object.values(users)) await api('DELETE', `/auth/v1/admin/users/${u.id}`, { key: SERVICE });
  if (E1) await rest('DELETE', `employers?id=in.(${E1},${E2})`, { ...SVC });
}

// expectations per mode
const expectOpen = { before: ['F-1', 'F-5', 'F-4a', 'F-4d', 'F-2'], after: ['F-1'] };
let mismatches = 0;
for (const x of results) {
  let label;
  if (x.kind === 'issue') {
    const shouldBeOpen = expectOpen[MODE].includes(x.id);
    const state = x.ok ? 'FIXED' : 'OPEN ';
    const good = shouldBeOpen ? !x.ok : x.ok;
    label = `${good ? 'AS EXPECTED' : 'MISMATCH   '} ${state}`;
    if (!good) mismatches++;
  } else { label = x.ok ? 'PASS       ' : 'FAIL       '; if (!x.ok) mismatches++; }
  console.log(`${label} ${x.id.padEnd(5)} ${x.name}`);
}
console.log(`\n${results.length} checks, ${mismatches} mismatch(es) for --expect=${MODE}`);
if (process.env.VERBOSE) for (const x of results) console.log(x.id, x.detail);
process.exit(mismatches ? 1 : 0);
