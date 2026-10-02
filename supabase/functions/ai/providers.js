// Provider adapters used by the `ai` Edge Function. Pure JS (no Deno APIs) so the same
// code runs under Deno in production and under Vitest in tests.

export const DEFAULT_MODELS = { anthropic: 'claude-sonnet-5-5', gemini: 'gemini-2.5-flash', openai: 'gpt-4o-mini' };
const MODEL_FAMILY = { anthropic: /^claude/i, gemini: /^gemini/i, openai: /^(gpt|o\d|chatgpt)/i };
export const PROVIDERS = Object.keys(DEFAULT_MODELS);
export const KEY_ENV = { anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY', openai: 'OPENAI_API_KEY' };

export class ProviderError extends Error {
  // kind: 'truncated' | 'blocked' | 'empty' | 'upstream'
  constructor(message, { kind = 'upstream', status = 0 } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.kind = kind;
    this.status = status; // upstream HTTP status, when there was one
  }
}

export const resolveModel = (provider, model) =>
  (model && MODEL_FAMILY[provider].test(model) ? model : DEFAULT_MODELS[provider]);

// Which provider to use: AI_PROVIDER if set and keyed, otherwise the first provider that has a key.
export function pickProvider(env) {
  const wanted = (env.AI_PROVIDER || '').toLowerCase();
  if (PROVIDERS.includes(wanted)) return env[KEY_ENV[wanted]] ? wanted : null;
  return PROVIDERS.find(p => env[KEY_ENV[p]]) || null;
}

const lastUserIndex = (messages) => messages.map(m => m.role).lastIndexOf('user');
const withAttachment = (messages, build) => {
  const last = lastUserIndex(messages);
  return messages.map((m, i) => (i === last ? { ...m, content: build(m.content) } : m));
};

function buildRequest({ provider, model, key, messages, maxTokens, pdfBase64 }) {
  if (provider === 'gemini') {
    const text = messages.map(m => m.content).join('\n\n');
    const parts = pdfBase64 ? [{ inline_data: { mime_type: 'application/pdf', data: pdfBase64 } }, { text }] : [{ text }];
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: { contents: [{ parts }], generationConfig: { maxOutputTokens: maxTokens, temperature: 0.1 } },
    };
  }
  if (provider === 'openai') {
    const msgs = pdfBase64
      ? withAttachment(messages, t => [
          { type: 'file', file: { filename: 'resume.pdf', file_data: `data:application/pdf;base64,${pdfBase64}` } },
          { type: 'text', text: t },
        ])
      : messages;
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: { model, max_completion_tokens: maxTokens, messages: msgs },
    };
  }
  const msgs = pdfBase64
    ? withAttachment(messages, t => [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
        { type: 'text', text: t },
      ])
    : messages;
  return {
    url: 'https://api.anthropic.com/v1/messages',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: { model, max_tokens: maxTokens, messages: msgs },
  };
}

function parseResponse(provider, data) {
  if (provider === 'gemini') {
    const cand = data.candidates?.[0];
    if (!cand) {
      const reason = data.promptFeedback?.blockReason;
      throw new ProviderError(reason ? `The AI provider blocked this request (${reason}).` : 'The AI provider returned no response.', { kind: reason ? 'blocked' : 'empty' });
    }
    if (cand.finishReason === 'MAX_TOKENS') throw new ProviderError('The response hit the length limit.', { kind: 'truncated' });
    const text = (cand.content?.parts || []).map(p => p.text || '').join('');
    if (!text) throw new ProviderError('The AI provider returned no text.', { kind: 'empty' });
    return text;
  }
  if (provider === 'openai') {
    const choice = data.choices?.[0];
    if (choice?.finish_reason === 'length') throw new ProviderError('The response hit the length limit.', { kind: 'truncated' });
    if (!choice?.message?.content) throw new ProviderError('The AI provider returned no text.', { kind: 'empty' });
    return choice.message.content;
  }
  if (data.stop_reason === 'max_tokens') throw new ProviderError('The response hit the length limit.', { kind: 'truncated' });
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  if (!text) throw new ProviderError('The AI provider returned no text.', { kind: 'empty' });
  return text;
}

// Calls the provider once (retries are the client's job) and returns the text.
export async function callProvider({ provider, model, key, messages, maxTokens, pdfBase64 }, fetchImpl = fetch, timeoutMs = 80_000) {
  const { url, headers, body } = buildRequest({ provider, model, key, messages, maxTokens, pdfBase64 });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res, data = null;
  try {
    res = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
    try { data = await res.json(); } catch { /* non-JSON body */ }
  } catch (e) {
    throw new ProviderError(e?.name === 'AbortError' ? 'The AI provider timed out.' : 'Could not reach the AI provider.', { kind: 'upstream', status: 0 });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok || !data || data.error) {
    const raw = data?.error?.message ?? (typeof data?.error === 'string' ? data.error : null);
    throw new ProviderError(raw || `The AI provider request failed (${res.status}).`, { kind: 'upstream', status: res.status });
  }
  return parseResponse(provider, data);
}
