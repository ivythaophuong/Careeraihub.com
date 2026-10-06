// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRequest, createRateLimiter, LIMITS } from './handler.js';
import { pickProvider, resolveModel, buildRoutes, createHealth, parseRouteEntry, MAX_CHAIN } from './providers.js';

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

// Tests never really sleep: retries are instant and jitter is zero, so timing is deterministic.
const FAST = { sleep: async () => {}, jitter: () => 0 };
const providerCalls = (f) => f.mock.calls.filter(([u]) => !String(u).includes('/auth/')).length;

const call = (body, { headers = {}, method = 'POST', env = ENV, fetchImpl = makeFetch(), limiter, retry = FAST, health = createHealth(), now } = {}) =>
  handleRequest(
    new Request('https://proj.supabase.co/functions/v1/ai', {
      method,
      headers: { authorization: 'Bearer user-jwt', 'content-type': 'application/json', ...headers },
      body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }),
    { env, fetchImpl, limiter: limiter || createRateLimiter(), retry, health, ...(now && { now }) },
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

  it('turns off thinking only for 2.5 Flash, and leaves token headroom for other Gemini models', async () => {
    const run = async (model, maxTokens = 1800) => {
      const f = makeFetch({ provider: () => ok({ candidates: [{ content: { parts: [{ text: 'g' }] } }] }) });
      await call({ ...VALID, maxTokens }, { env: { ...ENV, AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'gk', AI_MODEL: model }, fetchImpl: f });
      return JSON.parse(f.mock.calls.at(-1)[1].body).generationConfig;
    };
    expect(await run('gemini-2.5-flash')).toMatchObject({ maxOutputTokens: 1800, thinkingConfig: { thinkingBudget: 0 } });
    const newer = await run('gemini-3.8-flash');
    expect(newer.thinkingConfig).toBeUndefined();   // an unverified setting could be rejected by a newer model
    expect(newer.maxOutputTokens).toBe(4096);       // headroom for hidden thinking
    expect((await run('gemini-3.8-flash', 3000)).maxOutputTokens).toBe(6000);
    expect((await run('gemini-3.8-flash', 8192)).maxOutputTokens).toBe(8192); // never above the cap
    expect((await run('gemini-2.5-pro')).thinkingConfig).toBeUndefined();
    expect((await run(undefined)).thinkingConfig).toBeUndefined(); // default model is the current one
  });

  it('tolerates stray spaces or newlines in pasted settings', async () => {
    const f = makeFetch({ provider: () => ok({ candidates: [{ content: { parts: [{ text: 'g' }] } }] }) });
    const r = await call(VALID, { env: { ...ENV, AI_PROVIDER: ' Gemini\n', GEMINI_API_KEY: '  gk-with-space \n', AI_MODEL: ' gemini-3.8-flash ' }, fetchImpl: f });
    expect(r).toMatchObject({ status: 200, body: { text: 'g' } });
    const [url, init] = f.mock.calls.at(-1);
    expect(url).toContain('/models/gemini-3.8-flash:');
    expect(init.headers['x-goog-api-key']).toBe('gk-with-space');
  });

  it('treats a blank or whitespace-only key as not configured and says which settings it saw (no values)', async () => {
    const r = await call(VALID, { env: { SUPABASE_URL: ENV.SUPABASE_URL, SUPABASE_ANON_KEY: 'a', AI_PROVIDER: 'gemini', GEMINI_API_KEY: '   ' } });
    expect(r.status).toBe(500);
    expect(r.body.error.diag).toEqual({ aiProvider: 'gemini', keysPresent: { anthropic: false, gemini: false, openai: false }, keyLengths: { anthropic: 0, gemini: 0, openai: 0 } });
  });

  it('the diagnostic never contains a secret value', async () => {
    const r = await call(VALID, { env: { SUPABASE_URL: ENV.SUPABASE_URL, SUPABASE_ANON_KEY: 'anon-key', AI_PROVIDER: 'openai', ANTHROPIC_API_KEY: 'sk-ant-SECRET' } });
    expect(r.body.error.diag.keysPresent).toEqual({ anthropic: true, gemini: false, openai: false });
    expect(JSON.stringify(r.body)).not.toContain('sk-ant-SECRET');
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
});

describe('retrying transient provider failures', () => {
  const OVERLOAD = 'This model is currently experiencing high demand. Spikes in demand are usually temporary.';
  const sequence = (...results) => { let i = 0; return makeFetch({ provider: () => results[Math.min(i++, results.length - 1)]() }); };
  const fail = (status, message = 'x', headers) => () => new Response(JSON.stringify({ error: { message } }), { status, headers });
  const good = () => ok({ content: [{ type: 'text', text: 'recovered' }] });

  it('recovers from a brief overload without the user seeing an error', async () => {
    const f = sequence(fail(503, OVERLOAD), good);
    const r = await call(VALID, { fetchImpl: f });
    expect(r).toMatchObject({ status: 200, body: { text: 'recovered' } });
    expect(providerCalls(f)).toBe(2);
  });

  it('gives up after 3 attempts on a lasting overload, with a plain message instead of the provider text', async () => {
    const f = sequence(fail(503, OVERLOAD));
    const r = await call(VALID, { fetchImpl: f });
    expect(providerCalls(f)).toBe(3);
    expect(r).toMatchObject({ status: 503, body: { error: { code: 'busy' } } });
    expect(r.body.error.message).toMatch(/busy right now/i);
    expect(JSON.stringify(r.body)).not.toContain('high demand');
  });

  it('retries a 429, waits at least the provider Retry-After, then reports rate_limited if it persists', async () => {
    const sleep = vi.fn(async () => {});
    const f = sequence(fail(429, 'slow', { 'retry-after': '2' }));
    const r = await call(VALID, { fetchImpl: f, retry: { sleep, jitter: () => 0 } });
    expect(providerCalls(f)).toBe(3);
    expect(sleep.mock.calls[0][0]).toBeGreaterThanOrEqual(2000);
    expect(r).toMatchObject({ status: 429, body: { error: { code: 'rate_limited' } } });
  });

  it('caps an absurd Retry-After so the user never waits minutes', async () => {
    const sleep = vi.fn(async () => {});
    await call(VALID, { fetchImpl: sequence(fail(429, 'slow', { 'retry-after': '600' })), retry: { sleep, jitter: () => 0 } });
    expect(Math.max(...sleep.mock.calls.map(c => c[0]))).toBeLessThanOrEqual(5000);
  });

  it('retries a network failure and reports it as busy', async () => {
    const f = vi.fn(async (url) => { if (String(url).includes('/auth/')) return ok({ id: 'u' }); throw new TypeError('fetch failed'); });
    const r = await call(VALID, { fetchImpl: f });
    expect(providerCalls(f)).toBe(3);
    expect(r).toMatchObject({ status: 503, body: { error: { code: 'busy' } } });
  });

  it('retries a timeout and reports it as timeout', async () => {
    const f = vi.fn(async (url) => { if (String(url).includes('/auth/')) return ok({ id: 'u' }); throw Object.assign(new Error('aborted'), { name: 'AbortError' }); });
    const r = await call(VALID, { fetchImpl: f });
    expect(providerCalls(f)).toBe(3);
    expect(r).toMatchObject({ status: 503, body: { error: { code: 'timeout' } } });
    expect(r.body.error.message).toMatch(/took too long/i);
  });

  it('retries an empty reply once it is clear it can recover', async () => {
    const f = sequence(() => ok({ content: [] }), good);
    expect((await call(VALID, { fetchImpl: f })).body.text).toBe('recovered');
    expect(providerCalls(f)).toBe(2);
  });

  it('stops retrying when the time budget would be exceeded', async () => {
    const f = sequence(fail(503, OVERLOAD));
    const r = await call(VALID, { fetchImpl: f, retry: { ...FAST, budgetMs: 5000 } });
    expect(providerCalls(f)).toBe(2); // third attempt would not fit in the budget
    expect(r.status).toBe(503);
  });
});

describe('timeout tuning from secrets', () => {
  const slow = () => vi.fn(async (url, init) => {
    if (String(url).includes('/auth/')) return ok({ id: 'u' });
    return new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  });

  it('gives each attempt the configured number of seconds before timing out', async () => {
    vi.useFakeTimers();
    const f = slow();
    const p = call(VALID, { fetchImpl: f, env: { ...ENV, AI_ATTEMPT_TIMEOUT_SECONDS: '12', AI_TOTAL_TIMEOUT_SECONDS: '15' } });
    await vi.advanceTimersByTimeAsync(12_000);
    const r = await p;
    vi.useRealTimers();
    expect(r).toMatchObject({ status: 503, body: { error: { code: 'timeout' } } });
    expect(providerCalls(f)).toBe(1); // 12s used of a 15s budget: no time left for another attempt
  });

  it('ignores nonsense or out-of-range values and keeps the defaults', async () => {
    for (const bad of ['abc', '0', '-5', '9999', '']) {
      const f = makeFetch({ provider: () => ok({ content: [{ type: 'text', text: 'fine' }] }) });
      const r = await call(VALID, { fetchImpl: f, env: { ...ENV, AI_ATTEMPT_TIMEOUT_SECONDS: bad, AI_TOTAL_TIMEOUT_SECONDS: bad } });
      expect(r.status).toBe(200);
    }
  });
});

describe('failures that must NOT be retried', () => {
  const failOnce = (status, body) => makeFetch({ provider: () => ok(body, status) });

  it('does not retry a bad API key (and says so without leaking it)', async () => {
    const f = failOnce(401, { error: { message: 'invalid x-api-key sk-ant-SECRET' } });
    const r = await call(VALID, { fetchImpl: f });
    expect(providerCalls(f)).toBe(1);
    expect(r).toMatchObject({ status: 500, body: { error: { code: 'misconfigured' } } });
    expect(JSON.stringify(r.body)).not.toContain('sk-ant-SECRET');
  });

  it('does not retry a 403', async () => {
    const f = failOnce(403, { error: { message: 'forbidden' } });
    await call(VALID, { fetchImpl: f });
    expect(providerCalls(f)).toBe(1);
  });

  it('does not retry a bad request', async () => {
    const f = failOnce(400, { error: { message: 'Could not process PDF' } });
    const r = await call(VALID, { fetchImpl: f });
    expect(providerCalls(f)).toBe(1);
    expect(r).toMatchObject({ status: 400, body: { error: { code: 'bad_request', message: 'Could not process PDF' } } });
  });

  it('does not retry a reply cut off at the length limit', async () => {
    const f = failOnce(200, { stop_reason: 'max_tokens', content: [{ type: 'text', text: '{' }] });
    const r = await call(VALID, { fetchImpl: f });
    expect(providerCalls(f)).toBe(1);
    expect(r).toMatchObject({ status: 422, body: { error: { truncated: true, code: 'truncated' } } });
  });
});

describe('call logging', () => {
  it('logs one line per call with provider, model, attempts and timing, and no secrets or content', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const f = makeFetch({ provider: (() => { let n = 0; return () => (n++ === 0 ? new Response(JSON.stringify({ error: { message: 'down' } }), { status: 503 }) : ok({ content: [{ type: 'text', text: 'SECRET-ANSWER' }] })); })() });
    await call({ messages: [{ role: 'user', content: 'PRIVATE-PROMPT' }], maxTokens: 50 }, { fetchImpl: f });
    const lines = log.mock.calls.map(c => String(c[0])).filter(l => l.includes('ai_call'));
    log.mockRestore();
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ evt: 'ai_call', provider: 'anthropic', ok: true, attempts: 2 });
    for (const secret of ['sk-ant-SECRET', 'PRIVATE-PROMPT', 'SECRET-ANSWER', 'user-jwt']) expect(lines[0]).not.toContain(secret);
  });

  it('logs the failure code when every attempt fails', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await call(VALID, { fetchImpl: makeFetch({ provider: () => ok({ error: { message: 'down' } }, 503) }) });
    const line = JSON.parse(log.mock.calls.map(c => String(c[0])).find(l => l.includes('ai_call')));
    log.mockRestore();
    expect(line).toMatchObject({ ok: false, status: 503, code: 'busy', attempts: 3 });
  });
});

const TWO = { ...ENV, GEMINI_API_KEY: 'gem-SECRET', AI_PROVIDER: 'gemini', AI_FALLBACK: 'anthropic' };
const byHost = ({ gemini, anthropic }) => makeFetch({
  provider: (url, init) => (String(url).includes('generativelanguage') ? gemini(url, init) : anthropic(url, init)),
});
const gemOk = () => ok({ candidates: [{ content: { parts: [{ text: 'from-gemini' }] }, finishReason: 'STOP' }] });
const antOk = () => ok({ content: [{ type: 'text', text: 'from-claude' }] });
const status = (code, message = 'x') => () => ok({ error: { message } }, code);
const callsTo = (f, host) => f.mock.calls.filter(([u]) => String(u).includes(host)).length;

describe('building the route chain', () => {
  it('parses provider and provider:model, and rejects unknown providers', () => {
    expect(parseRouteEntry(' Gemini:gemini-2.5-flash ')).toEqual({ provider: 'gemini', model: 'gemini-2.5-flash' });
    expect(parseRouteEntry('anthropic')).toEqual({ provider: 'anthropic', model: null });
    expect(parseRouteEntry('openai:ft:gpt-4o:org')).toEqual({ provider: 'openai', model: 'ft:gpt-4o:org' });
    expect(parseRouteEntry('mistral')).toBeNull();
    expect(parseRouteEntry('')).toBeNull();
  });

  it('is primary then AI_FALLBACK entries, each with its own key', () => {
    const r = buildRoutes({ ...TWO, AI_MODEL: 'gemini-2.5-flash' });
    expect(r.map(x => x.id)).toEqual(['gemini:gemini-2.5-flash', 'anthropic:claude-sonnet-5-5']);
    expect(r[0].key).toBe('gem-SECRET');
    expect(r[1].key).toBe('sk-ant-SECRET');
  });

  it('skips entries with no key, unknown providers and duplicates instead of failing', () => {
    const r = buildRoutes({ ...TWO, AI_FALLBACK: 'openai, mistral, gemini, anthropic, anthropic' });
    expect(r.map(x => x.provider)).toEqual(['gemini', 'anthropic']); // openai has no key; duplicates dropped
  });

  it('uses the provider default when a fallback model name belongs to another provider', () => {
    const r = buildRoutes({ ...TWO, AI_FALLBACK: 'anthropic:gemini-2.5-flash' });
    expect(r[1].model).toBe('claude-sonnet-5-5');
  });

  it(`never builds a chain longer than ${MAX_CHAIN}`, () => {
    const env = { ...TWO, OPENAI_API_KEY: 'oa', AI_FALLBACK: 'anthropic:claude-a,anthropic:claude-b,openai' };
    expect(buildRoutes(env)).toHaveLength(MAX_CHAIN);
  });

  it('AI_ROUTES overrides the chain per task and falls back to its default entry', () => {
    const env = { ...TWO, OPENAI_API_KEY: 'oa', AI_ROUTES: JSON.stringify({ default: ['gemini'], interview_eval: ['anthropic', 'gemini'] }) };
    expect(buildRoutes(env, 'interview_eval').map(x => x.provider)).toEqual(['anthropic', 'gemini']);
    expect(buildRoutes(env, 'star').map(x => x.provider)).toEqual(['gemini']);
    expect(buildRoutes(env).map(x => x.provider)).toEqual(['gemini']);
  });

  it('ignores a broken AI_ROUTES and uses the normal chain', () => {
    expect(buildRoutes({ ...TWO, AI_ROUTES: '{not json' }).map(x => x.provider)).toEqual(['gemini', 'anthropic']);
    expect(buildRoutes({ ...TWO, AI_ROUTES: '[1,2]' }).map(x => x.provider)).toEqual(['gemini', 'anthropic']);
  });

  it('is empty when no keyed provider is configured', () => {
    expect(buildRoutes({ AI_PROVIDER: 'gemini' })).toEqual([]);
  });
});

describe('routing between providers', () => {
  it('serves the request from the fallback when the primary stays overloaded', async () => {
    const f = byHost({ gemini: status(503, 'high demand'), anthropic: antOk });
    const r = await call(VALID, { env: TWO, fetchImpl: f });
    expect(r).toMatchObject({ status: 200, body: { text: 'from-claude' } });
    expect(callsTo(f, 'generativelanguage')).toBe(2); // fewer retries when a fallback is waiting
    expect(callsTo(f, 'anthropic')).toBe(1);
  });

  it('does not touch the fallback when the primary works', async () => {
    const f = byHost({ gemini: gemOk, anthropic: antOk });
    expect((await call(VALID, { env: TWO, fetchImpl: f })).body.text).toBe('from-gemini');
    expect(callsTo(f, 'anthropic')).toBe(0);
  });

  it('reports busy only after every route has failed, using all retries on the last one', async () => {
    const f = byHost({ gemini: status(503), anthropic: status(529) });
    const r = await call(VALID, { env: TWO, fetchImpl: f });
    expect(r).toMatchObject({ status: 503, body: { error: { code: 'busy' } } });
    expect(callsTo(f, 'generativelanguage')).toBe(2);
    expect(callsTo(f, 'anthropic')).toBe(3);
  });

  it('does NOT fall back on a bad request: another model will not fix it', async () => {
    const f = byHost({ gemini: status(400, 'Could not process PDF'), anthropic: antOk });
    const r = await call(VALID, { env: TWO, fetchImpl: f });
    expect(r).toMatchObject({ status: 400, body: { error: { code: 'bad_request' } } });
    expect(callsTo(f, 'anthropic')).toBe(0);
  });

  it('does NOT fall back on a reply cut off at the length limit', async () => {
    const cut = () => ok({ candidates: [{ content: { parts: [{ text: '{' }] }, finishReason: 'MAX_TOKENS' }] });
    const f = byHost({ gemini: cut, anthropic: antOk });
    const r = await call(VALID, { env: TWO, fetchImpl: f });
    expect(r.status).toBe(422);
    expect(callsTo(f, 'anthropic')).toBe(0);
  });

  it('falls back when the primary key is rejected, and tells nobody the key', async () => {
    const f = byHost({ gemini: status(403, 'API key gem-SECRET invalid'), anthropic: antOk });
    const r = await call(VALID, { env: TWO, fetchImpl: f });
    expect(r.body.text).toBe('from-claude');
    expect(callsTo(f, 'generativelanguage')).toBe(1); // a bad key is not retried
  });

  it('is "misconfigured" only when every route has a bad key', async () => {
    const f = byHost({ gemini: status(403), anthropic: status(401, 'sk-ant-SECRET') });
    const r = await call(VALID, { env: TWO, fetchImpl: f });
    expect(r).toMatchObject({ status: 500, body: { error: { code: 'misconfigured' } } });
    expect(JSON.stringify(r.body)).not.toMatch(/SECRET/);
  });

  it('prefers telling the user "busy" over "misconfigured" when one route was merely overloaded', async () => {
    const f = byHost({ gemini: status(503), anthropic: status(401) });
    expect((await call(VALID, { env: TWO, fetchImpl: f })).body.error.code).toBe('busy');
  });

  it('remembers a failing route: the next request goes to the healthy one first', async () => {
    const health = createHealth();
    const f = byHost({ gemini: status(503), anthropic: antOk });
    await call(VALID, { env: TWO, fetchImpl: f, health });
    const g1 = callsTo(f, 'generativelanguage');
    const r = await call(VALID, { env: TWO, fetchImpl: f, health });
    expect(r.body.text).toBe('from-claude');
    expect(callsTo(f, 'generativelanguage')).toBe(g1); // not retried again while it is cooling down
  });

  it('tries the primary first again once its cooldown has passed', async () => {
    const health = createHealth({ cooldownMs: 60_000 });
    let clock = 1_000_000;
    const f = byHost({ gemini: status(503), anthropic: antOk });
    await call(VALID, { env: TWO, fetchImpl: f, health, now: () => clock });
    clock += 61_000;
    const f2 = byHost({ gemini: gemOk, anthropic: antOk });
    expect((await call(VALID, { env: TWO, fetchImpl: f2, health, now: () => clock })).body.text).toBe('from-gemini');
  });

  it('still uses a route that is cooling down when it is the only one left', async () => {
    const health = createHealth();
    await call(VALID, { env: TWO, fetchImpl: byHost({ gemini: status(503), anthropic: status(503) }), health });
    const r = await call(VALID, { env: TWO, fetchImpl: byHost({ gemini: gemOk, anthropic: status(503) }), health });
    expect(r.body.text).toBe('from-gemini');
  });
});

describe('routing by task', () => {
  const ENV_T = { ...TWO, AI_ROUTES: JSON.stringify({ default: ['gemini'], interview_eval: ['anthropic', 'gemini'] }) };

  it('sends a labelled task down its own chain and everything else down the default', async () => {
    const f1 = byHost({ gemini: gemOk, anthropic: antOk });
    expect((await call({ ...VALID, task: 'interview_eval' }, { env: ENV_T, fetchImpl: f1 })).body.text).toBe('from-claude');
    const f2 = byHost({ gemini: gemOk, anthropic: antOk });
    expect((await call(VALID, { env: ENV_T, fetchImpl: f2 })).body.text).toBe('from-gemini');
  });

  it('treats an unknown or non-string task as general', async () => {
    for (const task of ['drop-tables', 42, null, { a: 1 }]) {
      const f = byHost({ gemini: gemOk, anthropic: antOk });
      expect((await call({ ...VALID, task }, { env: ENV_T, fetchImpl: f })).body.text).toBe('from-gemini');
    }
  });

  it('ignores a provider or model named by the caller', async () => {
    const f = byHost({ gemini: gemOk, anthropic: antOk });
    const r = await call({ ...VALID, provider: 'anthropic', model: 'claude-opus-expensive' }, { env: ENV_T, fetchImpl: f });
    expect(r.body.text).toBe('from-gemini');
    expect(callsTo(f, 'anthropic')).toBe(0);
  });
});

describe('routing logs', () => {
  it('never writes a caller-supplied task name into the logs: unknown labels are logged as general', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await call({ ...VALID, task: 'x'.repeat(5000) + '\n{"evt":"forged"}' }, { env: TWO, fetchImpl: byHost({ gemini: gemOk, anthropic: antOk }) });
    const lines = log.mock.calls.map(c => String(c[0])).filter(l => l.includes('ai_call'));
    log.mockRestore();
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).task).toBe('general');
    expect(lines[0].length).toBeLessThan(500);
  });

  it('records the task, the route used, whether a fallback was needed and what was tried', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await call({ ...VALID, task: 'star' }, { env: TWO, fetchImpl: byHost({ gemini: status(503), anthropic: antOk }) });
    const line = JSON.parse(log.mock.calls.map(c => String(c[0])).find(l => l.includes('ai_call')));
    log.mockRestore();
    expect(line).toMatchObject({ task: 'star', provider: 'anthropic', ok: true, fallback: true });
    expect(line.tried[0]).toMatch(/^gemini:.*!$/); // '!' marks a route that failed
    expect(JSON.stringify(line)).not.toMatch(/SECRET/);
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
