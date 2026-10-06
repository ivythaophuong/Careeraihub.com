import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./session', () => ({ getValidSession: vi.fn() }));
import { getValidSession } from './session';

// ai.jsx reads import.meta.env at module load, so each test re-imports after stubbing.
async function loadAi() {
  vi.resetModules();
  vi.stubEnv('VITE_LLM_RETRY_DELAY_MS', '0');
  return import('./ai.jsx');
}

const res = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const msg = [{ role: 'user', content: 'hi' }];
const bodyOf = (fetchMock, n = 0) => JSON.parse(fetchMock.mock.calls[n][1].body);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  getValidSession.mockResolvedValue({ access_token: 'user-jwt' });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('extractJSON', () => {
  it('parses plain JSON', async () => {
    const { extractJSON } = await loadAi();
    expect(extractJSON('{"a":1}')).toEqual({ a: 1 });
  });
  it('strips ```json fences and surrounding prose', async () => {
    const { extractJSON } = await loadAi();
    expect(extractJSON('Here you go:\n```json\n{"score": 82, "tags": ["x"]}\n```\nDone.')).toEqual({ score: 82, tags: ['x'] });
  });
  it('returns an error object when there is no JSON', async () => {
    const { extractJSON } = await loadAi();
    expect(extractJSON('sorry, I cannot do that')).toMatchObject({ error: true });
  });
  it('returns an error object for truncated JSON', async () => {
    const { extractJSON } = await loadAi();
    expect(extractJSON('{"issues":[{"a":1},{"b":')).toMatchObject({ error: true });
  });
});

describe('callLLM → ai Edge Function', () => {
  it('posts messages, maxTokens and the PDF to the function with the user token', async () => {
    const { callLLM } = await loadAi();
    const f = vi.fn().mockResolvedValue(res({ text: 'hello' }));
    vi.stubGlobal('fetch', f);
    expect(await callLLM(msg, 500, 'BASE64PDF')).toBe('hello');
    const [url, init] = f.mock.calls[0];
    expect(url).toMatch(/\/functions\/v1\/ai$/);
    expect(init.headers.Authorization).toBe('Bearer user-jwt');
    expect(init.headers.apikey).toBeTruthy();
    expect(bodyOf(f)).toEqual({ messages: msg, maxTokens: 500, pdfBase64: 'BASE64PDF' });
  });

  it('sends only a task label, never a provider or model, when the caller names a task', async () => {
    const { callLLM } = await loadAi();
    const f = vi.fn().mockResolvedValue(res({ text: 'ok' }));
    vi.stubGlobal('fetch', f);
    await callLLM(msg, 100, null, { task: 'interview_eval' });
    expect(bodyOf(f)).toMatchObject({ task: 'interview_eval' });
    expect(Object.keys(bodyOf(f)).sort()).toEqual(['maxTokens', 'messages', 'task']);
  });

  it('omits pdfBase64 when there is no PDF', async () => {
    const { callLLM } = await loadAi();
    const f = vi.fn().mockResolvedValue(res({ text: 'ok' }));
    vi.stubGlobal('fetch', f);
    await callLLM(msg);
    expect(bodyOf(f)).not.toHaveProperty('pdfBase64');
    expect(bodyOf(f).maxTokens).toBe(8192);
  });

  it('never sends provider, model or any API key from the browser', async () => {
    const { callLLM } = await loadAi();
    const f = vi.fn().mockResolvedValue(res({ text: 'ok' }));
    vi.stubGlobal('fetch', f);
    await callLLM(msg, 100, 'AAAA');
    const sent = JSON.stringify([f.mock.calls[0][1].headers, f.mock.calls[0][1].body]).toLowerCase();
    for (const bad of ['x-api-key', 'x-goog-api-key', 'provider', 'model']) expect(sent).not.toContain(bad);
  });

  it('asks the user to sign in, without calling the network, when there is no session', async () => {
    getValidSession.mockResolvedValue(null);
    const { callLLM } = await loadAi();
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await expect(callLLM(msg)).rejects.toMatchObject({ status: 401, message: /sign in/i });
    expect(f).not.toHaveBeenCalled();
  });

  it('uses a freshly refreshed token (getValidSession is called per request)', async () => {
    getValidSession.mockResolvedValueOnce({ access_token: 'a' }).mockResolvedValueOnce({ access_token: 'b' });
    const { callLLM } = await loadAi();
    const f = vi.fn().mockResolvedValue(res({ text: 'ok' }));
    vi.stubGlobal('fetch', f);
    await callLLM(msg); await callLLM(msg);
    expect(f.mock.calls.map(c => c[1].headers.Authorization)).toEqual(['Bearer a', 'Bearer b']);
  });
});

describe('error handling (audit 2.4)', () => {
  it('does not retry an error the function reported: it already retried the provider', async () => {
    const { callLLM } = await loadAi();
    const f = vi.fn().mockResolvedValue(res({ error: { message: 'The AI service is busy right now. Please try again in a minute.', code: 'busy' } }, 503));
    vi.stubGlobal('fetch', f);
    await expect(callLLM(msg)).rejects.toMatchObject({ status: 503, code: 'busy', message: /busy right now/ });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('does not retry a reported rate limit either', async () => {
    const { callLLM } = await loadAi();
    const f = vi.fn().mockResolvedValue(res({ error: { message: 'busy', code: 'rate_limited' } }, 429));
    vi.stubGlobal('fetch', f);
    await expect(callLLM(msg)).rejects.toMatchObject({ status: 429, code: 'rate_limited' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('retries once when the connection drops before any answer, then recovers', async () => {
    const { callLLM } = await loadAi();
    const f = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(res({ text: 'ok' }));
    vi.stubGlobal('fetch', f);
    expect(await callLLM(msg)).toBe('ok');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('gives up after one retry on a persistent network error, with a clear message', async () => {
    const { callLLM } = await loadAi();
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', f);
    await expect(callLLM(msg)).rejects.toThrow(/Network error: Failed to fetch/);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('does not retry after the browser-side timeout (the user already waited)', async () => {
    const { callLLM } = await loadAi();
    const f = vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    vi.stubGlobal('fetch', f);
    await expect(callLLM(msg)).rejects.toMatchObject({ code: 'timeout', message: /took too long/i });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 400', async () => {
    const { callLLM } = await loadAi();
    const f = vi.fn().mockResolvedValue(res({ error: { message: 'The prompt is too long.' } }, 400));
    vi.stubGlobal('fetch', f);
    await expect(callLLM(msg)).rejects.toMatchObject({ message: 'The prompt is too long.', status: 400 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('turns a 401 into a "session expired" message and does not retry', async () => {
    const { callLLM } = await loadAi();
    const f = vi.fn().mockResolvedValue(res({ error: { message: 'Please sign in to use AI features.' } }, 401));
    vi.stubGlobal('fetch', f);
    await expect(callLLM(msg)).rejects.toMatchObject({ status: 401, message: /session expired/i });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('flags a cut-off reply (422 + truncated) without retrying', async () => {
    const { callLLM } = await loadAi();
    const f = vi.fn().mockResolvedValue(res({ error: { message: 'The response hit the length limit.', truncated: true } }, 422));
    vi.stubGlobal('fetch', f);
    await expect(callLLM(msg)).rejects.toMatchObject({ truncated: true, status: 422 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('handles a non-JSON gateway error page', async () => {
    const { callLLM } = await loadAi();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error('html'); } }));
    await expect(callLLM(msg)).rejects.toThrow(/502/);
  });

  it('treats a 200 without text as a failure instead of returning undefined', async () => {
    const { callLLM } = await loadAi();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res({})));
    await expect(callLLM(msg)).rejects.toBeInstanceOf(Error);
  });
});
