// Provider adapters used by the `ai` Edge Function. Pure JS (no Deno APIs) so the same
// code runs under Deno in production and under Vitest in tests.

export const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-5-5', gemini: 'gemini-3.8-flash', openai: 'gpt-4o-mini',
  groq: 'llama-3.3-70b-versatile', openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
  deepinfra: 'meta-llama/Llama-3.3-70B-Instruct', mistral: 'mistral-small-latest',
};
const MODEL_FAMILY = { anthropic: /^claude/i, gemini: /^gemini/i, openai: /^(gpt|o\d|chatgpt)/i };
export const PROVIDERS = Object.keys(DEFAULT_MODELS);
export const KEY_ENV = {
  anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY', openai: 'OPENAI_API_KEY',
  groq: 'GROQ_API_KEY', openrouter: 'OPENROUTER_API_KEY', deepinfra: 'DEEPINFRA_API_KEY', mistral: 'MISTRAL_API_KEY',
};
// OpenAI-compatible providers: same request/response shape as OpenAI, different address. They have free tiers, so they make
// good fallbacks. Their model is DEFAULT_MODELS or <KEY prefix>_MODEL (GROQ_MODEL, OPENROUTER_MODEL, DEEPINFRA_MODEL, MISTRAL_MODEL), never AI_MODEL.
const COMPAT_URL = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  deepinfra: 'https://api.deepinfra.com/v1/openai/chat/completions',
  mistral: 'https://api.mistral.ai/v1/chat/completions',
};
const isCompat = (p) => p in COMPAT_URL;
const SUPPORTS_PDF = { anthropic: true, gemini: true, openai: true };

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
  (model && MODEL_FAMILY[provider]?.test(model) ? model : DEFAULT_MODELS[provider]);

// Which provider to use: AI_PROVIDER if set and keyed, otherwise the first provider that has a key.
// Settings pasted into a terminal often carry stray spaces or a newline, so trim before using them.
export const setting = (env, name) => String(env[name] ?? '').trim();

export function pickProvider(env) {
  const wanted = setting(env, 'AI_PROVIDER').toLowerCase();
  const hasKey = (p) => setting(env, KEY_ENV[p]) !== '';
  if (PROVIDERS.includes(wanted)) return hasKey(wanted) ? wanted : null;
  return PROVIDERS.find(hasKey) || null;
}

// Models to use for a provider: AI_MODEL for the big three when it names one of their models, otherwise the default.
export const modelFor = (env, provider) =>
  isCompat(provider)
    ? (setting(env, `${provider.toUpperCase()}_MODEL`) || DEFAULT_MODELS[provider])
    : resolveModel(provider, setting(env, 'AI_MODEL'));

// Providers to try, in order: the one AI_PROVIDER names (or the first keyed one), then the other keyed providers.
// AI_FALLBACKS (comma list, e.g. "groq,openrouter") sets the fallback order; without it all keyed providers follow in PROVIDERS order.
export function providerChain(env) {
  const first = pickProvider(env);
  if (!first) return [];
  const hasKey = (p) => setting(env, KEY_ENV[p]) !== '';
  const listed = setting(env, 'AI_FALLBACKS').toLowerCase().split(',').map(x => x.trim()).filter(x => PROVIDERS.includes(x));
  const rest = listed.length ? listed : PROVIDERS;
  return [first, ...rest.filter(p => p !== first && hasKey(p))].filter((p, i, a) => a.indexOf(p) === i);
}

const lastUserIndex = (messages) => messages.map(m => m.role).lastIndexOf('user');
const withAttachment = (messages, build) => {
  const last = lastUserIndex(messages);
  return messages.map((m, i) => (i === last ? { ...m, content: build(m.content) } : m));
};

// Gemini models can spend output tokens on hidden "thinking", which would cut a JSON answer off.
// - 2.5 Flash: thinking can be switched off with thinkingBudget 0, so do that.
// - Other/newer models use different thinking controls that this code can't verify, so send no
//   thinking setting and instead leave extra room in the output budget (it is only an upper limit;
//   the model stops when it is done, so this does not make answers longer).
export function geminiGenerationConfig(model, maxTokens) {
  const base = { temperature: 0.1 };
  if (/gemini-2\.5-flash/i.test(model)) return { ...base, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } };
  return { ...base, maxOutputTokens: Math.min(8192, Math.max(maxTokens * 2, 4096)) };
}

function buildRequest({ provider, model, key, messages, maxTokens, pdfBase64 }) {
  if (provider === 'gemini') {
    const text = messages.map(m => m.content).join('\n\n');
    const parts = pdfBase64 ? [{ inline_data: { mime_type: 'application/pdf', data: pdfBase64 } }, { text }] : [{ text }];
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: {
        contents: [{ parts }],
        generationConfig: geminiGenerationConfig(model, maxTokens),
      },
    };
  }
  if (provider === 'openai' || isCompat(provider)) {
    const msgs = pdfBase64
      ? withAttachment(messages, t => [
          { type: 'file', file: { filename: 'resume.pdf', file_data: `data:application/pdf;base64,${pdfBase64}` } },
          { type: 'text', text: t },
        ])
      : messages;
    return {
      url: COMPAT_URL[provider] || 'https://api.openai.com/v1/chat/completions',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: isCompat(provider) ? { model, max_tokens: maxTokens, messages: msgs } : { model, max_completion_tokens: maxTokens, messages: msgs },
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
  if (provider === 'openai' || isCompat(provider)) {
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

// Errors worth trying the next provider for: the provider is busy, down, unreachable, returned nothing, or rejected OUR key or model.
// Not worth it: a reply cut off by the length limit or blocked for safety (the same request would do the same elsewhere),
// and 400/413/422 (the request itself is wrong).
export const shouldFallBack = (e) =>
  e instanceof ProviderError && e.kind !== 'truncated' && e.kind !== 'blocked'
  && (e.kind === 'empty' || [0, 401, 403, 404, 408, 429].includes(e.status) || e.status >= 500);

// Calls the providers in order until one answers. Throws the last error if all fail (or the first error that must not fall back).
// A PDF can only go to providers that read PDFs. Never logs keys or bodies.
export async function callWithFallback({ env, messages, maxTokens, pdfBase64 }, fetchImpl = fetch, timeoutMs) {
  const chain = providerChain(env).filter(p => !pdfBase64 || SUPPORTS_PDF[p]);
  if (!chain.length) throw new ProviderError('No AI provider is configured.', { kind: 'upstream', status: 500 });
  let lastErr;
  for (const provider of chain) {
    try {
      return await callProvider({ provider, model: modelFor(env, provider), key: setting(env, KEY_ENV[provider]), messages, maxTokens, pdfBase64 }, fetchImpl, timeoutMs);
    } catch (e) {
      lastErr = e;
      if (!shouldFallBack(e)) throw e;
      console.error(`[ai] ${provider} failed (${e.kind} ${e.status}); ${provider === chain[chain.length - 1] ? 'no more providers' : 'trying the next one'}.`);
    }
  }
  throw lastErr;
}
