// S5b contract check (not a production test): the JS ledger client against the real ledger SQL (in-memory Postgres). Proves argument names and reply shapes match.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
const REPO = process.env.REPO || path.resolve(process.cwd(), '../../..');
const { makeLedger } = await import('file://' + path.join(REPO, 'supabase/functions/_shared/ledger.js'));
const R = REPO + '/';
const db = new PGlite();
await db.exec(fs.readFileSync(R + 'docs/database/replica-test/replica.sql', 'utf8'));
await db.exec(fs.readFileSync(R + 'docs/database/2026-10-05-lock-scores-and-verify-employers.sql', 'utf8'));
await db.exec(`create role service_role nologin bypassrls; grant usage on schema public, auth to service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  grant all on all tables in schema public to service_role; grant execute on all functions in schema public to service_role;
  alter table public.mock_sessions add column if not exists mode text, add column if not exists questions_count int;`);
const U = '00000000-0000-0000-0000-00000000000a';
await db.query('insert into auth.users values ($1,$2)', [U, 'a@x.test']);
await db.exec(fs.readFileSync(R + 'docs/database/proposed/2026-10-15-practice-ledger.sql', 'utf8'));
const calls = [];
//   npm i @electric-sql/pglite ; cp this file next to node_modules ; REPO=/path/to/repo node s5b-ledger-client-contract.mjs
// The fetch below only imitates PostgREST (named arguments, service role, JSON reply). The real PostgREST is NOT covered (UNKNOWN).
// Behaves like PostgREST: POST /rest/v1/rpc/<fn> with named arguments, the service role, a JSON reply.
const fetchImpl = async (url, init) => {
  const fn = String(url).split('/rpc/')[1]; const args = JSON.parse(init.body); calls.push(fn);
  if (init.headers.Authorization !== 'Bearer svc') return new Response('no', { status: 401 });
  await db.exec('set role service_role');
  try {
    const names = Object.keys(args); const sql = `select * from public.${fn}(${names.map((n, i) => `${n} := $${i + 1}`).join(', ')})`;
    const rows = (await db.query(sql, names.map((n) => args[n]))).rows;
    const out = fn === 'reserve_ai_request' ? rows : null;
    return new Response(JSON.stringify(out), { status: 200 });
  } catch (e) { return new Response(JSON.stringify({ message: e.message }), { status: 400 }); }
  finally { await db.exec('reset role'); }
};
const led = makeLedger({ env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc' }, fetchImpl });
const ok = []; const check = (n, v) => ok.push([n, !!v]);
let r = await led.reserve({ userId: U, key: 'k1', hash: 'h', feature: 'ats_parse', estTokens: 500 });
check('reserve with no policy: reserved, observe', r.outcome === 'reserved' && r.gateMode === 'observe' && r.requestId);
await led.settle({ id: r.requestId, state: 'completed', usage: { input: 100, output: 200, thinking: 50 }, provider: 'openai', model: 'gpt-6-luna' });
let row = (await db.query('select state, settled_tokens, provider, model, settled_basis from ai_requests')).rows[0];
check('settle wrote 350 tokens from the reported usage', row.state === 'completed' && row.settled_tokens === 350 && row.provider === 'openai' && row.settled_basis === 'reported');
let w = (await db.query('select requests, reserved_tokens::int rt, settled_tokens::int st from user_usage_windows')).rows[0];
check('usage window: 1 request, reservation released, 350 settled', w.requests === 1 && w.rt === 0 && w.st === 350);
const again = await led.reserve({ userId: U, key: 'k1', hash: 'h', feature: 'ats_parse', estTokens: 500 });
check('same key and payload: existing, same row', again.outcome === 'existing' && again.requestId === r.requestId);
await db.query(`insert into ai_policies (version, effective_from, limits) values (1, now() - interval '1 minute', '{"max_concurrent":1}')`);
const a = await led.reserve({ userId: U, key: 'k2', hash: 'h2', feature: 'x', estTokens: 10 });
const b = await led.reserve({ userId: U, key: 'k3', hash: 'h3', feature: 'x', estTokens: 10 });
check('with a policy: first reserved in enforce mode, second refused for concurrency', a.outcome === 'reserved' && a.gateMode === 'enforce' && b.outcome === 'limit_reached' && b.reason === 'concurrency');
await led.markUnknown(a.requestId);
check('mark_unknown frees the slot', (await led.reserve({ userId: U, key: 'k4', hash: 'h4', feature: 'x', estTokens: 10 })).outcome === 'reserved');
const bad = await makeLedger({ env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'wrong' }, fetchImpl }).reserve({ userId: U, key: 'k5', hash: 'h', feature: 'x', estTokens: 1 });
check('a wrong service key is a gate_error (fail-open), not an exception', bad.outcome === 'gate_error');
for (const [n, v] of ok) console.log(`${v ? 'PASS' : 'FAIL'}  ${n}`);
console.log(`${ok.filter(([, v]) => v).length}/${ok.length} passed; rpc calls: ${calls.join(',')}`);
process.exit(ok.every(([, v]) => v) ? 0 : 1);
