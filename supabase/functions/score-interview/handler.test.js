// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { handleRequest, LIMITS } from './handler.js';
import { createRateLimiter } from '../ai/handler.js';

const ENV = {
  SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
  ANTHROPIC_API_KEY: 'sk-ant-SECRET', AI_PROVIDER: 'anthropic',
};
const Q = 'Tell me about a time you led a project under pressure.';
const A = 'I led a migration of our checkout flow, split the work into phases and kept stakeholders updated weekly.';
const feedbackFor = (score) => ({ score, worked: 'Clear structure', missed: 'No numbers', tip: 'Quantify the outcome', betterAnswerOutline: ['a', 'b', 'c'] });
const ok = (b, s = 200, h = {}) => new Response(JSON.stringify(b), { status: s, headers: h });

function makeFetch({ user = { id: 'user-1' }, score = 70, count = 0, insertStatus = 200 } = {}) {
  const inserts = [];
  const fn = vi.fn(async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) return ok(user);
    if (u.includes('anthropic')) return ok({ content: [{ type: 'text', text: JSON.stringify(feedbackFor(score)) }], stop_reason: 'end_turn' });
    if (u.includes('/rest/v1/mock_sessions')) {
      if (init.method === 'POST') { inserts.push(JSON.parse(init.body)); return ok([{ id: 'row-1' }], insertStatus); }
      return ok([], 206, { 'content-range': `0-0/${count}` });
    }
    throw new Error('unexpected fetch ' + u);
  });
  fn.inserts = inserts;
  return fn;
}

const call = (body, { fetchImpl = makeFetch(), now = () => 1_000_000, limiter = createRateLimiter() } = {}) =>
  handleRequest(new Request('https://proj.supabase.co/functions/v1/score-interview', {
    method: 'POST', headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' }, body: JSON.stringify(body),
  }), { env: ENV, fetchImpl, now, limiter });

// One graded answer, as the browser would hold it.
async function graded(score, q = Q, opts = {}) {
  const res = await call({ action: 'evaluate', personaId: 'startup', question: q, answer: A }, { fetchImpl: makeFetch({ score, ...opts }) });
  const data = await res.json();
  return { question: q, answer: A, score: data.feedback.score, ts: data.receipt.ts, sig: data.receipt.sig };
}
const saveBody = (items, patch = {}) => ({ action: 'save', personaId: 'startup', items, ...patch });

describe('score-interview: evaluate', () => {
  it('rejects a caller who is not signed in', async () => {
    const f = vi.fn(async () => ok({}, 401));
    expect((await handleRequest(new Request('https://x/', { method: 'POST', body: '{}' }), { env: ENV, fetchImpl: f })).status).toBe(401);
  });
  it('returns feedback and a receipt, and saves nothing', async () => {
    const fetchImpl = makeFetch({ score: 72 });
    const res = await call({ action: 'evaluate', personaId: 'startup', question: Q, answer: A }, { fetchImpl });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.feedback.score).toBe(72);
    expect(data.receipt.sig).toMatch(/^[0-9a-f]{64}$/);
    expect(fetchImpl.inserts).toHaveLength(0);
  });
  it('rejects a short answer, an unknown style and an unknown action', async () => {
    expect((await call({ action: 'evaluate', personaId: 'startup', question: Q, answer: 'ok' })).status).toBe(400);
    expect((await call({ action: 'evaluate', personaId: 'nope', question: Q, answer: A })).status).toBe(400);
    expect((await call({ action: 'nope' })).status).toBe(400);
  });
});

describe('score-interview: save', () => {
  it('stores the average the SERVER computed from the signed scores', async () => {
    const items = [await graded(60, 'Q one: tell me about leadership.'), await graded(80, 'Q two: tell me about conflict.')];
    const fetchImpl = makeFetch();
    const res = await call(saveBody(items), { fetchImpl });
    expect(res.status).toBe(200);
    expect(fetchImpl.inserts[0]).toEqual({ user_id: 'user-1', mode: 'startup', questions_count: 2, avg_score: 70 });
    expect(await res.json()).toMatchObject({ saved: true, avgScore: 70, questionsCount: 2 });
  });
  it('ignores an average sent by the browser', async () => {
    const fetchImpl = makeFetch();
    await call(saveBody([await graded(50)], { avgScore: 100, avg_score: 100 }), { fetchImpl });
    expect(fetchImpl.inserts[0].avg_score).toBe(50);
  });
  it('refuses a forged answer score (F-1)', async () => {
    const it = await graded(40);
    const fetchImpl = makeFetch();
    expect((await call(saveBody([{ ...it, score: 100 }]), { fetchImpl })).status).toBe(403);
    expect(fetchImpl.inserts).toHaveLength(0);
  });
  it('refuses a changed answer, a made-up item and another user\'s receipt', async () => {
    const it = await graded(80);
    expect((await call(saveBody([{ ...it, answer: it.answer + ' I also doubled revenue overnight for everyone.' }]))).status).toBe(403);
    expect((await call(saveBody([{ ...it, sig: 'a'.repeat(64) }]))).status).toBe(403);
    const theirs = await graded(80, Q, { user: { id: 'user-2' } });
    expect((await call(saveBody([theirs]))).status).toBe(403);
  });
  it('refuses a different interview style than the one graded', async () => {
    expect((await call(saveBody([await graded(80)], { personaId: 'technical' }))).status).toBe(403);
  });
  it('refuses the same graded answer counted twice, too many items and an empty list', async () => {
    const it = await graded(80);
    expect((await call(saveBody([it, it]))).status).toBe(400);
    expect((await call(saveBody(Array(LIMITS.maxItems + 1).fill(it)))).status).toBe(400);
    expect((await call(saveBody([]))).status).toBe(400);
  });
  it('refuses an expired receipt', async () => {
    const it = await graded(80);
    expect((await call(saveBody([it]), { now: () => 1_000_000 + LIMITS.receiptTtlMs + 1 })).status).toBe(409);
  });
  it('stops at the daily limit', async () => {
    const fetchImpl = makeFetch({ count: LIMITS.dailySessions });
    expect((await call(saveBody([await graded(80)]), { fetchImpl })).status).toBe(429);
    expect(fetchImpl.inserts).toHaveLength(0);
  });
  it('reports a failed insert without leaking details', async () => {
    const res = await call(saveBody([await graded(80)]), { fetchImpl: makeFetch({ insertStatus: 500 }) });
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain('service-secret');
  });
});
