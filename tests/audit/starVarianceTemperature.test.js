// @vitest-environment node
// The variance tool can ask for a different temperature than the production code sends, to measure whether it changes the spread.
// It does this by changing the request on its way to the provider; supabase/functions/ai/providers.js is not touched.
import { describe, it, expect } from 'vitest';
import fixture from '../fixtures/star-variance/stories.json';
import { runVariance, withTemperature, formatReport } from '../../scripts/audit/starVariance.mjs';

const ok = (b, s = 200) => new Response(JSON.stringify(b), { status: s });
// A stand-in provider (Anthropic shape) that keeps every request body it was sent.
function recordingFetch() {
  const bodies = [];
  const f = async (url, init) => {
    if (String(url).includes('/auth/v1/user')) return ok({ id: 'local-run' });
    bodies.push(JSON.parse(init.body));
    const reply = { scores: { situation: 60, task: 60, action: 60, result: 60 }, refined: { situation: 'a', task: 'b', action: 'c', result: 'd' }, oneLiner: 'x', feedback: ['y'], missingDetails: [], competencies: ['z'] };
    return ok({ content: [{ type: 'text', text: JSON.stringify(reply) }], stop_reason: 'end_turn', usage: { input_tokens: 700, output_tokens: 300 } });
  };
  f.bodies = bodies;
  return f;
}
const ENV = { ANTHROPIC_API_KEY: 'sk-ant-test-not-real', AI_PROVIDER: 'anthropic', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' };
const one = fixture.stories.slice(0, 1);
const wait = { delayMs: 0, retryWaitMs: [0, 0, 0] };

describe('withTemperature changes only the temperature of a provider request', () => {
  const seen = () => { const calls = []; const f = async (url, init) => { calls.push({ url, init }); return ok({}); }; f.calls = calls; return f; };

  it('sets a top-level temperature on an OpenAI-style or Anthropic body and keeps the rest', async () => {
    const inner = seen();
    await withTemperature(inner, 0.2)('https://api.example/v1/chat', { method: 'POST', headers: { a: 'b' }, body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }) });
    expect(JSON.parse(inner.calls[0].init.body)).toEqual({ model: 'm', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5, temperature: 0.2 });
    expect(inner.calls[0].init.headers).toEqual({ a: 'b' });
  });

  it('replaces the temperature inside generationConfig on a Gemini body, and keeps the other settings', async () => {
    const inner = seen();
    await withTemperature(inner, 0.7)('https://generativelanguage.googleapis.com/x', { method: 'POST', body: JSON.stringify({ contents: [], generationConfig: { temperature: 0.1, maxOutputTokens: 4096 } }) });
    const b = JSON.parse(inner.calls[0].init.body);
    expect(b.generationConfig).toEqual({ temperature: 0.7, maxOutputTokens: 4096 });
    expect(b.temperature).toBeUndefined();
  });

  it('0 is a real value and is sent', async () => {
    const inner = seen();
    await withTemperature(inner, 0)('https://api.example/v1/chat', { body: JSON.stringify({ model: 'm', messages: [] }) });
    expect(JSON.parse(inner.calls[0].init.body).temperature).toBe(0);
  });

  it('leaves a request it does not understand exactly as it was', async () => {
    const inner = seen();
    const init = { method: 'GET' };
    await withTemperature(inner, 0.3)('https://api.example/x', init);
    expect(inner.calls[0].init).toBe(init);
    const odd = { method: 'POST', body: 'not json' };
    await withTemperature(inner, 0.3)('https://api.example/x', odd);
    expect(inner.calls[1].init).toBe(odd);
  });

  it.each([[-0.1], [2.5], [NaN], ['0.1'], [null]])('refuses %s as a temperature', (t) => {
    expect(() => withTemperature(seen(), t)).toThrow(/temperature/i);
  });
});

describe('runVariance with a temperature', () => {
  it('without the option nothing is added to the provider request, and the result says the code\'s own setting applied', async () => {
    const fetchImpl = recordingFetch();
    const res = await runVariance({ env: ENV, fetchImpl, stories: one, runs: 1, ...wait });
    expect(fetchImpl.bodies[0].temperature).toBeUndefined();
    expect(res.config.temperature).toMatchObject({ mode: 'not_overridden' });
    expect(res.config.temperature.note).toMatch(/Gemini.*0\.1/);
  });

  it('with the option every provider request carries it, 0 included, and the result records it', async () => {
    const fetchImpl = recordingFetch();
    const res = await runVariance({ env: ENV, fetchImpl, stories: one, runs: 2, temperature: 0, ...wait });
    expect(fetchImpl.bodies).toHaveLength(2);
    for (const b of fetchImpl.bodies) expect(b.temperature).toBe(0);
    expect(res.config.temperature).toEqual({ mode: 'override', value: 0 });
  });

  it('refuses to resume results measured at another temperature: two settings must not be mixed in one measurement', async () => {
    const first = await runVariance({ env: ENV, fetchImpl: recordingFetch(), stories: one, runs: 1, temperature: 0, ...wait });
    await expect(runVariance({ env: ENV, fetchImpl: recordingFetch(), stories: one, runs: 2, previous: first, temperature: 0.5, ...wait })).rejects.toThrow(/temperature/i);
    await expect(runVariance({ env: ENV, fetchImpl: recordingFetch(), stories: one, runs: 2, previous: first, ...wait })).rejects.toThrow(/temperature/i);
    const same = await runVariance({ env: ENV, fetchImpl: recordingFetch(), stories: one, runs: 2, previous: first, temperature: 0, ...wait });
    expect(same.runs.filter((r) => r.ok)).toHaveLength(2);
  });

  it('results from before this option (no temperature recorded) can still be resumed without the option', async () => {
    const first = await runVariance({ env: ENV, fetchImpl: recordingFetch(), stories: one, runs: 1, ...wait });
    delete first.config.temperature;
    const again = await runVariance({ env: ENV, fetchImpl: recordingFetch(), stories: one, runs: 2, previous: first, ...wait });
    expect(again.runs.filter((r) => r.ok)).toHaveLength(2);
  });

  it('the report states the temperature', async () => {
    const withIt = await runVariance({ env: ENV, fetchImpl: recordingFetch(), stories: one, runs: 1, temperature: 0.1, ...wait });
    expect(formatReport(withIt, 'out.json')).toMatch(/temperature 0\.1 \(set by this tool\)/);
    const without = await runVariance({ env: ENV, fetchImpl: recordingFetch(), stories: one, runs: 1, ...wait });
    expect(formatReport(without, 'out.json')).toMatch(/temperature: the code's own setting/);
  });
});
