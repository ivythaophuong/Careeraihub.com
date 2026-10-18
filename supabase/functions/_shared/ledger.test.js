// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { ledgerEnabled, estimateTokens, payloadHash, makeLedger, GATE_TIMEOUT_MS } from './ledger.js';

const ENV = { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-secret', AI_LEDGER: 'on' };
const ok = (body) => new Response(JSON.stringify(body), { status: 200 });

describe('ledgerEnabled', () => {
  it('is off unless AI_LEDGER is "on" and a service key and URL exist', () => {
    expect(ledgerEnabled({})).toBe(false);
    expect(ledgerEnabled({ ...ENV, AI_LEDGER: 'off' })).toBe(false);
    expect(ledgerEnabled({ ...ENV, SUPABASE_SERVICE_ROLE_KEY: '' })).toBe(false);
    expect(ledgerEnabled({ ...ENV, SUPABASE_URL: '' })).toBe(false);
    expect(ledgerEnabled(ENV)).toBe(true);
    expect(ledgerEnabled({ ...ENV, AI_LEDGER: 'ON' })).toBe(true);
  });
});

describe('estimateTokens', () => {
  it('is the prompt (about 4 characters a token) plus the output ceiling, and never negative or fractional', () => {
    expect(estimateTokens({ messages: [{ role: 'user', content: 'x'.repeat(400) }], maxTokens: 1000, pdfBase64: null })).toBe(1100);
    expect(Number.isInteger(estimateTokens({ messages: [{ role: 'user', content: 'abc' }], maxTokens: 10 }))).toBe(true);
  });
  it('adds a fixed allowance for an attached PDF, because its size in tokens is not known', () => {
    const a = estimateTokens({ messages: [{ role: 'user', content: 'x' }], maxTokens: 100, pdfBase64: null });
    const b = estimateTokens({ messages: [{ role: 'user', content: 'x' }], maxTokens: 100, pdfBase64: 'AAAA' });
    expect(b).toBeGreaterThan(a);
  });
});

describe('payloadHash', () => {
  it('is a stable hash that does not contain the content', async () => {
    const m = [{ role: 'user', content: 'my secret resume text' }];
    const h1 = await payloadHash(m, 100, false); const h2 = await payloadHash(m, 100, false);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).not.toContain('secret');
    expect(await payloadHash(m, 101, false)).not.toBe(h1);
  });
});

describe('makeLedger', () => {
  it('reserve calls the reserve_ai_request function with the service key and maps the first row', async () => {
    const f = vi.fn(async () => ok([{ outcome: 'reserved', request_id: 'r-1', gate_mode: 'observe', reason: null }]));
    const r = await makeLedger({ env: ENV, fetchImpl: f }).reserve({ userId: 'u1', key: 'k1', hash: 'h', feature: 'ats_parse', estTokens: 500 });
    expect(r).toEqual({ outcome: 'reserved', requestId: 'r-1', gateMode: 'observe', reason: null });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://proj.supabase.co/rest/v1/rpc/reserve_ai_request');
    expect(init.headers.apikey).toBe('service-secret');
    expect(init.headers.Authorization).toBe('Bearer service-secret');
    expect(JSON.parse(init.body)).toEqual({ p_user: 'u1', p_key: 'k1', p_hash: 'h', p_feature: 'ats_parse', p_session: null, p_est_tokens: 500 });
  });

  it('maps a refusal', async () => {
    const f = vi.fn(async () => ok([{ outcome: 'limit_reached', request_id: null, gate_mode: 'enforce', reason: 'tokens' }]));
    const r = await makeLedger({ env: ENV, fetchImpl: f }).reserve({ userId: 'u1', key: 'k', hash: 'h', feature: 'x', estTokens: 1 });
    expect(r).toMatchObject({ outcome: 'limit_reached', gateMode: 'enforce', reason: 'tokens' });
  });

  it.each([
    ['a database error', () => new Response('{"message":"boom"}', { status: 500 })],
    ['an unreadable reply', () => ok({ not: 'rows' })],
    ['an empty reply', () => ok([])],
  ])('reserve reports a gate_error for %s, never throws', async (_n, reply) => {
    const r = await makeLedger({ env: ENV, fetchImpl: vi.fn(async () => reply()) }).reserve({ userId: 'u1', key: 'k', hash: 'h', feature: 'x', estTokens: 1 });
    expect(r.outcome).toBe('gate_error');
  });

  it('reserve reports a gate_error when the network throws, and never leaks the key', async () => {
    const r = await makeLedger({ env: ENV, fetchImpl: vi.fn(async () => { throw new Error('down service-secret'); }) }).reserve({ userId: 'u1', key: 'k', hash: 'h', feature: 'x', estTokens: 1 });
    expect(r.outcome).toBe('gate_error');
    expect(JSON.stringify(r)).not.toContain('service-secret');
  });

  it('gives the gate a short time limit, so a slow database cannot hold up the AI call', () => {
    expect(GATE_TIMEOUT_MS).toBeLessThanOrEqual(3000);
  });

  it('settle and markUnknown call their functions and swallow failures', async () => {
    const f = vi.fn(async () => ok(null));
    const led = makeLedger({ env: ENV, fetchImpl: f });
    await led.settle({ id: 'r-1', state: 'completed', usage: { input: 10, output: 20, thinking: 5 }, provider: 'openai', model: 'gpt-6-luna' });
    expect(f.mock.calls[0][0]).toBe('https://proj.supabase.co/rest/v1/rpc/settle_ai_request');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ p_id: 'r-1', p_state: 'completed', p_in: 10, p_out: 20, p_think: 5, p_provider: 'openai', p_model: 'gpt-6-luna' });
    await led.markUnknown('r-1');
    expect(f.mock.calls[1][0]).toBe('https://proj.supabase.co/rest/v1/rpc/mark_unknown');
    const bad = makeLedger({ env: ENV, fetchImpl: vi.fn(async () => { throw new Error('x'); }) });
    await expect(bad.settle({ id: 'r', state: 'failed' })).resolves.toBeUndefined();
    await expect(bad.markUnknown('r')).resolves.toBeUndefined();
  });
});
