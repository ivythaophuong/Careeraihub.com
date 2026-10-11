// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { extractUsage, priceFor, computeCost, buildEvent, makeRecorder, userRef, sanitizeFeature, PRICE_TABLE } from './usage.js';
import { callWithFallback } from '../ai/providers.js';
import { handleRequest, createRateLimiter } from '../ai/handler.js';

const ok = (b, s = 200) => new Response(JSON.stringify(b), { status: s });
const GEMINI = (extra = {}) => ok({ candidates: [{ content: { parts: [{ text: 'SECRET ANSWER TEXT' }] }, finishReason: 'STOP' }], ...extra });
const ANTHROPIC = (extra = {}) => ok({ content: [{ type: 'text', text: 'SECRET ANSWER TEXT' }], stop_reason: 'end_turn', ...extra });
const COMPAT = (extra = {}) => ok({ choices: [{ message: { content: 'SECRET ANSWER TEXT' }, finish_reason: 'stop' }], ...extra });
const MSGS = [{ role: 'user', content: 'PRIVATE CV TEXT jane@example.com' }];
const ENV = { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'g-SECRET-KEY', GROQ_API_KEY: 'q-SECRET-KEY' };

describe('extractUsage: what each provider reports (nothing is estimated)', () => {
  it('Gemini: prompt, candidate and thinking tokens', () => {
    expect(extractUsage('gemini', { usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 40, thoughtsTokenCount: 300, totalTokenCount: 460 } })).toEqual({ input: 120, output: 40, thinking: 300, total: 460 });
  });
  it('Anthropic: input and output tokens', () => {
    expect(extractUsage('anthropic', { usage: { input_tokens: 10, output_tokens: 5 } })).toEqual({ input: 10, output: 5, thinking: null, total: null });
  });
  it('OpenAI-style (Groq, OpenRouter, DeepInfra, Mistral): prompt, completion, reasoning, total', () => {
    expect(extractUsage('groq', { usage: { prompt_tokens: 7, completion_tokens: 9, total_tokens: 16, completion_tokens_details: { reasoning_tokens: 4 } } })).toEqual({ input: 7, output: 9, thinking: 4, total: 16 });
  });
  it.each([['gemini', {}], ['gemini', { usageMetadata: {} }], ['anthropic', { content: [] }], ['groq', { usage: {} }], ['groq', null]])('%s without usable usage gives null, not a made-up number', (p, data) => {
    expect(extractUsage(p, data)).toBeNull();
  });
  it('ignores negative or non-numeric values', () => {
    expect(extractUsage('anthropic', { usage: { input_tokens: -1, output_tokens: 'many' } })).toBeNull();
  });
});

describe('cost: only from a versioned price entry that was in force that day', () => {
  const entry = (o = {}) => ({ provider: 'gemini', model: 'm', effective_from: '2026-10-01', effective_to: null, input_per_million_usd: 1, output_per_million_usd: 4, thinking_billed_as: 'output', free_tier: false, ...o });
  const usage = { input: 1_000_000, output: 500_000, thinking: 100_000, total: null };
  it('the shipped price table is empty on purpose: no cost is invented', () => {
    expect(PRICE_TABLE.entries).toEqual([]);
    expect(computeCost(usage, priceFor(PRICE_TABLE, 'gemini', 'm', '2026-10-10'))).toEqual({ cost_usd: null, cost_status: 'price_unknown' });
  });
  it('computes from the entry, counting thinking tokens as output only when the entry says so', () => {
    const t = { version: '1', entries: [entry()] };
    expect(computeCost(usage, priceFor(t, 'gemini', 'm', '2026-10-10'))).toEqual({ cost_usd: 1 + 4 * 0.6, cost_status: 'computed' });
  });
  it('refuses to guess how thinking tokens are billed', () => {
    const t = { version: '1', entries: [entry({ thinking_billed_as: null })] };
    expect(computeCost(usage, priceFor(t, 'gemini', 'm', '2026-10-10')).cost_status).toBe('thinking_billing_unknown');
  });
  it('uses the entry in force on the day of the call, not a later one', () => {
    const t = { version: '1', entries: [entry({ effective_from: '2026-01-01', effective_to: '2026-09-30', input_per_million_usd: 9 }), entry()] };
    expect(priceFor(t, 'gemini', 'm', '2026-06-01').input_per_million_usd).toBe(9);
    expect(priceFor(t, 'gemini', 'm', '2026-10-10').input_per_million_usd).toBe(1);
    expect(priceFor(t, 'gemini', 'm', '2025-12-31')).toBeNull();
  });
  it('a PDF call has no cost unless the entry says it prices PDF input', () => {
    const t = { version: '1', entries: [entry()] };
    expect(computeCost({ input: 1, output: 1, thinking: null }, priceFor(t, 'gemini', 'm', '2026-10-10'), true).cost_status).toBe('pdf_billing_unknown');
  });
  it('usage not reported means cost unknown, never zero', () => {
    expect(computeCost(null, entry())).toEqual({ cost_usd: null, cost_status: 'usage_unavailable' });
  });
  it('a free-tier entry is marked as such', () => {
    expect(computeCost(usage, entry({ free_tier: true }))).toEqual({ cost_usd: 0, cost_status: 'free_tier' });
  });
});

describe('events through callWithFallback', () => {
  const run = async (fetchImpl, env = ENV, extra = {}) => {
    const events = [];
    const meter = { record: (e) => events.push(e), correlationId: 'corr-1', feature: 'ats_builder_parse', userRef: 'abc123', ...extra };
    const text = await callWithFallback({ env, messages: MSGS, maxTokens: 100, pdfBase64: null, meter }, fetchImpl).catch((e) => e);
    return { events, text };
  };

  it('one success event with the tokens the provider reported, the feature, a correlation id and a duration', async () => {
    const { events, text } = await run(vi.fn(async () => GEMINI({ usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 20, thoughtsTokenCount: 10, totalTokenCount: 80 } })));
    expect(text).toBe('SECRET ANSWER TEXT');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ event: 'ai_usage', v: 1, correlation_id: 'corr-1', feature: 'ats_builder_parse', user_ref: 'abc123', provider: 'gemini', outcome: 'success', attempt: 1, fallback: false, input_tokens: 50, output_tokens: 20, thinking_tokens: 10, total_tokens: 80, usage_status: 'reported', cost_status: 'price_unknown', cost_usd: null });
    expect(events[0].duration_ms).toBeGreaterThanOrEqual(0);
    expect(events[0].model).toBeTruthy();
  });
  it('a provider that reports no usage is recorded as usage_unavailable with null tokens (no estimate)', async () => {
    const { events } = await run(vi.fn(async () => GEMINI()));
    expect(events[0]).toMatchObject({ usage_status: 'usage_unavailable', input_tokens: null, output_tokens: null, cost_status: 'usage_unavailable' });
  });
  it('a failed attempt and the fallback that answered are two events with the same correlation id', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const f = vi.fn(async (url) => (String(url).includes('generativelanguage') ? ok({ error: { message: 'busy' } }, 429) : COMPAT({ usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 } })));
    const { events } = await run(f);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ provider: 'gemini', outcome: 'error', http_status: 429, error_kind: 'upstream', attempt: 1, fallback: false, usage_status: 'not_applicable', input_tokens: null });
    expect(events[1]).toMatchObject({ provider: 'groq', outcome: 'success', attempt: 2, fallback: true, input_tokens: 3, output_tokens: 4 });
    expect(new Set(events.map((e) => e.correlation_id)).size).toBe(1);
  });
  it('the log never holds the prompt, the answer, a key or an e-mail', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const f = vi.fn(async (url) => (String(url).includes('generativelanguage') ? ok({ error: { message: 'PRIVATE CV TEXT leaked in an error' } }, 500) : COMPAT({ usage: { prompt_tokens: 1, completion_tokens: 1 } })));
    const { events } = await run(f);
    const logged = JSON.stringify(events);
    for (const secret of ['PRIVATE CV TEXT', 'jane@example.com', 'SECRET ANSWER TEXT', 'g-SECRET-KEY', 'q-SECRET-KEY']) expect(logged).not.toContain(secret);
  });
  it('a metering failure never breaks the request', async () => {
    const meter = { record: () => { throw new Error('logging is down'); }, correlationId: 'c', feature: 'x', userRef: null };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(callWithFallback({ env: ENV, messages: MSGS, maxTokens: 10, pdfBase64: null, meter }, vi.fn(async () => GEMINI()))).resolves.toBe('SECRET ANSWER TEXT');
  });
  it('works without a meter (old callers)', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(callWithFallback({ env: ENV, messages: MSGS, maxTokens: 10, pdfBase64: null }, vi.fn(async () => GEMINI()))).resolves.toBe('SECRET ANSWER TEXT');
  });
  it('the sink writes one "[usage] {json}" line and swallows a sink error', () => {
    const lines = [];
    makeRecorder((l) => lines.push(l))({ a: 1 });
    expect(lines).toEqual(['[usage] {"a":1}']);
    expect(() => makeRecorder(() => { throw new Error('x'); })({ a: 1 })).not.toThrow();
  });
});

describe('buildEvent and helpers', () => {
  it('only the listed fields exist', () => {
    const e = buildEvent({ correlationId: 'c', feature: 'f', userRef: 'u', provider: 'gemini', model: 'm', attempt: 1, fallback: false, outcome: 'success', durationMs: 12.6, usage: { input: 1, output: 2, thinking: null, total: 3 } });
    expect(Object.keys(e).sort()).toEqual(['attempt', 'correlation_id', 'cost_status', 'cost_usd', 'duration_ms', 'error_kind', 'event', 'fallback', 'feature', 'has_pdf', 'http_status', 'input_tokens', 'model', 'outcome', 'output_tokens', 'price_table_version', 'provider', 'thinking_tokens', 'total_tokens', 'ts', 'usage_status', 'user_ref', 'v'].sort());
    expect(e.duration_ms).toBe(13);
  });
  it('feature labels are restricted to a safe pattern', () => {
    expect(sanitizeFeature('scan_jd_match')).toBe('scan_jd_match');
    for (const bad of ['', 'Has Space', 'a'.repeat(41), '../x', null, undefined, 5, '<script>']) expect(sanitizeFeature(bad)).toBe('unknown');
  });
  it('the user reference is stable, short and not the user id', async () => {
    const a = await userRef('salt', 'user-uuid-1'), b = await userRef('salt', 'user-uuid-1'), c = await userRef('salt', 'user-uuid-2'), d = await userRef('other', 'user-uuid-1');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
    expect(a).not.toContain('user-uuid');
    expect(await userRef('', 'u')).toBeNull();
  });
});

describe('the ai function', () => {
  const envFull = { SUPABASE_URL: 'https://p.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service-secret', AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'g-key' };
  const call = (body, deps = {}) => handleRequest(new Request('https://p.supabase.co/functions/v1/ai', { method: 'POST', headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' }, body: JSON.stringify(body) }), {
    env: envFull, limiter: createRateLimiter(),
    fetchImpl: vi.fn(async (url) => (String(url).includes('/auth/v1/user') ? ok({ id: 'real-user-id-123' }) : GEMINI({ usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 6, totalTokenCount: 11 } }))), ...deps,
  });
  it('writes one usage event with the feature the app named, a pseudonymous user and no content', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const events = [];
    const res = await call({ messages: MSGS, feature: 'scan_jd_match' }, { recordUsage: (e) => events.push(e) });
    expect(res.status).toBe(200);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ feature: 'scan_jd_match', input_tokens: 5, output_tokens: 6, outcome: 'success' });
    expect(events[0].user_ref).toMatch(/^[0-9a-f]{16}$/);
    const logged = JSON.stringify(events);
    for (const secret of ['real-user-id-123', 'PRIVATE CV TEXT', 'service-secret', 'g-key']) expect(logged).not.toContain(secret);
  });
  it('an unknown or hostile feature label is recorded as "unknown"', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const events = [];
    await call({ messages: MSGS, feature: '<img src=x onerror=1>' }, { recordUsage: (e) => events.push(e) });
    expect(events[0].feature).toBe('unknown');
  });
  it('an error response carries a request id that matches the usage events, for support', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const events = [];
    const fetchImpl = vi.fn(async (url) => (String(url).includes('/auth/v1/user') ? ok({ id: 'u1' }) : ok({ error: { message: 'bad' } }, 400)));
    const res = await call({ messages: MSGS, feature: 'x' }, { recordUsage: (e) => events.push(e), fetchImpl });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.requestId).toBe(events[0].correlation_id);
  });
});
