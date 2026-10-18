// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { handleRequest } from './handler.js';
import { createRateLimiter } from '../ai/handler.js';

const ENV = { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'svc', ANTHROPIC_API_KEY: 'sk-ant-SECRET', AI_PROVIDER: 'anthropic' };
const Q = 'Tell me about a time you led a project under pressure.';
const A = 'I led a migration of our checkout flow, split the work into phases and kept stakeholders updated weekly.';
const ok = (b, s = 200) => new Response(JSON.stringify(b), { status: s });
const fb = { score: 70, worked: 'Clear', missed: 'No numbers', tip: 'Quantify', betterAnswerOutline: ['a', 'b', 'c'] };
const makeFetch = (provider) => vi.fn(async (url) => {
  const u = String(url);
  if (u.includes('/auth/v1/user')) return ok({ id: 'user-1' });
  if (u.includes('anthropic')) return provider ? provider() : ok({ content: [{ type: 'text', text: JSON.stringify(fb) }], stop_reason: 'end_turn', usage: { input_tokens: 50, output_tokens: 80 } });
  throw new Error('unexpected fetch ' + u);
});
const fakeLedger = (over = {}) => ({ reserve: vi.fn(async () => ({ outcome: 'reserved', requestId: 'req-1', gateMode: 'observe', reason: null })), settle: vi.fn(async () => undefined), markUnknown: vi.fn(async () => undefined), ...over });
const evaluate = (env, ledger, fetchImpl = makeFetch()) => handleRequest(new Request('https://proj.supabase.co/functions/v1/score-interview', {
  method: 'POST', headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'evaluate', personaId: 'startup', question: Q, answer: A }),
}), { env, fetchImpl, now: () => 1_000_000, limiter: createRateLimiter(), ledger }).then(async (r) => ({ status: r.status, body: await r.json() }));

describe('score-interview with the usage ledger', () => {
  it('does not touch the ledger when it is off', async () => {
    const ledger = fakeLedger(); const r = await evaluate(ENV, ledger);
    expect(r.status).toBe(200); expect(ledger.reserve).not.toHaveBeenCalled();
  });
  it('reserves under its own feature name, then settles with the reported usage', async () => {
    const ledger = fakeLedger(); const r = await evaluate({ ...ENV, AI_LEDGER: 'on' }, ledger);
    expect(r.status).toBe(200); expect(r.body.receipt).toBeTruthy();
    expect(ledger.reserve).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', feature: 'score_interview_evaluate' }));
    expect(JSON.stringify(ledger.reserve.mock.calls[0][0])).not.toContain('checkout');
    expect(ledger.settle).toHaveBeenCalledWith(expect.objectContaining({ id: 'req-1', state: 'completed' }));
  });
  it('answers 429 with a plain message when the gate refuses, and never calls the provider', async () => {
    const ledger = fakeLedger({ reserve: vi.fn(async () => ({ outcome: 'limit_reached', requestId: null, gateMode: 'enforce', reason: 'requests' })) });
    const f = makeFetch(); const r = await evaluate({ ...ENV, AI_LEDGER: 'on' }, ledger, f);
    expect(r.status).toBe(429); expect(r.body.error.message).toMatch(/limit/i);
    expect(f.mock.calls.some(([u]) => String(u).includes('anthropic'))).toBe(false);
  });
  it('D-7: a failing ledger lets the evaluation through', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await evaluate({ ...ENV, AI_LEDGER: 'on' }, fakeLedger({ reserve: vi.fn(async () => ({ outcome: 'gate_error' })) }));
    expect(r.status).toBe(200);
  });
});
