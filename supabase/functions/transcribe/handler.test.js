// @vitest-environment node
// The transcribe function (voice practice spike, docs/architecture/plans/DECISION-voice-practice-2026-10-18.md).
// Owner decisions V1 to V3, V7: a server function, Groq first then OpenAI, no audio kept, owner's account only. English only.
import { describe, it, expect, vi } from 'vitest';
import { handleRequest, LIMITS } from './handler.js';
import { createRateLimiter } from '../ai/handler.js';

const ENV = {
  SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_ANON_KEY: 'anon',
  GROQ_API_KEY: 'gsk-SECRET', OPENAI_API_KEY: 'sk-SECRET',
  VOICE_TRANSCRIBE: 'on', VOICE_ALLOWED_USER_IDS: 'user-1',
};
const ok = (b, s = 200) => new Response(JSON.stringify(b), { status: s });
const AUDIO = Buffer.from('fake-audio-bytes').toString('base64');
const body = (over = {}) => ({ audioBase64: AUDIO, mimeType: 'audio/webm', durationSec: 12, ...over });

// auth -> user-1; every STT url gets its own handler so a test can make one provider fail.
const makeFetch = (stt = {}) => vi.fn(async (url, init) => {
  const u = String(url);
  if (u.includes('/auth/v1/user')) return ok({ id: stt.userId || 'user-1' });
  if (u.includes('api.groq.com')) return (stt.groq || (() => ok({ text: 'I led a small team.' })))(u, init);
  if (u.includes('api.openai.com')) return (stt.openai || (() => ok({ text: 'From OpenAI.' })))(u, init);
  throw new Error('unexpected url ' + u);
});
const send = async ({ env = ENV, fetchImpl = makeFetch(), b = body(), method = 'POST', auth = 'Bearer t', raw, logs = [] } = {}) => {
  const log = (line) => logs.push(line);
  const r = await handleRequest(new Request('https://proj.supabase.co/functions/v1/transcribe', {
    method, headers: { authorization: auth, 'content-type': 'application/json' }, ...(method === 'POST' ? { body: raw ?? JSON.stringify(b) } : {}),
  }), { env, fetchImpl, limiter: createRateLimiter(), log });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null, fetchImpl, logs, raw: text };
};
const sttCalls = (fetchImpl) => fetchImpl.mock.calls.filter(([u]) => !String(u).includes('/auth/v1/user'));

describe('gates', () => {
  it('answers 404-style "not available" when the flag is off, and calls nothing', async () => {
    const r = await send({ env: { ...ENV, VOICE_TRANSCRIBE: undefined } });
    expect(r.status).toBe(403);
    expect(sttCalls(r.fetchImpl)).toHaveLength(0);
  });
  it('refuses a signed-in user who is not on the allowlist (owner account only)', async () => {
    const r = await send({ fetchImpl: makeFetch({ userId: 'someone-else' }) });
    expect(r.status).toBe(403);
    expect(sttCalls(r.fetchImpl)).toHaveLength(0);
  });
  it('refuses everyone when the allowlist is empty', async () => {
    const r = await send({ env: { ...ENV, VOICE_ALLOWED_USER_IDS: '' } });
    expect(r.status).toBe(403);
  });
  it('requires sign-in', async () => {
    const r = await send({ auth: '' });
    expect(r.status).toBe(401);
  });
  it('rejects other methods and answers the CORS preflight', async () => {
    expect((await send({ method: 'GET' })).status).toBe(405);
    expect((await send({ method: 'OPTIONS' })).status).toBe(204);
  });
});

describe('validation', () => {
  it.each([
    ['missing audio', { audioBase64: undefined }],
    ['not base64', { audioBase64: '***not base64***' }],
    ['unsupported type', { mimeType: 'application/pdf' }],
    ['absurd duration', { durationSec: 9999 }],
    ['negative duration', { durationSec: -1 }],
  ])('400 on %s, before any provider call', async (_n, over) => {
    const r = await send({ b: body(over) });
    expect(r.status).toBe(400);
    expect(sttCalls(r.fetchImpl)).toHaveLength(0);
  });
  it('400 on invalid JSON', async () => {
    expect((await send({ raw: '{nope' })).status).toBe(400);
  });
  it('413 when the audio is larger than the limit', async () => {
    const big = 'A'.repeat(Math.ceil(LIMITS.maxAudioBytes * 4 / 3) + 8);
    expect((await send({ b: body({ audioBase64: big }) })).status).toBe(413);
  });
  it('accepts codec parameters on the mime type (Chrome sends audio/webm;codecs=opus)', async () => {
    expect((await send({ b: body({ mimeType: 'audio/webm;codecs=opus' }) })).status).toBe(200);
  });
});

describe('transcription', () => {
  it('sends the audio to Groq first, English, temperature 0, and returns the text', async () => {
    const r = await send();
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ text: 'I led a small team.', provider: 'groq' });
    const calls = sttCalls(r.fetchImpl);
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0];
    expect(String(url)).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
    expect(init.headers.Authorization).toBe('Bearer gsk-SECRET');
    const form = init.body;
    expect(form.get('model')).toBe('whisper-large-v3-turbo');
    expect(form.get('language')).toBe('en');
    expect(form.get('temperature')).toBe('0');
    expect(form.get('file')).toBeInstanceOf(Blob);
  });
  it('falls back to OpenAI when Groq is busy (429), is down (5xx) or rejects our key (401)', async () => {
    for (const status of [429, 503, 401]) {
      const r = await send({ fetchImpl: makeFetch({ groq: () => ok({ error: { message: 'x' } }, status) }) });
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ text: 'From OpenAI.', provider: 'openai' });
      expect(String(sttCalls(r.fetchImpl)[1][0])).toBe('https://api.openai.com/v1/audio/transcriptions');
      expect(sttCalls(r.fetchImpl)[1][1].body.get('model')).toBe('gpt-4o-mini-transcribe');
    }
  });
  it('falls back on a network error', async () => {
    const r = await send({ fetchImpl: makeFetch({ groq: () => { throw new Error('network'); } }) });
    expect(r.body.provider).toBe('openai');
  });
  it('does not retry another provider when the audio itself is rejected (400)', async () => {
    const r = await send({ fetchImpl: makeFetch({ groq: () => ok({ error: { message: 'bad audio' } }, 400) }) });
    expect(r.status).toBe(422);
    expect(sttCalls(r.fetchImpl)).toHaveLength(1);
  });
  it('uses only the providers that have a key', async () => {
    const r = await send({ env: { ...ENV, GROQ_API_KEY: '' } });
    expect(r.body.provider).toBe('openai');
    expect(sttCalls(r.fetchImpl)).toHaveLength(1);
  });
  it('500 "not configured" when no provider has a key', async () => {
    const r = await send({ env: { ...ENV, GROQ_API_KEY: '', OPENAI_API_KEY: '' } });
    expect(r.status).toBe(500);
  });
  it('502 when every provider fails, without leaking a key or a provider message', async () => {
    const f = () => ok({ error: { message: 'internal sk-SECRET detail' } }, 503);
    const r = await send({ fetchImpl: makeFetch({ groq: f, openai: f }) });
    expect(r.status).toBe(502);
    expect(r.raw).not.toMatch(/SECRET|internal/);
  });
  it('422 "no speech heard" when the transcript is empty, and says so plainly', async () => {
    const r = await send({ fetchImpl: makeFetch({ groq: () => ok({ text: '   ' }) }) });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toMatch(/speech|hear/i);
    expect(sttCalls(r.fetchImpl)).toHaveLength(1); // empty is an answer, not a provider failure
  });
  it('caps the transcript length', async () => {
    const r = await send({ fetchImpl: makeFetch({ groq: () => ok({ text: 'word '.repeat(5000) }) }) });
    expect(r.body.text.length).toBeLessThanOrEqual(LIMITS.maxTranscriptChars);
  });
});

describe('nothing is kept (V3)', () => {
  it('logs only the provider, the audio length and the outcome: no audio, no text, no user id, no key', async () => {
    const logs = [];
    await send({ logs });
    const all = JSON.stringify(logs);
    expect(all).toContain('voice_transcribe');
    expect(all).toContain('groq');
    expect(all).not.toMatch(/user-1|SECRET|led a small team|fake-audio|AAAA/);
    expect(all).not.toContain(AUDIO);
  });
  it('marks its log line so the usage report can read it', async () => {
    const logs = [];
    await send({ logs });
    expect(logs[0]).toMatchObject({ event: 'voice_usage', feature: 'voice_transcribe', provider: 'groq', outcome: 'success', audioSec: 12 });
  });
  it('never echoes the audio back', async () => {
    const r = await send();
    expect(r.raw).not.toContain(AUDIO);
  });
});

describe('rate limit', () => {
  it('429 after too many requests in a window', async () => {
    const limiter = createRateLimiter({ max: 2 });
    const run = () => handleRequest(new Request('https://x/transcribe', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(body()) }), { env: ENV, fetchImpl: makeFetch(), limiter, log: () => {} });
    expect((await run()).status).toBe(200);
    expect((await run()).status).toBe(200);
    expect((await run()).status).toBe(429);
  });
});
