// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { handleRequest } from './handler.js';
import { createRateLimiter } from '../ai/handler.js';
import { SECTIONS } from '../_shared/starScoring.js';

const ENV = { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'svc', ANTHROPIC_API_KEY: 'sk-ant-SECRET', AI_PROVIDER: 'anthropic' };
const ok = (b, s = 200) => new Response(JSON.stringify(b), { status: s });
const SECTION = 'I led the checkout migration for our payments team and split the work into three phases over two months.';
const story = Object.fromEntries(SECTIONS.map((k) => [k, SECTION]));
const RESULT = { scores: { situation: 70, task: 70, action: 70, result: 70 }, refined: story, oneLiner: 'Led a migration.', feedback: {} };
const makeFetch = () => vi.fn(async (url) => {
  const u = String(url);
  if (u.includes('/auth/v1/user')) return ok({ id: 'user-1' });
  if (u.includes('anthropic')) return ok({ content: [{ type: 'text', text: JSON.stringify(RESULT) }], stop_reason: 'end_turn', usage: { input_tokens: 60, output_tokens: 90 } });
  throw new Error('unexpected fetch ' + u);
});
const fakeLedger = (over = {}) => ({ reserve: vi.fn(async () => ({ outcome: 'reserved', requestId: 'req-1', gateMode: 'observe', reason: null })), settle: vi.fn(async () => undefined), markUnknown: vi.fn(async () => undefined), ...over });
const review = (env, ledger, fetchImpl = makeFetch()) => handleRequest(new Request('https://proj.supabase.co/functions/v1/score-star', {
  method: 'POST', headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'review', story }),
}), { env, fetchImpl, now: () => 1_000_000, limiter: createRateLimiter(), ledger }).then(async (r) => ({ status: r.status, body: await r.json() }));

describe('score-star with the usage ledger', () => {
  it('does not touch the ledger when it is off', async () => {
    const ledger = fakeLedger(); await review(ENV, ledger);
    expect(ledger.reserve).not.toHaveBeenCalled();
  });
  it('reserves under its own feature name and settles afterwards', async () => {
    const ledger = fakeLedger(); await review({ ...ENV, AI_LEDGER: 'on' }, ledger);
    expect(ledger.reserve).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', feature: 'score_star_review' }));
    expect(JSON.stringify(ledger.reserve.mock.calls[0][0])).not.toContain('checkout');
    expect(ledger.settle).toHaveBeenCalledWith(expect.objectContaining({ id: 'req-1', state: 'completed' }));
  });
  it('answers 429 when the gate refuses and never calls the provider', async () => {
    const ledger = fakeLedger({ reserve: vi.fn(async () => ({ outcome: 'limit_reached', requestId: null, gateMode: 'enforce', reason: 'tokens' })) });
    const f = makeFetch(); const r = await review({ ...ENV, AI_LEDGER: 'on' }, ledger, f);
    expect(r.status).toBe(429);
    expect(f.mock.calls.some(([u]) => String(u).includes('anthropic'))).toBe(false);
  });
  it('D-7: a failing ledger lets the review through', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await review({ ...ENV, AI_LEDGER: 'on' }, fakeLedger({ reserve: vi.fn(async () => ({ outcome: 'gate_error' })) }));
    expect(r.status).toBe(200);
  });
});
