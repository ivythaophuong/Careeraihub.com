// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { providerChain, callWithFallback, shouldFallBack, ProviderError, modelFor, NO_SILENT_FALLBACK, withThinkingRoom } from './providers.js';

const MSGS = [{ role: 'user', content: 'hi' }];
const geminiOk = (t = 'from gemini') => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] }, finishReason: 'STOP' }] }), { status: 200 });
const compatOk = (t = 'from groq') => new Response(JSON.stringify({ choices: [{ message: { content: t }, finish_reason: 'stop' }] }), { status: 200 });
const anthropicOk = (t = 'from claude') => new Response(JSON.stringify({ content: [{ type: 'text', text: t }], stop_reason: 'end_turn' }), { status: 200 });
const err = (status, msg = 'boom') => new Response(JSON.stringify({ error: { message: msg } }), { status });

// Routes by host so a test can say which provider answers how.
const router = (routes) => vi.fn(async (url) => {
  const u = String(url);
  for (const [host, fn] of Object.entries(routes)) if (u.includes(host)) return fn();
  throw new Error('unexpected ' + u);
});

const ENV = { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'g-key', GROQ_API_KEY: 'q-key', OPENROUTER_API_KEY: 'o-key', ANTHROPIC_API_KEY: 'a-key' };

describe('providerChain', () => {
  it('puts the chosen provider first, then the other keyed ones', () => {
    expect(providerChain(ENV)).toEqual(['gemini', 'anthropic', 'groq', 'openrouter']);
  });
  it('follows AI_FALLBACKS when it is set, and skips providers without a key', () => {
    expect(providerChain({ ...ENV, AI_FALLBACKS: 'openrouter, openai, groq' })).toEqual(['gemini', 'openrouter', 'groq']);
  });
  it('is empty when nothing is configured, and when the chosen provider has no key', () => {
    expect(providerChain({})).toEqual([]);
    expect(providerChain({ AI_PROVIDER: 'gemini', GROQ_API_KEY: 'x' })).toEqual([]);
  });
  it('is just the one provider when only one key exists (old behaviour)', () => {
    expect(providerChain({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'g' })).toEqual(['gemini']);
  });
});

describe('callWithFallback', () => {
  it('uses the first provider when it works and does not call the others', async () => {
    const f = router({ 'generativelanguage': () => geminiOk(), 'groq.com': () => compatOk() });
    expect(await callWithFallback({ env: ENV, messages: MSGS, maxTokens: 100 }, f)).toBe('from gemini');
    expect(f).toHaveBeenCalledTimes(1);
  });
  it.each([[503, 'high demand'], [429, 'quota'], [500, 'oops'], [401, 'bad key'], [404, 'model gone']])('falls back when the first provider answers %s', async (status, msg) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = router({ 'generativelanguage': () => err(status, msg), 'anthropic.com': () => anthropicOk() });
    expect(await callWithFallback({ env: ENV, messages: MSGS, maxTokens: 100 }, f)).toBe('from claude');
  });
  it('falls back when the first provider cannot be reached or returns nothing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const down = vi.fn(async (url) => { if (String(url).includes('generativelanguage')) throw new Error('network'); return compatOk(); });
    expect(await callWithFallback({ env: { ...ENV, ANTHROPIC_API_KEY: '' }, messages: MSGS, maxTokens: 100 }, down)).toBe('from groq');
    const empty = router({ 'generativelanguage': () => new Response(JSON.stringify({ candidates: [] }), { status: 200 }), 'groq.com': () => compatOk() });
    expect(await callWithFallback({ env: { ...ENV, ANTHROPIC_API_KEY: '' }, messages: MSGS, maxTokens: 100 }, empty)).toBe('from groq');
  });
  it('tries every provider in turn and throws the chosen provider\'s error when all fail', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = router({ 'generativelanguage': () => err(503), 'anthropic.com': () => err(529), 'groq.com': () => err(429), 'openrouter.ai': () => err(502, 'last') });
    await expect(callWithFallback({ env: ENV, messages: MSGS, maxTokens: 100 }, f)).rejects.toMatchObject({ status: 503 });
    expect(f).toHaveBeenCalledTimes(4);
  });
  it('does NOT fall back for a bad request, a cut-off reply or a safety block', async () => {
    const bad = router({ 'generativelanguage': () => err(400, 'bad input'), 'groq.com': () => compatOk() });
    await expect(callWithFallback({ env: ENV, messages: MSGS, maxTokens: 100 }, bad)).rejects.toMatchObject({ status: 400 });
    expect(bad).toHaveBeenCalledTimes(1);
    const cut = router({ 'generativelanguage': () => new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS' }] }), { status: 200 }), 'groq.com': () => compatOk() });
    await expect(callWithFallback({ env: ENV, messages: MSGS, maxTokens: 100 }, cut)).rejects.toMatchObject({ kind: 'truncated' });
    expect(cut).toHaveBeenCalledTimes(1);
  });
  it('sends a PDF only to providers that read PDFs', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = router({ 'generativelanguage': () => err(503), 'groq.com': () => compatOk(), 'openrouter.ai': () => compatOk() });
    const env = { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q' };
    await expect(callWithFallback({ env, messages: MSGS, maxTokens: 100, pdfBase64: 'AAAA' }, f)).rejects.toMatchObject({ status: 503 });
    expect(f).toHaveBeenCalledTimes(1); // groq was skipped
  });
  it('calls Groq with its own address, key and model, never the AI_MODEL of another provider', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const calls = [];
    const f = vi.fn(async (url, init) => {
      calls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
      return String(url).includes('generativelanguage') ? err(503) : compatOk();
    });
    const env = { AI_PROVIDER: 'gemini', AI_MODEL: 'gemini-3.8-flash', GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q-key' };
    await callWithFallback({ env, messages: MSGS, maxTokens: 321 }, f);
    const groq = calls[1];
    expect(groq.url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(groq.headers.Authorization).toBe('Bearer q-key');
    expect(groq.body).toMatchObject({ model: 'openai/gpt-oss-120b', reasoning_effort: 'low', include_reasoning: false, max_completion_tokens: 2048 });
    expect(groq.body.max_tokens).toBeUndefined();
    expect(modelFor({ ...env, GROQ_MODEL: 'custom-model' }, 'groq')).toBe('custom-model');
  });
  it.each([
    ['deepinfra', 'DEEPINFRA_API_KEY', 'https://api.deepinfra.com/v1/openai/chat/completions', 'meta-llama/Llama-3.3-70B-Instruct'],
    ['mistral', 'MISTRAL_API_KEY', 'https://api.mistral.ai/v1/chat/completions', 'mistral-small-latest'],
  ])('can fall back to %s with its own address, key and model', async (name, keyVar, url, model) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const calls = [];
    const f = vi.fn(async (u, init) => { calls.push({ url: String(u), headers: init.headers, body: JSON.parse(init.body) }); return String(u).includes('generativelanguage') ? err(503) : compatOk(`from ${name}`); });
    const env = { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'g', [keyVar]: 'k-123' };
    expect(await callWithFallback({ env, messages: MSGS, maxTokens: 50 }, f)).toBe(`from ${name}`);
    expect(calls[1].url).toBe(url);
    expect(calls[1].headers.Authorization).toBe('Bearer k-123');
    expect(calls[1].body.model).toBe(model);
    expect(providerChain(env)).toEqual(['gemini', name]);
  });
  it('asks OpenRouter to use only Zero Data Retention endpoints, and sends that to no other provider', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const bodies = {};
    const f = vi.fn(async (u, init) => { bodies[String(u)] = JSON.parse(init.body); return String(u).includes('generativelanguage') ? err(503) : String(u).includes('groq') ? err(503) : compatOk(); });
    await callWithFallback({ env: { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q', OPENROUTER_API_KEY: 'o' }, messages: MSGS, maxTokens: 50 }, f);
    expect(bodies['https://openrouter.ai/api/v1/chat/completions'].provider).toEqual({ zdr: true });
    expect(bodies['https://api.groq.com/openai/v1/chat/completions'].provider).toBeUndefined();
  });
  it('logs which provider and model answered, marking a fallback, and nothing else', async () => {
    const info = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await callWithFallback({ env: ENV, messages: MSGS, maxTokens: 50 }, router({ 'generativelanguage': () => geminiOk('secret answer text') }));
    expect(info).toHaveBeenLastCalledWith('[ai] answered by gemini (gemini-3.8-flash)');
    await callWithFallback({ env: ENV, messages: MSGS, maxTokens: 50 }, router({ 'generativelanguage': () => err(429), 'anthropic.com': () => anthropicOk('secret answer text') }));
    expect(info).toHaveBeenLastCalledWith('[ai] answered by anthropic (claude-sonnet-5-5) as a fallback');
    expect(JSON.stringify(info.mock.calls)).not.toMatch(/secret answer text|g-key|a-key/);
  });
  it('gives a Groq thinking model room for its reasoning, and leaves other Groq models alone', async () => {
    const { groqBody } = await import('./providers.js');
    expect(groqBody('openai/gpt-oss-120b', 2500, MSGS)).toMatchObject({ max_completion_tokens: 5000, reasoning_effort: 'low' });
    expect(groqBody('openai/gpt-oss-120b', 8000, MSGS).max_completion_tokens).toBe(8192);
    expect(groqBody('llama-3.1-8b-instant', 500, MSGS)).toEqual({ model: 'llama-3.1-8b-instant', max_completion_tokens: 500, messages: MSGS });
  });
  it('never puts a key in the log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = router({ 'generativelanguage': () => err(503), 'anthropic.com': () => anthropicOk() });
    await callWithFallback({ env: ENV, messages: MSGS, maxTokens: 100 }, f);
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/g-key|a-key|q-key|o-key/);
  });
});

describe('shouldFallBack', () => {
  it('is false for anything that is not a ProviderError', () => {
    expect(shouldFallBack(new Error('x'))).toBe(false);
    expect(shouldFallBack(new ProviderError('x', { kind: 'upstream', status: 422 }))).toBe(false);
  });
});

describe('overall deadline (ADR-012)', () => {
  const hang = () => vi.fn(async (url, init) => new Promise((_, rej) => { init.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))); }));

  it('uses a default budget below the browser wait, and AI_DEADLINE_MS can change it', async () => {
    const { deadlineFor, DEFAULT_DEADLINE_MS, MIN_ATTEMPT_MS } = await import('./providers.js');
    expect(DEFAULT_DEADLINE_MS).toBeLessThan(100_000);
    expect(deadlineFor({})).toBe(DEFAULT_DEADLINE_MS);
    expect(deadlineFor({ AI_DEADLINE_MS: '60000' })).toBe(60_000);
    expect(deadlineFor({ AI_DEADLINE_MS: '10' })).toBe(DEFAULT_DEADLINE_MS);   // too small to be useful: ignored
    expect(deadlineFor({ AI_DEADLINE_MS: 'abc' })).toBe(DEFAULT_DEADLINE_MS);
    expect(MIN_ATTEMPT_MS).toBeGreaterThan(0);
  });

  it('does not start another provider once the budget is used up, and the first error is the one reported', async () => {
    vi.useFakeTimers();
    try {
      const f = hang();
      const p = callWithFallback({ env: { ...ENV, AI_DEADLINE_MS: '20000' }, messages: MSGS, maxTokens: 50 }, f, 80_000, () => Date.now());
      const settled = p.catch(e => e);
      await vi.advanceTimersByTimeAsync(20_000);   // first attempt is cut at the budget, not at 80 s
      const err = await settled;
      expect(err).toBeInstanceOf(ProviderError);
      expect(f).toHaveBeenCalledTimes(1);          // no second provider after the budget is gone
    } finally { vi.useRealTimers(); }
  });

  it('still falls back when the first provider fails quickly inside the budget', async () => {
    const f = router({ 'generativelanguage': () => err(503), 'anthropic': () => anthropicOk('from claude') });
    expect(await callWithFallback({ env: ENV, messages: MSGS, maxTokens: 50 }, f)).toBe('from claude');
  });

  it('gives each attempt only the time that is left', async () => {
    vi.useFakeTimers();
    try {
      const f = hang();
      const p = callWithFallback({ env: { ...ENV, AI_DEADLINE_MS: '30000' }, messages: MSGS, maxTokens: 50 }, f, 10_000, () => Date.now()).catch(e => e);
      await vi.advanceTimersByTimeAsync(10_000);   // attempt 1 times out at its own 10 s limit
      await vi.advanceTimersByTimeAsync(10_000);   // attempt 2 likewise
      await vi.advanceTimersByTimeAsync(10_000);   // attempt 3 would start with 10 s left, then budget ends
      await p;
      expect(f.mock.calls.length).toBeLessThanOrEqual(3);
      expect(f.mock.calls.length).toBeGreaterThanOrEqual(2);
    } finally { vi.useRealTimers(); }
  });
});

// A different model scores the same text differently (measured 2026-10-14: the same answer got 12, 22 and 32 from three models), and a different
// model writes differently (one inflated a third of its rewrites). So a call whose result is a number the user sees is not moved to another model
// without anyone noticing: it fails, and the person tries again on the same model.
describe('features that produce a score do not fall back to another model', () => {
  const meter = (feature) => ({ record: () => {}, correlationId: 'c', feature, userRef: null });

  it('lists the features whose answer is, or contains, a number the user sees as a score', () => {
    expect([...NO_SILENT_FALLBACK].sort()).toEqual(['jd_analyze', 'memory_plan', 'scan_jd_match', 'score_interview_evaluate', 'score_star_review']);
  });
  it.each([...['score_star_review', 'score_interview_evaluate', 'scan_jd_match', 'jd_analyze', 'memory_plan']])('%s: the chosen provider is busy, the user hears that, and no other provider is called', async (feature) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = router({ 'generativelanguage': () => err(503, 'high demand'), 'groq.com': () => compatOk(), 'anthropic.com': () => anthropicOk() });
    await expect(callWithFallback({ env: ENV, messages: MSGS, maxTokens: 100, meter: meter(feature) }, f)).rejects.toMatchObject({ status: 503 });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('a score feature that works is answered by the chosen provider as before', async () => {
    const f = router({ 'generativelanguage': () => geminiOk('scored') });
    expect(await callWithFallback({ env: ENV, messages: MSGS, maxTokens: 100, meter: meter('score_star_review') }, f)).toBe('scored');
  });
  it('writing features and unknown labels still fall back, exactly as before', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const feature of ['cover_letter', 'ats_parse', 'unknown', undefined]) {
      const f = router({ 'generativelanguage': () => err(503), 'anthropic.com': () => anthropicOk() });
      expect(await callWithFallback({ env: ENV, messages: MSGS, maxTokens: 100, meter: meter(feature) }, f)).toBe('from claude');
    }
    const f2 = router({ 'generativelanguage': () => err(503), 'anthropic.com': () => anthropicOk() });
    expect(await callWithFallback({ env: ENV, messages: MSGS, maxTokens: 100 }, f2)).toBe('from claude');   // no meter at all
  });
  it('with a PDF the pinned provider is the first one that reads PDFs, and there is still no second one', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const env = { AI_PROVIDER: 'groq', GROQ_API_KEY: 'q', ANTHROPIC_API_KEY: 'a', GEMINI_API_KEY: 'g' };
    const f = router({ 'anthropic.com': () => err(503), 'generativelanguage': () => geminiOk(), 'groq.com': () => compatOk() });
    await expect(callWithFallback({ env, messages: MSGS, maxTokens: 100, pdfBase64: 'AAAA', meter: meter('jd_analyze') }, f)).rejects.toMatchObject({ status: 503 });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('the usage log marks the attempt as not a fallback', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const events = [];
    const m = { record: (e) => events.push(e), correlationId: 'c', feature: 'score_star_review', userRef: null };
    await callWithFallback({ env: ENV, messages: MSGS, maxTokens: 100, meter: m }, router({ 'generativelanguage': () => err(503) })).catch(() => {});
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ provider: 'gemini', fallback: false, outcome: 'error' });
  });
});

// A model that thinks before it answers counts the thinking against the output limit. Measured on 12 rewrites: Haiku 5.5 used up to 3,182 of the
// 4,000 tokens the ats_parse call allows. A reply cut by the limit is not retried on another provider, so the limit leaves room (the same idea as
// groqBody for gpt-oss). The provider bills the tokens used, not the limit.
describe('room for thinking', () => {
  it('doubles the limit, never below 4096 and never above 16000', () => {
    expect(withThinkingRoom(4000)).toBe(8000);
    expect(withThinkingRoom(600)).toBe(4096);
    expect(withThinkingRoom(12000)).toBe(16000);
  });
  const bodyOf = async (env, maxTokens) => {
    let body;
    const f = vi.fn(async (url, init) => { body = JSON.parse(init.body); return String(url).includes('anthropic') ? anthropicOk() : compatOk(); });
    await callWithFallback({ env, messages: MSGS, maxTokens }, f);
    return body;
  };
  it('OpenAI gets max_completion_tokens with room', async () => {
    expect((await bodyOf({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'k' }, 4000)).max_completion_tokens).toBe(8000);
  });
  it('Anthropic gets max_tokens with room', async () => {
    expect((await bodyOf({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }, 4000)).max_tokens).toBe(8000);
  });
  it('OpenRouter and the other compatible providers keep the limit the feature asked for', async () => {
    expect((await bodyOf({ AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'k' }, 4000)).max_tokens).toBe(4000);
  });
});
