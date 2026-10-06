// Request handling for the `ai` Edge Function: authenticate the caller, validate and cap the
// request, call the configured provider with a server-held key, return { text }.
import { callRoutes, buildRoutes, createHealth, TASKS, setting, KEY_ENV, ProviderError } from './providers.js';

export const LIMITS = {
  maxBodyBytes: 12 * 1024 * 1024, // resume PDFs travel as base64
  maxPdfChars: 10 * 1024 * 1024,
  maxPromptChars: 200_000,
  maxMessages: 20,
  maxTokensCap: 8192,
  rateWindowMs: 60_000,
  rateMax: 20, // requests per user per window, per function instance
};

// Sliding-window limiter. In-memory, so it is per function instance: it blunts bursts and
// runaway loops but is not a global quota. Pair it with spend limits at the provider.
export function createRateLimiter({ windowMs = LIMITS.rateWindowMs, max = LIMITS.rateMax } = {}) {
  const hits = new Map();
  return {
    check(id, now = Date.now()) {
      const recent = (hits.get(id) || []).filter(t => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(id, recent);
        return { ok: false, retryAfter: Math.ceil((recent[0] + windowMs - now) / 1000) };
      }
      recent.push(now);
      hits.set(id, recent);
      if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k);
      return { ok: true };
    },
  };
}
const defaultLimiter = createRateLimiter();
const defaultHealth = createHealth();

// Optional tuning from secrets, clamped to sane bounds; anything missing or invalid keeps the default.
function retrySettings(env) {
  const secs = (name, lo, hi) => { const n = Number(setting(env, name)); return Number.isFinite(n) && n >= lo && n <= hi ? n * 1000 : undefined; };
  const out = { attemptTimeoutMs: secs('AI_ATTEMPT_TIMEOUT_SECONDS', 10, 75), budgetMs: secs('AI_TOTAL_TIMEOUT_SECONDS', 15, 80) };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
}

function corsHeaders(req, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.get('origin') || '';
  const allow = allowed.length === 0 ? '*' : (allowed.includes(origin) ? origin : allowed[0]);
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const json = (status, body, headers) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const fail = (status, message, headers, extra = {}) => json(status, { error: { message, status, ...extra } }, headers);

// Supabase's gateway accepts the public anon key as a valid JWT, so ask the auth server who
// the caller really is. The anon key (or any non-user token) has no user and is rejected.
async function authenticate(req, env, fetchImpl) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  try {
    const r = await fetchImpl(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!r.ok) return null;
    const user = await r.json();
    return user?.id ? user : null;
  } catch { return null; }
}

function validate(body) {
  if (!body || typeof body !== 'object') return 'Request body must be a JSON object.';
  const { messages, maxTokens, pdfBase64 } = body;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > LIMITS.maxMessages) return `messages must be an array of 1–${LIMITS.maxMessages} items.`;
  let chars = 0;
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return 'Each message needs a role (user|assistant) and string content.';
    chars += m.content.length;
  }
  if (chars > LIMITS.maxPromptChars) return 'The prompt is too long.';
  if (maxTokens !== undefined && (!Number.isFinite(maxTokens) || maxTokens < 1)) return 'maxTokens must be a positive number.';
  if (pdfBase64 !== undefined && pdfBase64 !== null) {
    if (typeof pdfBase64 !== 'string' || pdfBase64.length > LIMITS.maxPdfChars) return 'pdfBase64 must be a base64 string under 10MB.';
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(pdfBase64)) return 'pdfBase64 is not valid base64.';
  }
  if (!messages.some(m => m.role === 'user')) return 'At least one user message is required.';
  return null;
}

// What we tell the caller about a provider failure that survived our retries. `code` is a stable
// machine-readable label; `message` is safe to show to a user (never the provider's raw text for
// outages, never anything that could contain a key).
function describeFailure(err) {
  if (err.kind === 'truncated') return { status: 422, code: 'truncated', message: err.message };
  if (err.kind === 'blocked') return { status: 422, code: 'blocked', message: err.message.slice(0, 300) };
  if (err.kind === 'empty') return { status: 502, code: 'empty', message: 'The AI returned an empty answer. Please try again.' };
  if (err.status === 401 || err.status === 403) return { status: 500, code: 'misconfigured', message: 'AI service is misconfigured.' }; // our key is bad: not the caller's fault
  if (err.status === 429) return { status: 429, code: 'rate_limited', message: 'The AI provider is busy. Please try again in a minute.' };
  if (err.status >= 400 && err.status < 500 && err.status !== 408) return { status: 400, code: 'bad_request', message: err.message.slice(0, 300) };
  if (err.reason === 'timeout') return { status: 503, code: 'timeout', message: 'The AI took too long to respond. Please try again.' };
  return { status: 503, code: 'busy', message: 'The AI service is busy right now. Please try again in a minute.' };
}

// One structured line per provider call, readable in the Supabase function logs. It holds no keys,
// prompts, answers or user identifiers: only what is needed to see how the provider is behaving.
function logCall(fields) {
  console.log(JSON.stringify({ evt: 'ai_call', ...fields }));
}

export async function handleRequest(req, deps = {}) {
  const { env = {}, fetchImpl = fetch, limiter = defaultLimiter, health = defaultHealth, now = Date.now, retry = {} } = deps;
  const cors = corsHeaders(req, env);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return fail(405, 'Method not allowed.', cors);

  const user = await authenticate(req, env, fetchImpl);
  if (!user) return fail(401, 'Please sign in to use AI features.', cors);

  const rate = limiter.check(user.id, now());
  if (!rate.ok) return fail(429, 'Too many requests. Please wait a moment and try again.', { ...cors, 'Retry-After': String(rate.retryAfter) }, { retryAfter: rate.retryAfter });

  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > LIMITS.maxBodyBytes) return fail(413, 'Request is too large.', cors);

  let body;
  try {
    const raw = await req.text();
    if (raw.length > LIMITS.maxBodyBytes) return fail(413, 'Request is too large.', cors);
    body = JSON.parse(raw);
  } catch { return fail(400, 'Request body is not valid JSON.', cors); }

  const problem = validate(body);
  if (problem) return fail(400, problem, cors);

  // The server, not the caller, decides provider and model, so a client can't pick an expensive one.
  // The caller may only name a task, which selects a server-side chain of routes to try in order.
  const task = typeof body.task === 'string' && TASKS.includes(body.task) ? body.task : 'general';
  const routes = buildRoutes(env, task);
  if (routes.length === 0) {
    // Only presence flags and a length are reported (never a value), and only to a signed-in caller,
    // so a misconfiguration can be diagnosed without reading the server's logs.
    const diag = {
      aiProvider: setting(env, 'AI_PROVIDER') || null,
      keysPresent: Object.fromEntries(Object.entries(KEY_ENV).map(([p, name]) => [p, setting(env, name) !== ''])),
      keyLengths: Object.fromEntries(Object.entries(KEY_ENV).map(([p, name]) => [p, setting(env, name).length])),
    };
    console.error('[ai] No provider key configured:', JSON.stringify(diag));
    return fail(500, 'AI service is not configured.', cors, { diag });
  }

  const t0 = now();
  try {
    const out = await callRoutes(routes, {
      messages: body.messages,
      maxTokens: Math.min(Math.floor(body.maxTokens ?? LIMITS.maxTokensCap), LIMITS.maxTokensCap),
      pdfBase64: body.pdfBase64 || null,
    }, { fetchImpl, now, health, ...retrySettings(env), ...retry });
    logCall({ task, provider: out.route.provider, model: out.route.model, ok: true, attempts: out.attempts, fallback: out.tried.length > 1, tried: out.tried.map(t => t.id + (t.ok ? '' : '!')), ms: now() - t0 });
    return json(200, { text: out.text }, cors);
  } catch (e) {
    if (!(e instanceof ProviderError)) {
      console.error('[ai] Unexpected error:', e?.message);
      return fail(500, 'AI service error.', cors);
    }
    const { status, code, message } = describeFailure(e);
    if (code === 'misconfigured') console.error(`[ai] Provider rejected our credentials (${e.status}).`); // never log keys or bodies
    logCall({ task, ok: false, status: e.status || null, code, attempts: e.attempts ?? 1, tried: (e.tried || []).map(t => t.id + (t.ok ? '' : '!')), ms: now() - t0 });
    return fail(status, message, cors, { code, truncated: e.kind === 'truncated' });
  }
}
