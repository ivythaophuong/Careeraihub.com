// Provider adapters used by the `ai` Edge Function. Pure JS (no Deno APIs) so the same
// code runs under Deno in production and under Vitest in tests.

export const DEFAULT_MODELS = { anthropic: 'claude-sonnet-5-5', gemini: 'gemini-3.8-flash', openai: 'gpt-4o-mini' };
const MODEL_FAMILY = { anthropic: /^claude/i, gemini: /^gemini/i, openai: /^(gpt|o\d|chatgpt)/i };
export const PROVIDERS = Object.keys(DEFAULT_MODELS);
export const KEY_ENV = { anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY', openai: 'OPENAI_API_KEY' };

export class ProviderError extends Error {
  // kind: 'truncated' | 'blocked' | 'empty' | 'upstream'
  // reason (upstream, no HTTP status): 'timeout' | 'network'
  constructor(message, { kind = 'upstream', status = 0, reason = null, retryAfterMs = 0 } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.kind = kind;
    this.status = status; // upstream HTTP status, when there was one
    this.reason = reason;
    this.retryAfterMs = retryAfterMs; // provider's Retry-After, capped, when it sent one
  }
}

// Would trying the same request again plausibly help? Overload, rate limits, timeouts, network
// blips and empty replies are transient. A bad key (401/403), a bad request (other 4xx), a reply cut
// off at the length limit or blocked by safety filters will fail the same way every time.
export function isTransient(err) {
  if (!(err instanceof ProviderError)) return false;
  if (err.kind === 'empty') return true;
  if (err.kind !== 'upstream') return false;
  return err.status === 0 || err.status === 408 || err.status === 429 || err.status >= 500;
}

export const resolveModel = (provider, model) =>
  (model && MODEL_FAMILY[provider].test(model) ? model : DEFAULT_MODELS[provider]);

// Which provider to use: AI_PROVIDER if set and keyed, otherwise the first provider that has a key.
// Settings pasted into a terminal often carry stray spaces or a newline, so trim before using them.
export const setting = (env, name) => String(env[name] ?? '').trim();

export function pickProvider(env) {
  const wanted = setting(env, 'AI_PROVIDER').toLowerCase();
  const hasKey = (p) => setting(env, KEY_ENV[p]) !== '';
  if (PROVIDERS.includes(wanted)) return hasKey(wanted) ? wanted : null;
  return PROVIDERS.find(hasKey) || null;
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

// Calls the provider once and returns the text. Use callWithRetry for the retrying wrapper.
export async function callProvider({ provider, model, key, messages, maxTokens, pdfBase64 }, fetchImpl = fetch, timeoutMs = 45_000) {
  const { url, headers, body } = buildRequest({ provider, model, key, messages, maxTokens, pdfBase64 });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res, data = null;
  try {
    res = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
    try { data = await res.json(); } catch { /* non-JSON body */ }
  } catch (e) {
    const timedOut = e?.name === 'AbortError';
    throw new ProviderError(timedOut ? 'The AI provider timed out.' : 'Could not reach the AI provider.', { kind: 'upstream', status: 0, reason: timedOut ? 'timeout' : 'network' });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok || !data || data.error) {
    const raw = data?.error?.message ?? (typeof data?.error === 'string' ? data.error : null);
    const secs = Number(res.headers?.get?.('retry-after'));
    const retryAfterMs = Number.isFinite(secs) && secs > 0 ? Math.min(secs * 1000, 5000) : 0;
    throw new ProviderError(raw || `The AI provider request failed (${res.status}).`, { kind: 'upstream', status: res.status, retryAfterMs });
  }
  return parseResponse(provider, data);
}

export const RETRY_DEFAULTS = {
  maxAttempts: 3,          // the first try plus two retries
  backoffMs: [1000, 2500], // wait before retry 1 and retry 2
  attemptTimeoutMs: 45_000,
  budgetMs: 70_000,        // total time we are willing to spend, so the caller never waits minutes
  minUsefulMs: 3000,       // don't start an attempt with less time than this left
};

// Retries only transient failures, within a total time budget. Permanent failures (bad key, bad
// request, cut-off or blocked reply) are thrown at once: repeating them cannot help and only makes the
// user wait. Resolves { text, attempts }; a thrown ProviderError carries .attempts.
export async function callWithRetry(args, {
  fetchImpl = fetch,
  sleep = (ms) => new Promise(r => setTimeout(r, ms)),
  now = Date.now,
  jitter = () => Math.random() * 300,
  ...opts
} = {}) {
  const o = { ...RETRY_DEFAULTS, ...opts };
  const start = now();
  let attempt = 0;
  for (;;) {
    attempt += 1;
    const left = o.budgetMs - (now() - start);
    try {
      const text = await callProvider(args, fetchImpl, Math.max(1000, Math.min(o.attemptTimeoutMs, left)));
      return { text, attempts: attempt };
    } catch (e) {
      if (e instanceof ProviderError) e.attempts = attempt;
      if (!isTransient(e) || attempt >= o.maxAttempts) throw e;
      const wait = Math.max(e.retryAfterMs || 0, o.backoffMs[attempt - 1] ?? o.backoffMs.at(-1)) + jitter();
      if ((now() - start) + wait + o.minUsefulMs > o.budgetMs) throw e; // not enough time left to be worth it
      await sleep(wait);
    }
  }
}


// ── Routing ──────────────────────────────────────────────────────────────────
// A "route" is one provider+model to try. A request gets an ordered list of routes (its chain): the
// first is tried (with retries), and if it fails in a way another model could fix, the next is tried.
// The server alone decides the chain; the browser may only name a task (below), never a provider or model.

// Tasks the browser may label a request with. Unknown labels become 'general'.
export const TASKS = ['general', 'interview_questions', 'interview_eval', 'star', 'cover_letter', 'resume_scan', 'jd_analysis', 'salary'];
export const MAX_CHAIN = 3;

// 'gemini' or 'gemini:gemini-2.5-flash' (the model may itself contain colons) -> { provider, model|null }
export function parseRouteEntry(entry) {
  const text = String(entry ?? '').trim();
  if (!text) return null;
  const i = text.indexOf(':');
  const provider = (i === -1 ? text : text.slice(0, i)).trim().toLowerCase();
  const model = i === -1 ? null : text.slice(i + 1).trim() || null;
  return PROVIDERS.includes(provider) ? { provider, model } : null;
}

function safeJson(text) {
  try { const v = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; }
}

// Settings (all optional, all secrets so nothing is hard-coded):
//   AI_PROVIDER / AI_MODEL  the primary, as before
//   AI_FALLBACK             comma list of 'provider[:model]' tried after the primary
//   AI_ROUTES               JSON { "default": [...], "interview_eval": [...] } for per-task chains;
//                           when present for a task it replaces the primary+fallback chain for that task
// Entries without an API key, unknown providers and duplicates are skipped, so a typo or a missing key
// shrinks the chain instead of breaking it.
export function buildRoutes(env, task = 'general') {
  const routes = safeJson(setting(env, 'AI_ROUTES'));
  let entries = null;
  if (routes) {
    const list = Array.isArray(routes[task]) ? routes[task] : Array.isArray(routes.default) ? routes.default : null;
    if (list) entries = list.map(parseRouteEntry);
  }
  if (!entries) {
    const primary = pickProvider(env);
    entries = [];
    if (primary) entries.push({ provider: primary, model: setting(env, 'AI_MODEL') || null });
    for (const part of setting(env, 'AI_FALLBACK').split(',')) entries.push(parseRouteEntry(part));
  }
  const seen = new Set();
  const chain = [];
  for (const e of entries) {
    if (!e) continue;
    const key = setting(env, KEY_ENV[e.provider]);
    if (!key) continue;
    const model = resolveModel(e.provider, e.model);
    const id = `${e.provider}:${model}`;
    if (seen.has(id)) continue;
    seen.add(id);
    chain.push({ provider: e.provider, model, key, id });
    if (chain.length >= MAX_CHAIN) break;
  }
  return chain;
}

// Remembers (in this function instance only) which routes just failed, so the next requests try a
// healthy route first instead of waiting through the broken one's retries again. A downed route is
// still used as a last resort, and is retried first again once its cooldown passes.
export function createHealth({ cooldownMs = 60_000 } = {}) {
  const downUntil = new Map();
  return {
    isDown: (id, now = Date.now()) => (downUntil.get(id) ?? 0) > now,
    markDown: (id, now = Date.now()) => { downUntil.set(id, now + cooldownMs); },
    markUp: (id) => { downUntil.delete(id); },
  };
}

// Tries the chain in order. Returns { text, attempts, route, tried }. On failure throws the most
// useful ProviderError, with .tried (what was attempted) and .attempts (total provider calls).
//  - transient failure (overload, rate limit, timeout...) after that route's retries -> next route
//  - bad key on one route -> next route (it is that provider's problem, not the request's)
//  - bad request / cut-off / blocked reply -> stop: another model is unlikely to fix the request
export async function callRoutes(routes, request, {
  fetchImpl = fetch,
  now = Date.now,
  sleep,
  jitter,
  health = createHealth(),
  attemptTimeoutMs = RETRY_DEFAULTS.attemptTimeoutMs,
  budgetMs = RETRY_DEFAULTS.budgetMs,
} = {}) {
  const t = now();
  const ordered = [...routes.filter(r => !health.isDown(r.id, t)), ...routes.filter(r => health.isDown(r.id, t))];
  const start = now();
  const tried = [];
  let attempts = 0;
  let transientErr = null;
  let lastErr = null;

  for (let i = 0; i < ordered.length; i++) {
    const route = ordered[i];
    const left = budgetMs - (now() - start);
    if (i > 0 && left < RETRY_DEFAULTS.minUsefulMs) break;
    const hasFallback = i < ordered.length - 1;
    try {
      const out = await callWithRetry(
        { ...request, provider: route.provider, model: route.model, key: route.key },
        { fetchImpl, now, ...(sleep && { sleep }), ...(jitter && { jitter }), maxAttempts: hasFallback ? 2 : RETRY_DEFAULTS.maxAttempts, attemptTimeoutMs, budgetMs: left },
      );
      health.markUp(route.id);
      tried.push({ id: route.id, ok: true });
      return { text: out.text, attempts: attempts + out.attempts, route, tried };
    } catch (e) {
      if (!(e instanceof ProviderError)) throw e;
      attempts += e.attempts ?? 1;
      lastErr = e;
      const badKey = e.kind === 'upstream' && (e.status === 401 || e.status === 403);
      tried.push({ id: route.id, ok: false, status: e.status || null, kind: e.kind, reason: e.reason });
      if (isTransient(e)) { transientErr = transientErr || e; health.markDown(route.id, now()); continue; }
      if (badKey) { health.markDown(route.id, now()); continue; }
      e.tried = tried; e.attempts = attempts;
      throw e;
    }
  }
  const err = transientErr || lastErr || new ProviderError('No AI route is available.', { kind: 'upstream', status: 0, reason: 'network' });
  err.tried = tried; err.attempts = attempts;
  throw err;
}
