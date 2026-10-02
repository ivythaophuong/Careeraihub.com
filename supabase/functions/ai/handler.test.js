// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRequest, createRateLimiter, LIMITS } from './handler.js';
import { pickProvider, resolveModel } from './providers.js';

const ENV = {
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  ANTHROPIC_API_KEY: 'sk-ant-SECRET',
  AI_PROVIDER: 'anthropic',
};

const ok = (body, status = 200) => new Response(JSON.stringify(body), { status });

// Routes fetches: auth server vs provider.
function makeFetch({ user = { id: 'user-1' }, authStatus = 200, provider = () => ok({ content: [{ type: 'text', text: 'hello' }] }) } = {}) {
  return vi.fn(async (url, init) => {
    if (String(url).includes('/auth/v1/user')) return authStatus === 200 ? ok(user) : ok({ msg: 'bad jwt' }, authStatus);
    return provider(url, init);
  });
}

const call = (body, { headers = {}, method = 'POST', env = ENV, fetchImpl = makeFetch(), limiter } = {}) =>
  handleRequest(
    new Request('https://proj.supabase.co/functions/v1/ai', {
      method,
      headers: { authorization: 'Bearer user-jwt', 'content-type': 'application/json', ...headers },
      body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }),
    { env, fetchImpl, limiter: limiter || createRateLimiter() },
  ).then(async r => ({ status: r.status, headers: r.headers, body: r.status === 204 ? null : await r.json() }));

const VALID = { messages: [{ role: 'user', content: 'hi' }], maxTokens: 100 };

describe('authentication', () => {
  it('rejects a request with no Authorization header', async () => {
    const r = await call(VALID, { headers: { authorization: '' } });
    expect(r.status).toBe(401);
  });

  it('rejects a token the auth server does not accept', async () => {
    const f = makeFetch({ authStatus: 401 });
    const r = await call(VALID, { fetchImpl: f });
    expect(r.status).toBe(401);
    expect(f.mock.calls.some(([u]) => String(u).includes('anthropic'))).toBe(false); // never reached the provider
  });

  it('rejects the public anon key (valid JWT, but no user)', async () => {
    const f = makeFetch({ user: { role: 'anon' } });
    const r = await call(VALID, { fetchImpl: f });
    expect(r.status).toBe(401);
  });

  it('rejects when the auth server is unreachable', async () => {
    const f = vi.fn(async () => { throw new Error('down'); });
    expect((await call(VALID, { fetchImpl: f })).status).toBe(401);
  });

  it('asks the auth server with the caller token and the anon apikey', async () => {
    const f = makeFetch();
    await call(VALID, { fetchImpl: f });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://proj.supabase.co/auth/v1/user');
    expect(init.headers).toEqual({ Authorization: 'Bearer user-jwt', apikey: 'anon-key' });
  });
});

describe('request handling', () => {
  it('answers CORS preflight without needing a login', async () => {
    const r = await call(null, { method: 'OPTIONS', headers: { authorization: '' } });
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-headers')).toContain('authorization');
  });

  it('restricts the allowed origin when ALLOWED_ORIGINS is set', async () => {
    const env = { ...ENV, ALLOWED_ORIGINS: 'https://careeraihub.com,https://www.careeraihub.com' };
    const ok1 = await call(VALID, { env, headers: { origin: 'https://careeraihub.com' } });
    expect(ok1.headers.get('access-control-allow-origin')).toBe('https://careeraihub.com');
    const evil = await call(VALID, { env, headers: { origin: 'https://evil.example' } });
    expect(evil.headers.get('access-control-allow-origin')).toBe('https://careeraihub.com');
  });

  it('rejects non-POST methods', async () => {
    expect((await call(null, { method: 'GET' })).status).toBe(405);
  });

  it.each([
    ['not JSON', 'nope'],
    ['no messages', { maxTokens: 5 }],
    ['empty messages', { messages: [] }],
    ['bad role', { messages: [{ role: 'system', content: 'x' }] }],
    ['non-string content', { messages: [{ role: 'user', content: 5 }] }],
    ['no user message', { messages: [{ role: 'assistant', content: 'x' }] }],
    ['bad maxTokens', { ...VALID, maxTokens: -3 }],
    ['invalid base64', { ...VALID, pdfBase64: 'not base64!!' }],
  ])('400 for invalid input: %s', async (_name, body) => {
    expect((await call(body)).status).toBe(400);
  });

  it('400 for a prompt over the size limit', async () => {
    const r = await call({ messages: [{ role: 'user', content: 'x'.repeat(LIMITS.maxPromptChars + 1) }] });
    expect(r.status).toBe(400);
  });

  it('413 when the declared body is too large', async () => {
    const r = await call(VALID, { headers: { 'content-length': String(LIMITS.maxBodyBytes + 1) } });
    expect(r.status).toBe(413);
  });
});

describe('rate limiting', () => {
  it('allows up to the limit then returns 429 with Retry-After', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    expect((await call(VALID, { limiter })).status).toBe(200);
    expect((await call(VALID, { limiter })).status).toBe(200);
    const r = await call(VALID, { limiter });
    expect(r.status).toBe(429);
    expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('limits per user, not globally', async () => {
    const limiter = createRateLimiter({ max: 1 });
    expect((await call(VALID, { limiter, fetchImpl: makeFetch({ user: { id: 'a' } }) })).status).toBe(200);
    expect((await call(VALID, { limiter, fetchImpl: makeFetch({ user: { id: 'b' } }) })).status).toBe(200);
    expect((await call(VALID, { limiter, fetchImpl: makeFetch({ user: { id: 'a' } }) })).status).toBe(429);
  });

  it('forgets old hits once the window passes', () => {
    const l = createRateLimiter({ windowMs: 1000, max: 1 });
    expect(l.check('u', 0).ok).toBe(true);
    expect(l.check('u', 500).ok).toBe(false);
    expect(l.check('u', 1001).ok).toBe(true);
  });
});

describe('provider call', () => {
  it('returns { text } and uses the server-held key, never one from the client', async () => {
    const f = makeFetch();
    const r = await call({ ...VALID, provider: 'openai', model: 'gpt-4o', apiKey: 'client-key' }, { fetchImpl: f });
    expect(r).toMatchObject({ status: 200, body: { text: 'hello' } });
    const [url, init] = f.mock.calls.find(([u]) => !String(u).includes('/auth/'));
    expect(url).toBe('https://api.anthropic.com/v1/messages'); // client-chosen provider ignored
    expect(init.headers['x-api-key']).toBe('sk-ant-SECRET');
    expect(JSON.parse(init.body).model).toBe('claude-sonnet-5-5'); // client-chosen model ignored
  });

  it('clamps maxTokens to the cap', async () => {
    const f = makeFetch();
    await call({ ...VALID, maxTokens: 999999 }, { fetchImpl: f });
    const init = f.mock.calls.find(([u]) => !String(u).includes('/auth/'))[1];
    expect(JSON.parse(init.body).max_tokens).toBe(LIMITS.maxTokensCap);
  });

  it('forwards the PDF to Anthropic as a document block', async () => {
    const f = makeFetch();
    await call({ ...VALID, pdfBase64: 'QUJD' }, { fetchImpl: f });
    const init = f.mock.calls.find(([u]) => !String(u).includes('/auth/'))[1];
    expect(JSON.parse(init.body).messages[0].content[0]).toMatchObject({ type: 'document', source: { data: 'QUJD' } });
  });

  it('uses Gemini and OpenAI when configured', async () => {
    const g = makeFetch({ provider: () => ok({ candidates: [{ content: { parts: [{ text: 'g' }] } }] }) });
    const rg = await call(VALID, { env: { ...ENV, AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'gk' }, fetchImpl: g });
    expect(rg.body.text).toBe('g');
    expect(g.mock.calls.at(-1)[1].headers['x-goog-api-key']).toBe('gk');
    const o = makeFetch({ provider: () => ok({ choices: [{ message: { content: 'o' }, finish_reason: 'stop' }] }) });
    const ro = await call(VALID, { env: { ...ENV, AI_PROVIDER: 'openai', OPENAI_API_KEY: 'ok' }, fetchImpl: o });
    expect(ro.body.text).toBe('o');
  });

  it('turns off Gemini flash "thinking" so hidden tokens cannot cut the answer off', async () => {
    const run = async (model) => {
      const f = makeFetch({ provider: () => ok({ candidates: [{ content: { parts: [{ text: 'g' }] } }] }) });
      await call(VALID, { env: { ...ENV, AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'gk', AI_MODEL: model }, fetchImpl: f });
      return JSON.parse(f.mock.calls.at(-1)[1].body).generationConfig;
    };
    expect((await run('gemini-2.5-flash')).thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect((await run(undefined)).thinkingConfig).toEqual({ thinkingBudget: 0 }); // default model is flash
    expect((await run('gemini-2.5-pro')).thinkingConfig).toBeUndefined();
  });

  it('500 "not configured" when no provider key exists', async () => {
    const r = await call(VALID, { env: { SUPABASE_URL: ENV.SUPABASE_URL, SUPABASE_ANON_KEY: 'a' } });
    expect(r).toMatchObject({ status: 500, body: { error: { message: 'AI service is not configured.' } } });
  });
});

describe('provider failures', () => {
  const failing = (status, body) => makeFetch({ provider: () => ok(body, status) });

  it('maps a truncated reply to 422 with truncated:true', async () => {
    const f = makeFetch({ provider: () => ok({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{' }] }) });
    const r = await call(VALID, { fetchImpl: f });
    expect(r).toMatchObject({ status: 422, body: { error: { truncated: true } } });
  });

  it('maps provider rate limits to 429', async () => {
    const r = await call(VALID, { fetchImpl: failing(429, { error: { message: 'slow down' } }) });
    expect(r.status).toBe(429);
  });

  it('maps provider outages to 502', async () => {
    expect((await call(VALID, { fetchImpl: failing(503, { error: { message: 'down' } }) })).status).toBe(502);
  });

  it('hides a bad-credentials failure behind a generic 500 and never leaks the key', async () => {
    const r = await call(VALID, { fetchImpl: failing(401, { error: { message: 'invalid x-api-key sk-ant-SECRET' } }) });
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toContain('sk-ant-SECRET');
    expect(r.body.error.message).toBe('AI service is misconfigured.');
  });

  it('passes through a safe 4xx message (e.g. unreadable PDF)', async () => {
    const r = await call(VALID, { fetchImpl: failing(400, { error: { message: 'Could not process PDF' } }) });
    expect(r).toMatchObject({ status: 400, body: { error: { message: 'Could not process PDF' } } });
  });

  it('maps a network failure to 502', async () => {
    const f = vi.fn(async (url) => { if (String(url).includes('/auth/')) return ok({ id: 'u' }); throw new TypeError('fetch failed'); });
    expect((await call(VALID, { fetchImpl: f })).status).toBe(502);
  });
});

describe('providers helpers', () => {
  it('pickProvider honours AI_PROVIDER only when it has a key, else first keyed provider', () => {
    expect(pickProvider({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'k' })).toBe('openai');
    expect(pickProvider({ AI_PROVIDER: 'openai', GEMINI_API_KEY: 'k' })).toBeNull();
    expect(pickProvider({ GEMINI_API_KEY: 'k' })).toBe('gemini');
    expect(pickProvider({})).toBeNull();
  });
  it('resolveModel falls back on a mismatched model', () => {
    expect(resolveModel('anthropic', 'gpt-4o')).toBe('claude-sonnet-5-5');
    expect(resolveModel('anthropic', 'claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5-20251001');
  });
});
