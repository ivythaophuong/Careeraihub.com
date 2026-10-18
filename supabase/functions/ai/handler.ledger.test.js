// @vitest-environment node
// The ai function with the usage ledger (docs/database/proposed/PROPOSAL-practice-session-ledger-REV2-2026-10-15.md).
// Owner decision D-7: when the ledger itself fails the request goes through (fail-open), and the failure is logged.
import { describe, it, expect, vi } from 'vitest';
import { handleRequest, createRateLimiter } from './handler.js';

const BASE_ENV = { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'svc', OPENAI_API_KEY: 'sk-SECRET', AI_PROVIDER: 'openai' };
const ENV_ON = { ...BASE_ENV, AI_LEDGER: 'on' };
const ok = (b, s = 200) => new Response(JSON.stringify(b), { status: s });
const OPENAI_OK = () => ok({ choices: [{ message: { content: 'hello' }, finish_reason: 'stop' }], usage: { prompt_tokens: 11, completion_tokens: 22, completion_tokens_details: { reasoning_tokens: 3 } } });

const makeFetch = (provider = OPENAI_OK) => vi.fn(async (url, init) => (String(url).includes('/auth/v1/user') ? ok({ id: 'user-1' }) : provider(url, init)));
const fakeLedger = (over = {}) => ({
  reserve: vi.fn(async () => ({ outcome: 'reserved', requestId: 'req-1', gateMode: 'observe', reason: null })),
  settle: vi.fn(async () => undefined),
  markUnknown: vi.fn(async () => undefined),
  ...over,
});
const call = async ({ env = ENV_ON, ledger, fetchImpl = makeFetch(), body = { messages: [{ role: 'user', content: 'hi' }], maxTokens: 100, feature: 'ats_parse' }, events = [] } = {}) => {
  const r = await handleRequest(new Request('https://proj.supabase.co/functions/v1/ai', { method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    { env, fetchImpl, limiter: createRateLimiter(), ledger, recordUsage: (e) => events.push(e) });
  return { status: r.status, body: await r.json(), events, fetchImpl };
};

describe('the ledger is off by default', () => {
  it('does not touch the ledger and answers exactly as before when AI_LEDGER is not on', async () => {
    const ledger = fakeLedger();
    const r = await call({ env: BASE_ENV, ledger });
    expect(r.status).toBe(200); expect(r.body.text).toBe('hello');
    expect(ledger.reserve).not.toHaveBeenCalled(); expect(ledger.settle).not.toHaveBeenCalled();
  });
});

describe('with the ledger on', () => {
  it('reserves before the provider call and settles with the reported usage after it', async () => {
    const ledger = fakeLedger();
    const r = await call({ ledger });
    expect(r.status).toBe(200);
    expect(ledger.reserve).toHaveBeenCalledTimes(1);
    const arg = ledger.reserve.mock.calls[0][0];
    expect(arg).toMatchObject({ userId: 'user-1', feature: 'ats_parse' });
    expect(arg.estTokens).toBeGreaterThan(100);
    expect(arg.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(arg)).not.toContain('hi"'); // no content in what reaches the ledger
    expect(ledger.settle).toHaveBeenCalledWith(expect.objectContaining({ id: 'req-1', state: 'completed', usage: expect.objectContaining({ input: 11, output: 22, thinking: 3 }), provider: 'openai' }));
  });

  it('refuses with 429 when the gate says the limit is reached, and never calls the provider', async () => {
    const ledger = fakeLedger({ reserve: vi.fn(async () => ({ outcome: 'limit_reached', requestId: null, gateMode: 'enforce', reason: 'tokens' })) });
    const fetchImpl = makeFetch();
    const r = await call({ ledger, fetchImpl });
    expect(r.status).toBe(429);
    expect(r.body.error.message).toMatch(/limit/i);
    expect(fetchImpl.mock.calls.some(([u]) => String(u).includes('openai'))).toBe(false);
    expect(ledger.settle).not.toHaveBeenCalled();
  });

  it('D-7: if the ledger fails, the request goes through and the failure is logged without any content', async () => {
    const ledger = fakeLedger({ reserve: vi.fn(async () => ({ outcome: 'gate_error' })) });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await call({ ledger });
    expect(r.status).toBe(200); expect(r.body.text).toBe('hello');
    expect(ledger.settle).not.toHaveBeenCalled();
    const logged = err.mock.calls.flat().join(' ');
    expect(logged).toMatch(/gate_error/); expect(logged).not.toContain('hi'); expect(logged).not.toContain('SECRET');
    err.mockRestore();
  });

  it('a ledger that throws on reserve still lets the request through', async () => {
    const ledger = fakeLedger({ reserve: vi.fn(async () => { throw new Error('boom'); }) });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await call({ ledger })).status).toBe(200);
  });

  it('a failing settle never breaks the answer', async () => {
    const ledger = fakeLedger({ settle: vi.fn(async () => { throw new Error('boom'); }) });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await call({ ledger });
    expect(r.status).toBe(200); expect(r.body.text).toBe('hello');
  });

  it('settles as failed when the provider answered with an error status', async () => {
    const ledger = fakeLedger();
    const r = await call({ ledger, fetchImpl: makeFetch(() => ok({ error: { message: 'bad' } }, 400)) });
    expect(r.status).toBe(400);
    expect(ledger.settle).toHaveBeenCalledWith(expect.objectContaining({ id: 'req-1', state: 'failed' }));
    expect(ledger.markUnknown).not.toHaveBeenCalled();
  });

  it('marks the request unknown, not failed, when the outcome cannot be known (no status: timeout or network)', async () => {
    const ledger = fakeLedger();
    vi.spyOn(console, 'error').mockImplementation(() => {}); vi.spyOn(console, 'log').mockImplementation(() => {});
    const r = await call({ ledger, fetchImpl: makeFetch(() => { throw new Error('network down'); }) });
    expect(r.status).toBeGreaterThanOrEqual(500);
    expect(ledger.markUnknown).toHaveBeenCalledWith('req-1');
    expect(ledger.settle).not.toHaveBeenCalled();
  });

  it('settles as completed (the reservation stands as the cost) when the provider answered but the output was cut off', async () => {
    const ledger = fakeLedger();
    const cut = () => ok({ choices: [{ message: { content: 'par' }, finish_reason: 'length' }], usage: { prompt_tokens: 5, completion_tokens: 100 } });
    const r = await call({ ledger, fetchImpl: makeFetch(cut) });
    expect(r.status).toBe(422);
    expect(ledger.settle).toHaveBeenCalledWith({ id: 'req-1', state: 'completed' });
    expect(ledger.markUnknown).not.toHaveBeenCalled();
  });

  it('writes the gate mode in the usage log line', async () => {
    const ledger = fakeLedger({ reserve: vi.fn(async () => ({ outcome: 'reserved', requestId: 'req-1', gateMode: 'enforce', reason: null })) });
    const r = await call({ ledger });
    expect(r.events.find((e) => e.outcome === 'success')?.gate_mode).toBe('enforce');
  });

  it('uses the request correlation id as the idempotency key, so a retry of the same request is the same row', async () => {
    const ledger = fakeLedger();
    const r = await call({ ledger });
    expect(ledger.reserve.mock.calls[0][0].key).toBe(r.events[0].correlation_id);
  });
});
