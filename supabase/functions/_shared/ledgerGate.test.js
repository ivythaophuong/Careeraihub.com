// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { callWithLedger, LedgerLimit } from './ledgerGate.js';
import { ProviderError } from '../ai/providers.js';

const ENV_ON = { SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc', AI_LEDGER: 'on' };
const fakeLedger = (over = {}) => ({
  reserve: vi.fn(async () => ({ outcome: 'reserved', requestId: 'req-1', gateMode: 'observe', reason: null })),
  settle: vi.fn(async () => undefined),
  markUnknown: vi.fn(async () => undefined),
  ...over,
});
const base = (over = {}) => ({
  env: ENV_ON, userId: 'u1', feature: 'score_star_review', messages: [{ role: 'user', content: 'a secret story' }], maxTokens: 500,
  meter: { correlationId: 'corr-1', record: vi.fn() },
  call: vi.fn(async (m) => { m.record({ outcome: 'success', provider: 'openai', model: 'gpt-6-luna', input_tokens: 10, output_tokens: 20, thinking_tokens: 5, total_tokens: 30 }); return 'the text'; }),
  ...over,
});

describe('callWithLedger', () => {
  it('with the ledger off it only makes the call', async () => {
    const ledger = fakeLedger(); const o = base({ env: { ...ENV_ON, AI_LEDGER: 'off' }, ledger });
    expect(await callWithLedger(o)).toBe('the text');
    expect(ledger.reserve).not.toHaveBeenCalled();
    expect(o.call).toHaveBeenCalledTimes(1);
  });

  it('reserves with the correlation id as key and no content, makes the call, then settles with the provider usage', async () => {
    const ledger = fakeLedger(); const o = base({ ledger });
    expect(await callWithLedger(o)).toBe('the text');
    const arg = ledger.reserve.mock.calls[0][0];
    expect(arg).toMatchObject({ userId: 'u1', key: 'corr-1', feature: 'score_star_review' });
    expect(arg.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(arg)).not.toContain('secret');
    expect(ledger.settle).toHaveBeenCalledWith(expect.objectContaining({ id: 'req-1', state: 'completed', usage: expect.objectContaining({ total: 30 }), provider: 'openai' }));
    expect(o.meter.gateMode).toBe('observe');
  });

  it('forwards every usage event to the original recorder', async () => {
    const o = base({ ledger: fakeLedger() }); const rec = o.meter.record;
    await callWithLedger(o);
    expect(rec).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'success' }));
  });

  it('throws LedgerLimit and never calls the provider when the gate refuses', async () => {
    const ledger = fakeLedger({ reserve: vi.fn(async () => ({ outcome: 'limit_reached', requestId: null, gateMode: 'enforce', reason: 'tokens' })) });
    const o = base({ ledger });
    await expect(callWithLedger(o)).rejects.toMatchObject({ name: 'LedgerLimit', reason: 'tokens' });
    expect(o.call).not.toHaveBeenCalled();
  });

  it('D-7: a failing or throwing ledger lets the request through', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const reserve of [vi.fn(async () => ({ outcome: 'gate_error' })), vi.fn(async () => { throw new Error('boom'); })]) {
      const ledger = fakeLedger({ reserve }); const o = base({ ledger });
      expect(await callWithLedger(o)).toBe('the text');
      expect(ledger.settle).not.toHaveBeenCalled();
    }
  });

  it('a failing settle never changes the result', async () => {
    const ledger = fakeLedger({ settle: vi.fn(async () => { throw new Error('boom'); }) });
    expect(await callWithLedger(base({ ledger }))).toBe('the text');
  });

  it.each([
    ['cut off, blocked or empty output: the tokens were spent', new ProviderError('cut', { kind: 'truncated', status: 0 }), 'settle', { id: 'req-1', state: 'completed' }],
    ['an error status from the provider: nothing was billed', new ProviderError('bad', { kind: 'upstream', status: 400 }), 'settle', { id: 'req-1', state: 'failed' }],
    ['no status (timeout, network): the outcome cannot be known', new ProviderError('slow', { kind: 'upstream', status: 0 }), 'markUnknown', 'req-1'],
    ['an unexpected error: the outcome cannot be known', new Error('weird'), 'markUnknown', 'req-1'],
  ])('settles honestly after a failure: %s', async (_n, err, fn, arg) => {
    const ledger = fakeLedger(); const o = base({ ledger, call: vi.fn(async () => { throw err; }) });
    await expect(callWithLedger(o)).rejects.toBe(err);
    if (fn === 'settle') expect(ledger.settle).toHaveBeenCalledWith(arg); else expect(ledger.markUnknown).toHaveBeenCalledWith(arg);
  });

  it('LedgerLimit is its own error type', () => {
    const e = new LedgerLimit('requests'); expect(e).toBeInstanceOf(Error); expect(e.reason).toBe('requests');
  });
});
