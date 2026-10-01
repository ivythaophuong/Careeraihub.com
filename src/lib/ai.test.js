import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ai.jsx reads import.meta.env at module load, so each test stubs env first and re-imports.
async function loadAi(env = {}) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import('./ai.jsx');
}

const jsonRes = (body, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body });

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

describe('callLLM routing', () => {
  it('sends Gemini requests with the PDF attached as inline_data', async () => {
    const { callLLM } = await loadAi({ VITE_LLM_PROVIDER: 'gemini', VITE_LLM_MODEL: 'gemini-1.5-flash', VITE_GEMINI_API_KEY: 'g-key' });
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await callLLM([{ role: 'user', content: 'hi' }], 100, 'BASE64PDF')).toBe('ok');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contents[0].parts[0].inline_data.data).toBe('BASE64PDF');
  });

  it('sends Anthropic requests to the messages endpoint', async () => {
    const { callLLM } = await loadAi({ VITE_LLM_PROVIDER: 'anthropic', VITE_LLM_MODEL: 'claude-x', VITE_ANTHROPIC_API_KEY: 'a-key' });
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({ content: [{ text: 'hello' }] }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await callLLM([{ role: 'user', content: 'hi' }])).toBe('hello');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages');
  });

  it('throws the provider error message', async () => {
    const { callLLM } = await loadAi({ VITE_LLM_PROVIDER: 'anthropic', VITE_ANTHROPIC_API_KEY: 'a-key' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes({ error: { message: 'rate limited' } })));
    await expect(callLLM([{ role: 'user', content: 'hi' }])).rejects.toThrow('rate limited');
  });
});

// Known defects from the engine audit. `it.fails` passes while the bug exists and
// starts failing once it is fixed, which is the cue to turn it into a normal `it`.
describe('known defects (audit 1.4 / 2.4)', () => {
  it.fails('does not crash when Gemini returns no candidates (blocked response)', async () => {
    const { callLLM } = await loadAi({ VITE_LLM_PROVIDER: 'gemini', VITE_GEMINI_API_KEY: 'g-key' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes({ promptFeedback: { blockReason: 'SAFETY' } })));
    await expect(callLLM([{ role: 'user', content: 'hi' }])).rejects.toThrow(/block|safety|no response/i);
  });

  it.fails('includes the PDF in the request when the provider is Anthropic', async () => {
    const { callLLM } = await loadAi({ VITE_LLM_PROVIDER: 'anthropic', VITE_ANTHROPIC_API_KEY: 'a-key' });
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({ content: [{ text: 'ok' }] }));
    vi.stubGlobal('fetch', fetchMock);
    await callLLM([{ role: 'user', content: 'scan this' }], 100, 'BASE64PDF');
    expect(fetchMock.mock.calls[0][1].body).toContain('BASE64PDF');
  });
});
