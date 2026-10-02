import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ai.jsx reads import.meta.env at module load, so each test stubs env first and re-imports.
async function loadAi(env = {}) {
  vi.resetModules();
  vi.stubEnv('VITE_LLM_RETRY_DELAY_MS', '0');
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import('./ai.jsx');
}

const res = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const GEMINI = { VITE_LLM_PROVIDER: 'gemini', VITE_GEMINI_API_KEY: 'g-key' };
const CLAUDE = { VITE_LLM_PROVIDER: 'anthropic', VITE_ANTHROPIC_API_KEY: 'a-key' };
const OPENAI = { VITE_LLM_PROVIDER: 'openai', VITE_OPENAI_API_KEY: 'o-key' };
const msg = [{ role: 'user', content: 'hi' }];
const bodyOf = (fetchMock, n = 0) => JSON.parse(fetchMock.mock.calls[n][1].body);

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
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

describe('resolveModel', () => {
  it('keeps a model that belongs to the provider', async () => {
    const { resolveModel } = await loadAi();
    expect(resolveModel('anthropic', 'claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5-20251001');
    expect(resolveModel('openai', 'gpt-4o')).toBe('gpt-4o');
    expect(resolveModel('gemini', 'gemini-2.0-flash')).toBe('gemini-2.0-flash');
  });
  it('falls back to the provider default on a mismatched or missing model', async () => {
    const { resolveModel } = await loadAi();
    expect(resolveModel('anthropic', 'gemini-1.5-flash')).toBe('claude-sonnet-5-5');
    expect(resolveModel('openai', undefined)).toBe('gpt-4o-mini');
  });
});

describe('Gemini', () => {
  it('attaches the PDF as inline_data and puts the key in a header, not the URL', async () => {
    const { callLLM } = await loadAi(GEMINI);
    const f = vi.fn().mockResolvedValue(res({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }));
    vi.stubGlobal('fetch', f);
    expect(await callLLM(msg, 100, 'BASE64PDF')).toBe('ok');
    expect(bodyOf(f).contents[0].parts[0].inline_data.data).toBe('BASE64PDF');
    expect(f.mock.calls[0][0]).not.toContain('g-key');
    expect(f.mock.calls[0][1].headers['x-goog-api-key']).toBe('g-key');
  });
  it('reports a blocked prompt instead of crashing on missing candidates', async () => {
    const { callLLM } = await loadAi(GEMINI);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res({ promptFeedback: { blockReason: 'SAFETY' } })));
    await expect(callLLM(msg)).rejects.toThrow(/blocked.*SAFETY/i);
  });
  it('flags a response cut off by the token limit', async () => {
    const { callLLM } = await loadAi(GEMINI);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"a":' }] } }] })));
    await expect(callLLM(msg)).rejects.toMatchObject({ truncated: true });
  });
});

describe('Anthropic', () => {
  it('uses the messages endpoint with the browser-access header', async () => {
    const { callLLM } = await loadAi(CLAUDE);
    const f = vi.fn().mockResolvedValue(res({ content: [{ type: 'text', text: 'hello' }] }));
    vi.stubGlobal('fetch', f);
    expect(await callLLM(msg)).toBe('hello');
    expect(f.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages');
    expect(f.mock.calls[0][1].headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(bodyOf(f).model).toBe('claude-sonnet-5-5');
  });
  it('sends the PDF as a document block (audit 1.4)', async () => {
    const { callLLM } = await loadAi(CLAUDE);
    const f = vi.fn().mockResolvedValue(res({ content: [{ type: 'text', text: 'ok' }] }));
    vi.stubGlobal('fetch', f);
    await callLLM([{ role: 'user', content: 'scan this' }], 100, 'BASE64PDF');
    const content = bodyOf(f).messages[0].content;
    expect(content[0]).toEqual({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'BASE64PDF' } });
    expect(content[1]).toEqual({ type: 'text', text: 'scan this' });
  });
  it('joins multiple text blocks and flags max_tokens', async () => {
    const { callLLM } = await loadAi(CLAUDE);
    const f = vi.fn()
      .mockResolvedValueOnce(res({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }))
      .mockResolvedValueOnce(res({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"x":' }] }));
    vi.stubGlobal('fetch', f);
    expect(await callLLM(msg)).toBe('ab');
    await expect(callLLM(msg)).rejects.toMatchObject({ truncated: true });
  });
});

describe('OpenAI', () => {
  it('sends the PDF as a file part and reads the choice', async () => {
    const { callLLM } = await loadAi(OPENAI);
    const f = vi.fn().mockResolvedValue(res({ choices: [{ message: { content: 'yo' }, finish_reason: 'stop' }] }));
    vi.stubGlobal('fetch', f);
    expect(await callLLM(msg, 100, 'BASE64PDF')).toBe('yo');
    const part = bodyOf(f).messages[0].content[0];
    expect(part.type).toBe('file');
    expect(part.file.file_data).toBe('data:application/pdf;base64,BASE64PDF');
    expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer o-key');
  });
  it('flags finish_reason=length', async () => {
    const { callLLM } = await loadAi(OPENAI);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res({ choices: [{ message: { content: '{' }, finish_reason: 'length' }] })));
    await expect(callLLM(msg)).rejects.toMatchObject({ truncated: true });
  });
});

describe('request handling (audit 2.4)', () => {
  it('retries once on 429 and then succeeds', async () => {
    const { callLLM } = await loadAi(CLAUDE);
    const f = vi.fn()
      .mockResolvedValueOnce(res({ error: { message: 'rate limited' } }, 429))
      .mockResolvedValueOnce(res({ content: [{ type: 'text', text: 'ok' }] }));
    vi.stubGlobal('fetch', f);
    expect(await callLLM(msg)).toBe('ok');
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('retries once on a network error, then gives up with a clear message', async () => {
    const { callLLM } = await loadAi(CLAUDE);
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', f);
    await expect(callLLM(msg)).rejects.toThrow(/network error: Failed to fetch/);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('does not retry a 400 or 401', async () => {
    const { callLLM } = await loadAi(CLAUDE);
    const f = vi.fn().mockResolvedValue(res({ error: { message: 'invalid x-api-key' } }, 401));
    vi.stubGlobal('fetch', f);
    await expect(callLLM(msg)).rejects.toMatchObject({ message: 'invalid x-api-key', status: 401 });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('surfaces a provider error returned with HTTP 200', async () => {
    const { callLLM } = await loadAi(CLAUDE);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res({ error: { message: 'overloaded' } })));
    await expect(callLLM(msg)).rejects.toThrow('overloaded');
  });
  it('handles a non-JSON error body', async () => {
    const { callLLM } = await loadAi(CLAUDE);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error('html'); } }));
    await expect(callLLM(msg)).rejects.toThrow(/502/);
  });
  it('fails fast with a clear message when the API key is missing', async () => {
    const { callLLM } = await loadAi({ VITE_LLM_PROVIDER: 'anthropic', VITE_ANTHROPIC_API_KEY: '' });
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await expect(callLLM(msg)).rejects.toThrow(/VITE_ANTHROPIC_API_KEY/);
    expect(f).not.toHaveBeenCalled();
  });
});
