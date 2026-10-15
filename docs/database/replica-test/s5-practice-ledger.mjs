// S5 test: the practice ledger (docs/database/proposed/2026-10-15-practice-ledger.sql) on an in-memory Postgres. Not a production test.
//   npm i @electric-sql/pglite ; cp this file next to node_modules ; REPO=/path/to/repo node s5-practice-ledger.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const REPO = process.env.REPO || path.resolve(process.cwd(), '../../..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
const FIX = process.env.FIX || 'docs/database/proposed/2026-10-15-practice-ledger.sql';
const DOWN = 'docs/database/proposed/2026-10-15-practice-ledger.down.sql';
const U = { a: '00000000-0000-0000-0000-00000000000a', b: '00000000-0000-0000-0000-00000000000b' };

async function freshDb({ apply = true } = {}) {
  const db = new PGlite();
  await db.exec(read('docs/database/replica-test/replica.sql'));
  await db.exec(read('docs/database/2026-10-05-lock-scores-and-verify-employers.sql'));
  // As production: service_role exists; the project's default privileges give anon and authenticated everything on new public tables.
  await db.exec(`create role service_role nologin bypassrls;
    grant usage on schema public, auth to service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    grant all on all tables in schema public to service_role; grant execute on all functions in schema public to service_role;
    grant usage on schema public to anon, authenticated;
    alter table public.mock_sessions add column if not exists mode text, add column if not exists questions_count int;
    grant select, delete on public.mock_sessions to authenticated;`);
  for (const [k, id] of Object.entries(U)) await db.query('insert into auth.users values ($1,$2)', [id, `${k}@x.test`]);
  if (apply) await db.exec(read(FIX));
  return db;
}
async function as(db, role, uid, sql, params = []) {
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [uid ? JSON.stringify({ sub: uid, role }) : '{}']);
  try { return { rows: (await db.query(sql, params)).rows }; } catch (e) { return { error: e.message }; } finally { await db.exec('reset role'); }
}
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });
const q = async (db, sql, p = []) => (await db.query(sql, p)).rows;
const reserve = (db, user, key, hash = 'h', est = 100, session = null, feature = 'mock_evaluate') =>
  q(db, `select * from reserve_ai_request($1,$2,$3,$4,$5,$6)`, [user, key, hash, feature, session, est]).then((r) => r[0]);
const setPolicy = (db, limits, version = 1) => q(db, `insert into ai_policies (version, effective_from, limits) values ($1, now() - interval '1 minute', $2)`, [version, JSON.stringify(limits)]);
const win = async (db, uid) => (await q(db, `select requests, reserved_tokens::int rt, settled_tokens::int st from user_usage_windows where user_id=$1`, [uid]))[0];
let db, r;

// ── Before: nothing exists ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
db = await freshDb({ apply: false });
check('P0 before the SQL there is no ledger and no reserve function', (await q(db, `select count(*)::int n from pg_class where relname in ('ai_requests','practice_sessions','user_usage_windows','ai_policies','practice_submissions')`))[0].n === 0
  && (await q(db, `select count(*)::int n from pg_proc where proname='reserve_ai_request'`))[0].n === 0);

// ── Shape and privileges (B5) ───────────────────────────────────────────────────────────────────────────────────────────────────────────
db = await freshDb();
const tables = ['ai_policies', 'practice_sessions', 'practice_submissions', 'ai_requests', 'user_usage_windows'];
check('S1 all five tables exist with RLS on', (await q(db, `select count(*)::int n from pg_class where relname = any($1) and relrowsecurity`, [tables]))[0].n === 5);
check('S2 no column can hold an answer text, a prompt or a CV', (await q(db, `select count(*)::int n from information_schema.columns where table_schema='public' and table_name = any($1) and column_name ~* '(answer_text|answer$|prompt|resume|cv_|raw_reply|content)'`, [tables]))[0].n === 0);
const privs = await q(db, `select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) p from information_schema.role_table_grants where table_schema='public' and table_name = any($1) and grantee in ('anon','authenticated') group by 1,2 order by 1,2`, [tables]);
check('S3 anon has no privilege at all on the new tables', !privs.some((x) => x.grantee === 'anon'), JSON.stringify(privs));
check('S4 authenticated has only SELECT (and DELETE on sessions and submissions): no TRUNCATE, INSERT, UPDATE, TRIGGER, REFERENCES',
  privs.filter((x) => x.grantee === 'authenticated').every((x) => (['practice_sessions', 'practice_submissions'].includes(x.table_name) ? x.p === 'DELETE,SELECT' : x.p === 'SELECT')) && !privs.some((x) => x.table_name === 'ai_policies'), JSON.stringify(privs));
for (const fn of ['reserve_ai_request', 'settle_ai_request', 'mark_unknown', 'mark_started', 'expire_stale_requests', 'expire_unknown_requests', 'complete_practice_session']) {
  const a = await as(db, 'authenticated', U.a, `select has_function_privilege('authenticated', p.oid, 'execute') x from pg_proc p where p.proname='${fn}'`);
  const n = await as(db, 'anon', null, `select has_function_privilege('anon', p.oid, 'execute') x from pg_proc p where p.proname='${fn}'`);
  check(`S5 ${fn}: neither authenticated nor anon can execute it`, a.rows?.every((x) => x.x === false) && n.rows?.every((x) => x.x === false));
}
r = await as(db, 'authenticated', U.a, `truncate public.ai_requests`);
check('S6 authenticated cannot truncate the ledger', !!r.error, JSON.stringify(r));
r = await as(db, 'authenticated', U.a, `insert into practice_sessions (user_id, persona, questions) values ($1,'x','[]')`, [U.a]);
check('S7 authenticated cannot insert a session', !!r.error, JSON.stringify(r));
check('S8 authenticated cannot read ai_policies', !!(await as(db, 'authenticated', U.a, `select * from ai_policies`)).error);

// ── Limits are validated ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
for (const [name, lim] of [['negative', { max_concurrent: -1 }], ['unknown key', { max_apples: 3 }], ['text value', { max_concurrent: 'two' }], ['stale under 30 s', { stale_after_seconds: 5 }], ['not an object', [1]]]) {
  let err; try { await db.query(`insert into ai_policies (version, effective_from, limits) values (9, now(), $1::jsonb)`, [JSON.stringify(lim)]); } catch (e) { err = e.message; }
  check(`L1 limits rejected: ${name}`, !!err, err);
}

// ── Observe mode (D-2, B3) ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
db = await freshDb();
let x = await reserve(db, U.a, 'k1');
check('O1 with no policy row the gate records and says it is observing', x.outcome === 'reserved' && x.gate_mode === 'observe', JSON.stringify(x));
for (let i = 2; i <= 6; i++) await reserve(db, U.a, `k${i}`);
check('O2 in observe mode nothing is ever refused, and usage is still counted', (await win(db, U.a)).requests === 6 && (await win(db, U.a)).rt === 600);

// ── Enforce mode: the gate really blocks ────────────────────────────────────────────────────────────────────────────────────────────────
db = await freshDb();
await setPolicy(db, { max_concurrent: 2, max_requests_per_day: 5, max_tokens_per_day: 1000 });
const out = [];
for (let i = 1; i <= 4; i++) out.push(await reserve(db, U.a, `c${i}`, 'h', 100));
check('E1 enforce: the third concurrent request is refused for concurrency, nothing written for it', out[2].outcome === 'limit_reached' && out[2].reason === 'concurrency' && out[0].gate_mode === 'enforce'
  && (await q(db, `select count(*)::int n from ai_requests where user_id=$1`, [U.a]))[0].n === 2, JSON.stringify(out));
const k = await Promise.all(Array.from({ length: 6 }, (_, i) => reserve(db, U.b, `p${i}`, 'h', 10)));
check('E2 six parallel requests with room for two: exactly two are reserved, four refused (two "tabs" share one limit)', k.filter((z) => z.outcome === 'reserved').length === 2 && k.filter((z) => z.outcome === 'limit_reached').length === 4, JSON.stringify(k.map((z) => z.outcome)));
check('E3 the counters equal the reservations, not the attempts', (await win(db, U.b)).requests === 2 && (await win(db, U.b)).rt === 20);
db = await freshDb();
await setPolicy(db, { max_tokens_per_day: 250 });
await reserve(db, U.a, 't1', 'h', 100); await reserve(db, U.a, 't2', 'h', 100);
x = await reserve(db, U.a, 't3', 'h', 100);
check('E4 the daily token cap counts reserved plus settled tokens', x.outcome === 'limit_reached' && x.reason === 'tokens', JSON.stringify(x));
db = await freshDb();
await setPolicy(db, { max_session_tokens: 150 });
const sid = (await q(db, `insert into practice_sessions (user_id, persona, questions) values ($1,'startup','[]') returning id`, [U.a]))[0].id;
await reserve(db, U.a, 's1', 'h', 100, sid);
x = await reserve(db, U.a, 's2', 'h', 100, sid);
check('E5 the per-session token cap is enforced', x.outcome === 'limit_reached' && x.reason === 'session_tokens', JSON.stringify(x));

// ── Idempotency ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
db = await freshDb();
const first = await reserve(db, U.a, 'same', 'H1');
const again = await reserve(db, U.a, 'same', 'H1');
check('I1 the same key and the same payload returns the one row and reserves once', again.outcome === 'existing' && again.request_id === first.request_id && (await win(db, U.a)).requests === 1, JSON.stringify(again));
let err; try { await reserve(db, U.a, 'same', 'H2'); } catch (e) { err = e.message; }
check('I2 the same key with a different payload raises idempotency_conflict', /idempotency_conflict/.test(err || ''), err);

// ── Settlement and unknown outcomes ─────────────────────────────────────────────────────────────────────────────────────────────────────
db = await freshDb();
const a = await reserve(db, U.a, 'a1', 'h', 500);
await q(db, `select mark_started($1)`, [a.request_id]);
await q(db, `select settle_ai_request($1,'completed',100,150,50,'openai','gpt-6-luna')`, [a.request_id]);
check('T1 settling replaces the reservation by the reported usage (300)', (await win(db, U.a)).rt === 0 && (await win(db, U.a)).st === 300);
const again2 = await q(db, `select settle_ai_request($1,'completed',9999,9999,9999)`, [a.request_id]);
check('T2 settling twice is a no-op that returns the stored state', again2[0].settle_ai_request === 'completed' && (await win(db, U.a)).st === 300);
const b = await reserve(db, U.a, 'a2', 'h', 400);
await q(db, `select settle_ai_request($1,'completed')`, [b.request_id]);
check('T3 a completed request with no usage report keeps the reservation as its cost', (await win(db, U.a)).st === 700 && (await q(db, `select settled_basis from ai_requests where id=$1`, [b.request_id]))[0].settled_basis === 'reserved_upper_bound');
const c = await reserve(db, U.a, 'a3', 'h', 200);
await q(db, `select settle_ai_request($1,'failed')`, [c.request_id]);
check('T4 a request that failed with no usage costs nothing', (await win(db, U.a)).st === 700 && (await win(db, U.a)).rt === 0);

db = await freshDb();
await setPolicy(db, { max_concurrent: 1 });
const u1 = await reserve(db, U.a, 'u1', 'h', 300);
x = await reserve(db, U.a, 'u2', 'h', 300);
check('U1 while one request is active the next is refused', x.outcome === 'limit_reached');
await q(db, `select mark_unknown($1)`, [u1.request_id]);
x = await reserve(db, U.a, 'u3', 'h', 300);
check('U2 mark_unknown frees the slot but not the tokens', x.outcome === 'reserved' && (await win(db, U.a)).rt === 600);
await q(db, `update ai_requests set updated_at = now() - interval '2 hours' where id=$1`, [u1.request_id]);
await q(db, `select expire_unknown_requests(interval '1 hour')`);
const w = await win(db, U.a);
check('U3 expiring an old unknown request settles it at its reserved amount, so exposure never exceeds what was reserved', w.rt === 300 && w.st === 300, JSON.stringify(w));
await q(db, `select expire_unknown_requests(interval '1 hour')`);
check('U4 expiring again changes nothing', (await win(db, U.a)).st === 300);

// ── B1: a crashed request does not hold the slot for ever ───────────────────────────────────────────────────────────────────────────────
db = await freshDb();
await setPolicy(db, { max_concurrent: 1, stale_after_seconds: 60 });
const z = await reserve(db, U.a, 'z1', 'h', 100);
x = await reserve(db, U.a, 'z2', 'h', 100);
check('Z1 a request that never settled blocks the next one at first', x.outcome === 'limit_reached');
await q(db, `update ai_requests set updated_at = now() - interval '5 minutes' where id=$1`, [z.request_id]);
x = await reserve(db, U.a, 'z3', 'h', 100);
check('Z2 once it is stale the slot is freed (lazily, by the next request), and its tokens stay reserved', x.outcome === 'reserved'
  && (await q(db, `select state from ai_requests where id=$1`, [z.request_id]))[0].state === 'unknown_pending' && (await win(db, U.a)).rt === 200);
db = await freshDb();
const z4 = await reserve(db, U.a, 'q1');
await q(db, `update ai_requests set updated_at = now() - interval '10 minutes' where id=$1`, [z4.request_id]);
const swept = await q(db, `select expire_stale_requests(interval '5 minutes') n`);
check('Z3 the sweeper function does the same for every user', swept[0].n === 1);

// ── Sessions: one counted attempt per question, complete once, no zero for a missing score ──────────────────────────────────────────────
db = await freshDb();
const s = (await q(db, `insert into practice_sessions (user_id, persona, questions) values ($1,'startup','[1,2,3]') returning id`, [U.a]))[0].id;
const sub = (idx, rev, counted, status, score) => q(db, `insert into practice_submissions (session_id,user_id,question_index,question_hash,revision,is_counted,answer_hash,answer_chars,status,score) values ($1,$2,$3,'qh',$4,$5,'ah',50,$6,$7)`, [s, U.a, idx, rev, counted, status, score]);
await sub(0, 1, true, 'evaluated', 80);
let dup; try { await sub(0, 2, true, 'evaluated', 99); } catch (e) { dup = e.message; }
check('C1 the database refuses a second counted attempt for one question', /practice_one_counted|duplicate/.test(dup || ''), dup);
await sub(0, 2, false, 'evaluated', 99);
await sub(1, 1, true, 'evaluated', 60);
await sub(2, 1, true, 'failed', null);
const done = await Promise.all([q(db, `select complete_practice_session($1,$2) m`, [s, U.a]), q(db, `select complete_practice_session($1,$2) m`, [s, U.a])]);
const ms = await q(db, `select avg_score, questions_count, mode from mock_sessions where user_id=$1`, [U.a]);
check('C2 completing twice (also in parallel) creates one mock_sessions row, with the same id both times', ms.length === 1 && done[0][0].m === done[1][0].m, JSON.stringify(ms));
check('C3 the average counts only the counted, evaluated answers: (80+60)/2 = 70, never a 0 for the failed one, never the practice retry', ms[0].avg_score === 70 && ms[0].questions_count === 2 && ms[0].mode === 'startup', JSON.stringify(ms));
check('C4 the Trust Score trigger ran on the inserted session (interview_score 70)', (await q(db, `select interview_score from candidate_trust_profiles where user_id=$1`, [U.a]))[0]?.interview_score === 70);
const s2 = (await q(db, `insert into practice_sessions (user_id, persona, questions) values ($1,'startup','[1]') returning id`, [U.a]))[0].id;
err = undefined; try { await q(db, `select complete_practice_session($1,$2)`, [s2, U.a]); } catch (e) { err = e.message; }
check('C5 a session with nothing evaluated cannot be completed (no score of 0 is invented)', /nothing_to_complete/.test(err || ''), err);
err = undefined; try { await q(db, `select complete_practice_session($1,$2)`, [s2, U.b]); } catch (e) { err = e.message; }
check('C6 another user cannot complete my session', /unknown_session/.test(err || ''), err);

// ── Row level security ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
r = await as(db, 'authenticated', U.b, `select id from practice_sessions`);
check('R1 user B sees none of user A\'s sessions', (r.rows || []).length === 0, JSON.stringify(r));
r = await as(db, 'authenticated', U.a, `select id from practice_sessions`);
check('R2 user A sees their own sessions', (r.rows || []).length === 2);
r = await as(db, 'authenticated', U.b, `delete from practice_sessions where id=$1 returning id`, [s]);
check('R3 user B cannot delete user A\'s session', (r.rows || []).length === 0, JSON.stringify(r));
r = await as(db, 'anon', null, `select * from practice_sessions`);
check('R4 anon is refused', !!r.error, JSON.stringify(r));

// ── Deletion (D-5) ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
db = await freshDb();
const ds = (await q(db, `insert into practice_sessions (user_id, persona, questions) values ($1,'startup','[]') returning id`, [U.a]))[0].id;
await q(db, `insert into practice_submissions (session_id,user_id,question_index,question_hash,answer_hash,answer_chars,status) values ($1,$2,0,'q','a',10,'received')`, [ds, U.a]);
await reserve(db, U.a, 'd1', 'h', 50, ds);
r = await as(db, 'authenticated', U.a, `delete from practice_sessions where id=$1`, [ds]);
check('X1 deleting a session removes its submissions and keeps the ledger rows, without the session link', !r.error
  && (await q(db, `select count(*)::int n from practice_submissions`))[0].n === 0
  && (await q(db, `select count(*)::int n, count(session_id)::int linked from ai_requests`))[0].n === 1
  && (await q(db, `select count(session_id)::int linked from ai_requests`))[0].linked === 0, JSON.stringify(r));
const ds2 = (await q(db, `insert into practice_sessions (user_id, persona, questions) values ($1,'startup','[]') returning id`, [U.a]))[0].id;
await q(db, `insert into practice_submissions (session_id,user_id,question_index,question_hash,answer_hash,answer_chars,status) values ($1,$2,0,'q','a',10,'received')`, [ds2, U.a]);
await q(db, `delete from auth.users where id=$1`, [U.a]);
const left = await q(db, `select (select count(*)::int from practice_sessions where user_id=$1) s, (select count(*)::int from practice_submissions where user_id=$1) p, (select count(*)::int from ai_requests where user_id=$1) r, (select count(*)::int from user_usage_windows where user_id=$1) w`, [U.a]);
check('X2 deleting the account removes sessions, submissions, ledger rows and usage windows', left[0].s === 0 && left[0].p === 0 && left[0].r === 0 && left[0].w === 0, JSON.stringify(left));

// ── Indexes and rollback ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
db = await freshDb();
const idx = await q(db, `select indexdef from pg_indexes where tablename='ai_requests' and indexname='ai_requests_active'`);
check('N1 the partial index for counting active requests exists', /WHERE .*state.*reserved.*started/i.test(idx[0]?.indexdef || ''), JSON.stringify(idx));
await db.exec(read(DOWN));
check('D1 the down script removes every table and function it created', (await q(db, `select count(*)::int n from pg_class where relname = any($1)`, [tables]))[0].n === 0
  && (await q(db, `select count(*)::int n from pg_proc where proname in ('reserve_ai_request','settle_ai_request','complete_practice_session','ai_policy_limits_valid')`))[0].n === 0);
check('D2 mock_sessions and its data are untouched by the down script', (await q(db, `select count(*)::int n from pg_class where relname='mock_sessions'`))[0].n === 1);
const again3 = await db.exec(read(FIX)).then(() => true).catch(() => false);
check('D3 the up script applies again after the down script', again3);

for (const t of results) console.log(`${t.ok ? 'PASS' : 'FAIL'}  ${t.name}`);
const bad = results.filter((t) => !t.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
for (const t of bad) console.log('  ', t.name, t.detail);
process.exit(bad.length ? 1 : 0);
