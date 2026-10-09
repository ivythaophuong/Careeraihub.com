// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { providerChain, callWithFallback, shouldFallBack, ProviderError, modelFor } from './providers.js';

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
  it('tries every provider in turn and throws the last error when all fail', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = router({ 'generativelanguage': () => err(503), 'anthropic.com': () => err(529), 'groq.com': () => err(429), 'openrouter.ai': () => err(502, 'last') });
    await expect(callWithFallback({ env: ENV, messages: MSGS, maxTokens: 100 }, f)).rejects.toMatchObject({ status: 502, message: 'last' });
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
    expect(groq.body).toMatchObject({ model: 'llama-3.3-70b-versatile', max_tokens: 321 });
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
