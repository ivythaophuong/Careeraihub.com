// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { handleRequest, LIMITS } from './handler.js';
import { createRateLimiter } from '../ai/handler.js';

const ENV = {
  SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
  ANTHROPIC_API_KEY: 'sk-ant-SECRET', AI_PROVIDER: 'anthropic',
};
const STORY = {
  situation: 'Our checkout page was slow during sales.', task: 'I owned fixing the page load time.',
  action: 'I profiled the page, removed two blocking scripts and added caching.', result: 'The page felt much faster and complaints stopped.',
};
const MODEL = {
  scores: { situation: 60, task: 70, action: 80, result: 50 },
  refined: { situation: 'S refined', task: 'T refined', action: 'A refined', result: 'R refined' },
  oneLiner: 'Fixed a slow checkout page', feedback: ['a', 'b', 'c'], missingDetails: [], competencies: ['ownership'],
};
const EXPECTED = Math.round(60 * 0.15 + 70 * 0.15 + 80 * 0.4 + 50 * 0.3); // 66

const ok = (b, s = 200, h = {}) => new Response(JSON.stringify(b), { status: s, headers: h });

function makeFetch({ user = { id: 'user-1' }, existing = [], count = 0, model = MODEL, insertStatus = 200 } = {}) {
  const inserts = [];
  const fn = vi.fn(async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) return ok(user);
    if (u.includes('anthropic')) return ok({ content: [{ type: 'text', text: JSON.stringify(model) }], stop_reason: 'end_turn' });
    if (u.includes('/rest/v1/star_stories')) {
      if (init.method === 'POST') { inserts.push(JSON.parse(init.body)); return ok([{ id: 'row-1' }], insertStatus); }
      if (u.includes('one_liner=')) return ok(existing);
      return ok([], 206, { 'content-range': `0-0/${count}` });
    }
    throw new Error('unexpected fetch ' + u);
  });
  fn.inserts = inserts;
  return fn;
}

const call = (body, { fetchImpl = makeFetch(), now = () => 1_000_000, limiter = createRateLimiter() } = {}) =>
  handleRequest(new Request('https://proj.supabase.co/functions/v1/score-star', {
    method: 'POST', headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' }, body: JSON.stringify(body),
  }), { env: ENV, fetchImpl, now, limiter });

async function reviewed(opts) {
  const res = await call({ action: 'review', story: STORY }, opts);
  return { res, data: await res.clone().json() };
}

describe('score-star: review', () => {
  it('rejects a caller who is not signed in', async () => {
    const f = vi.fn(async () => ok({}, 401));
    const res = await handleRequest(new Request('https://x/', { method: 'POST', body: '{}' }), { env: ENV, fetchImpl: f });
    expect(res.status).toBe(401);
  });
  it('returns the server-computed score, a receipt and saves nothing', async () => {
    const fetchImpl = makeFetch();
    const { res, data } = await reviewed({ fetchImpl });
    expect(res.status).toBe(200);
    expect(data.result.score).toBe(EXPECTED);
    expect(data.receipt.sig).toMatch(/^[0-9a-f]{64}$/);
    expect(fetchImpl.inserts).toHaveLength(0);
  });
  it('rejects a section that is too short', async () => {
    const res = await call({ action: 'review', story: { ...STORY, task: 'short' } });
    expect(res.status).toBe(400);
  });
  it('rejects an unknown action', async () => {
    expect((await call({ action: 'nope' })).status).toBe(400);
  });
});

describe('score-star: save', () => {
  const saveBody = (data, patch = {}) => ({ action: 'save', story: STORY, result: data.result, receipt: data.receipt, ...patch });

  it('stores the score the SERVER computed, with the signed sections', async () => {
    const { data } = await reviewed();
    const fetchImpl = makeFetch();
    const res = await call(saveBody(data), { fetchImpl });
    expect(res.status).toBe(200);
    expect(fetchImpl.inserts).toHaveLength(1);
    expect(fetchImpl.inserts[0]).toMatchObject({ user_id: 'user-1', score: EXPECTED, one_liner: MODEL.oneLiner, ...STORY });
    expect((await res.json()).score).toBe(EXPECTED);
  });
  it('ignores a forged overall score sent by the browser', async () => {
    const { data } = await reviewed();
    const fetchImpl = makeFetch();
    await call(saveBody({ ...data, result: { ...data.result, score: 100 } }), { fetchImpl });
    expect(fetchImpl.inserts[0].score).toBe(EXPECTED);
  });
  it('refuses a forged section score (F-1)', async () => {
    const { data } = await reviewed();
    const forged = { ...data.result, scores: { ...data.result.scores, action: 100 } };
    const fetchImpl = makeFetch();
    const res = await call(saveBody({ ...data, result: forged }), { fetchImpl });
    expect(res.status).toBe(403);
    expect(fetchImpl.inserts).toHaveLength(0);
  });
  it('refuses a rewritten story or rewrite text', async () => {
    const { data } = await reviewed();
    expect((await call(saveBody(data, { story: { ...STORY, result: 'I increased revenue by 500 percent overnight.' } }))).status).toBe(403);
    expect((await call(saveBody({ ...data, result: { ...data.result, oneLiner: 'Changed' } }))).status).toBe(403);
  });
  it('refuses a receipt made for another user', async () => {
    const { data } = await reviewed({ fetchImpl: makeFetch({ user: { id: 'user-2' } }) });
    expect((await call(saveBody(data))).status).toBe(403);
  });
  it('refuses a made-up receipt', async () => {
    const { data } = await reviewed();
    expect((await call(saveBody({ ...data, receipt: { ts: data.receipt.ts, sig: 'a'.repeat(64) } }))).status).toBe(403);
    expect((await call({ action: 'save', story: STORY, result: data.result })).status).toBe(400);
  });
  it('refuses an expired receipt', async () => {
    const { data } = await reviewed();
    const res = await call(saveBody(data), { now: () => 1_000_000 + LIMITS.receiptTtlMs + 1 });
    expect(res.status).toBe(409);
  });
  it('does not add a second copy of the same story', async () => {
    const { data } = await reviewed();
    const fetchImpl = makeFetch({ existing: [{ id: 'old', score: EXPECTED }] });
    const res = await call(saveBody(data), { fetchImpl });
    expect((await res.json()).duplicate).toBe(true);
    expect(fetchImpl.inserts).toHaveLength(0);
  });
  it('stops at the daily limit', async () => {
    const { data } = await reviewed();
    const fetchImpl = makeFetch({ count: LIMITS.dailySaves });
    expect((await call(saveBody(data), { fetchImpl })).status).toBe(429);
    expect(fetchImpl.inserts).toHaveLength(0);
  });
  it('reports a failed insert without leaking details', async () => {
    const { data } = await reviewed();
    const res = await call(saveBody(data), { fetchImpl: makeFetch({ insertStatus: 500 }) });
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain('service-secret');
  });
});
