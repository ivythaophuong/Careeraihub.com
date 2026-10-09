// GraphQL path check (pg_graphql, /graphql/v1) on a LOCAL Supabase stack, same setup as rest-consent-test.mjs.
//   node graphql-check.mjs --expect=before   # none of the fixes applied: the issues must be reproduced through GraphQL too
//   node graphql-check.mjs --expect=after    # S1, S2, S3 and S3b applied
// Why: the production project has the pg_graphql extension (checked 2026-10-09), so every table and function the API roles may use is reachable through GraphQL as well as REST.
// This script lists what GraphQL exposes to anon and to a signed-in user, then repeats the main attacks through it. Reads STAGING_ENV like the REST test; refuses production.
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
const BASE = (env.STAGING_URL || '').replace(/\/$/, ''), ANON = env.STAGING_ANON_KEY, SERVICE = env.STAGING_SERVICE_ROLE_KEY;
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
const gql = (query, o = {}) => api('POST', '/graphql/v1', { ...o, body: { query } });
const rows = (r) => (Array.isArray(r.body) ? r.body : []);
const data = (r) => r.body?.data ?? null;

const stamp = Date.now(); const users = {};
async function makeUser(tag) {
  const email = `gql-${tag}-${stamp}@example.test`, password = crypto.randomUUID() + 'Aa1!';
  const c = await api('POST', '/auth/v1/admin/users', { key: SERVICE, body: { email, password, email_confirm: true } });
  if (c.status >= 300) throw new Error(`could not create user ${tag}: HTTP ${c.status}`);
  const s = await api('POST', '/auth/v1/token?grant_type=password', { body: { email, password } });
  users[tag] = { id: c.body.id, token: s.body.access_token };
}
const T = (t) => ({ token: users[t].token }), SVC = { key: SERVICE };
const results = [];
const rec = (id, kind, name, ok, detail = '') => results.push({ id, kind, name, ok: !!ok, detail });

// the SQL functions that must never be reachable from the browser roles, by any API
const FORBIDDEN_FN = ['apply_verification_attempt', 'start_verification', 'has_consent', 'recompute_trust_score', 'trigger_recompute_trust_score', 'purge_raw_credential'];
// pg_graphql 1.6 answers "Unknown field __schema" to introspection here, so exposure is probed by NAME: calling a field that is not exposed gives
// 'Unknown field "name"'; any other answer (missing argument, permission error, data) means the field exists for that caller.
const probe = async (name, who) => {
  const out = {};
  for (const kind of ['query', 'mutation']) {
    const r = await gql(`${kind === 'mutation' ? 'mutation ' : ''}{ ${name} }`, who);
    const msg = (r.body?.errors || []).map((e) => e.message).join(' | ');
    out[kind] = !msg.includes(`Unknown field "${name}"`);
  }
  return out.query || out.mutation;
};

let E1;
try {
  for (const t of ['a', 'b', 'o', 'q']) await makeUser(t);
  E1 = crypto.randomUUID(); const E2 = crypto.randomUUID();
  await rest('POST', 'employers', { ...SVC, body: [{ id: E1, owner_id: users.o.id, name: 'GQL Verified Co' }, { id: E2, owner_id: users.q.id, name: 'GQL Other Co' }] });
  await rest('PATCH', `employers?id=in.(${E1},${E2})`, { ...SVC, body: { verified_at: new Date().toISOString() } });
  await rest('POST', 'candidate_trust_profiles', { ...T('a'), body: { user_id: users.a.id, full_name: 'Alice GQL', headline: 'Analyst', is_visible: true } });

  // what GraphQL exposes, by name
  rec('X0', 'control', 'the probe works: it sees a real field and does not see a made-up one',
    (await probe('candidate_trust_profilesCollection', T('a'))) === true && (await probe('no_such_field_xyz', T('a'))) === false);
  const callers = { anon: {}, user: T('a') };
  for (const [label, who] of Object.entries(callers)) {
    const leaked = [];
    for (const f of FORBIDDEN_FN) if (await probe(f, who)) leaked.push(f);
    rec(label === 'anon' ? 'X2' : 'X3', 'control', `no verification / scoring function is reachable through GraphQL by ${label === 'anon' ? 'anon' : 'a signed-in user'}`, leaked.length === 0, leaked.join(','));
  }
  const visible = async (who) => { const v = []; for (const f of ['employer_view_candidates', 'list_open_jobs', 'employer_has_consent']) if (await probe(f, who)) v.push(f); return v; };
  const vUser = await visible(T('a')), vAnon = await visible({});
  rec('X4', 'info', `our new functions reachable through GraphQL: signed-in user [${vUser.join(', ') || 'none'}], anon [${vAnon.join(', ') || 'none'}]`, true);
  if (MODE === 'after') rec('X5', 'fix', 'the new functions are not reachable by anon through GraphQL', vAnon.length === 0, vAnon.join(','));
  const userI = { q: [], m: [] };
  const mine = () => vUser;
  // pg_graphql names the collections after the tables
  const coll = (t) => `${t}Collection`;

  // F-4 through GraphQL: a verified recruiter reads the visible profile without consent
  const read = async (who, table, cols = 'user_id') => {
    const r = await gql(`{ ${coll(table)}(first: 20) { edges { node { ${cols} } } } }`, who);
    return { n: (data(r)?.[coll(table)]?.edges || []).length, err: r.body?.errors?.[0]?.message || null, status: r.status };
  };
  let r = await read(T('o'), 'candidate_trust_profiles');
  rec('F-4a', 'issue', `GraphQL: verified recruiter, no consent: ${r.n} profile row(s)${r.err ? ' (' + r.err.slice(0, 60) + ')' : ''}`, r.n === 0, JSON.stringify(r));
  r = await read({}, 'candidate_trust_profiles');
  rec('C1', 'control', 'GraphQL: anonymous reads no profiles', r.n === 0, JSON.stringify(r));
  r = await read(T('b'), 'candidate_trust_profiles');
  rec('C2', 'control', 'GraphQL: another candidate reads no foreign profile', r.n === 0, JSON.stringify(r));
  r = await read(T('a'), 'candidate_trust_profiles', 'user_id full_name');
  rec('C3', 'control', 'GraphQL: the candidate reads their own profile', r.n === 1, JSON.stringify(r));

  // F-1 through GraphQL (stays open until S4)
  const ins = await gql(`mutation { insertInto${'resume_scans'}Collection(objects: [{ user_id: "${users.a.id}", credibility_score: 100 }]) { affectedCount } }`, T('a'));
  const prof = rows(await rest('GET', `candidate_trust_profiles?user_id=eq.${users.a.id}`, { ...SVC }))[0];
  rec('F-1', 'issue', `GraphQL: candidate inserts a scan of 100 → ats_score ${prof?.ats_score}, trust_score ${prof?.trust_score}`, prof?.ats_score !== 100, JSON.stringify({ affected: data(ins)?.insertIntoresume_scansCollection?.affectedCount, err: ins.body?.errors?.[0]?.message }));

  // F-2 through GraphQL
  const job = rows(await rest('POST', 'job_listings', { ...SVC, body: { employer_id: E1, posted_by: users.o.id, title: 'GQL job', status: 'open' } }))[0];
  const m = rows(await rest('POST', 'trust_matches', { ...SVC, body: { employer_id: E1, candidate_id: users.a.id, job_id: job.id, status: 'new' } }))[0];
  const up = await gql(`mutation { updatetrust_matchesCollection(set: { match_score: 100, recruiter_action: "shortlisted" }, filter: { id: { eq: "${m.id}" } }) { affectedCount } }`, T('a'));
  const mm = rows(await rest('GET', `trust_matches?id=eq.${m.id}`, { ...SVC }))[0];
  rec('F-2', 'issue', `GraphQL: candidate sets match_score / recruiter_action → match_score ${mm?.match_score}, action ${mm?.recruiter_action}`, mm?.match_score !== 100 && mm?.recruiter_action !== 'shortlisted', JSON.stringify({ affected: data(up)?.updatetrust_matchesCollection?.affectedCount, err: up.body?.errors?.[0]?.message }));

  // consents through GraphQL
  await rest('POST', 'consents', { ...T('a'), body: { employer_id: E1, scope: { parts: ['profile'] }, purpose: 'recruiter_review', expires_at: new Date(Date.now() + 30 * 86400000).toISOString() } });
  r = await read(T('b'), 'consents', 'id');
  rec('C4', 'control', 'GraphQL: another candidate reads no consents', r.n === 0, JSON.stringify(r));
  r = await read(T('o'), 'consents', 'id');
  rec('C5', 'control', 'GraphQL: a recruiter reads no consents', r.n === 0, JSON.stringify(r));
  if (MODE === 'after') {
    r = await read(T('o'), 'candidate_trust_profiles');
    rec('G1', 'fix', 'GraphQL: even WITH a consent the recruiter still cannot read the profile table directly', r.n === 0, JSON.stringify(r));
    const tw = await gql(`mutation { updateconsentsCollection(set: { scope: { parts: ["profile","salary"] } }, filter: { employer_id: { eq: "${E1}" } }) { affectedCount } }`, T('a'));
    const sc = rows(await rest('GET', `consents?employer_id=eq.${E1}`, { ...T('a') }))[0];
    rec('G2', 'fix', 'GraphQL: the candidate cannot widen a consent by editing scope', JSON.stringify(sc?.scope?.parts) === '["profile"]', JSON.stringify({ err: tw.body?.errors?.[0]?.message, parts: sc?.scope?.parts }));
    if (mine().includes('employer_has_consent')) {
      const call = (who) => gql(`{ employer_has_consent(p_candidate: "${users.a.id}", p_employer: "${E1}", p_part: "profile") }`, who);
      const asB = data(await call(T('b')))?.employer_has_consent, asO = data(await call(T('o')))?.employer_has_consent;
      rec('G3', 'fix', 'GraphQL: a non-member cannot use employer_has_consent to learn that a consent exists (returns false)', asB === false, String(asB));
      rec('G4', 'fix', 'GraphQL: a verified member of that employer gets true for their own consent', asO === true, String(asO));
    }
    if (mine().includes('employer_view_candidates')) {
      const fr = await gql(`{ employer_view_candidates(p_employer_id: "${E1}") }`, T('q'));
      rec('G3', 'fix', 'GraphQL: a recruiter of ANOTHER employer gets nothing from employer_view_candidates', JSON.stringify(data(fr) ?? '').indexOf('Alice') === -1, JSON.stringify(fr.body).slice(0, 120));
    }
  }
} finally {
  for (const u of Object.values(users)) await api('DELETE', `/auth/v1/admin/users/${u.id}`, { key: SERVICE });
  if (E1) await rest('DELETE', `employers?owner_id=in.(${Object.values(users).map((u) => u.id).join(',')})`, { ...SVC });
}

const expectOpen = { before: ['F-4a', 'F-1', 'F-2'], after: ['F-1'] };
let bad = 0;
for (const x of results) {
  let label;
  if (x.kind === 'issue') { const open = expectOpen[MODE].includes(x.id); const good = open ? !x.ok : x.ok; label = `${good ? 'AS EXPECTED' : 'MISMATCH   '} ${x.ok ? 'FIXED' : 'OPEN '}`; if (!good) bad++; }
  else if (x.kind === 'info') label = 'INFO       ';
  else { label = x.ok ? 'PASS       ' : 'FAIL       '; if (!x.ok) bad++; }
  console.log(`${label} ${x.id.padEnd(5)} ${x.name}`);
}
console.log(`\n${results.length} checks, ${bad} mismatch(es) for --expect=${MODE}`);
if (process.env.VERBOSE) for (const x of results) console.log(x.id, x.detail);
process.exit(bad ? 1 : 0);
