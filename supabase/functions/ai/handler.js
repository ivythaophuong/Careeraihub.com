// Request handling for the `ai` Edge Function: authenticate the caller, validate and cap the
// request, call the configured provider with a server-held key, return { text }.
import { callWithFallback, providerChain, setting, KEY_ENV, ProviderError } from './providers.js';
import { makeRecorder, sanitizeFeature, userRef as makeUserRef } from '../_shared/usage.js';

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

export function corsHeaders(req, env) {
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

export const json = (status, body, headers) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
export const fail = (status, message, headers, extra = {}) => json(status, { error: { message, status, ...extra } }, headers);

// Supabase's gateway accepts the public anon key as a valid JWT, so ask the auth server who
// the caller really is. The anon key (or any non-user token) has no user and is rejected.
export async function authenticate(req, env, fetchImpl) {
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

function statusFor(err) {
  if (err.kind === 'truncated' || err.kind === 'blocked') return 422;
  if (err.kind === 'empty') return 502;
  if (err.status === 429) return 429;
  if (err.status === 401 || err.status === 403) return 500; // our key is bad: not the caller's fault
  if (err.status >= 400 && err.status < 500) return 400;
  return 502;
}

export async function handleRequest(req, deps = {}) {
  const { env = {}, fetchImpl = fetch, limiter = defaultLimiter, now = Date.now } = deps;
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
  // If the first provider is busy or down, the next keyed provider is tried (see callWithFallback).
  if (providerChain(env).length === 0) {
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

  let requestId = null;
  try {
    // Usage metering (counts and metadata only, see _shared/usage.js). `feature` is an optional label from the app; anything odd becomes "unknown".
    const meter = { record: deps.recordUsage || makeRecorder(), correlationId: crypto.randomUUID(), feature: sanitizeFeature(body.feature), userRef: await makeUserRef(setting(env, 'USAGE_LOG_SALT') || setting(env, 'SUPABASE_SERVICE_ROLE_KEY'), user.id).catch(() => null), priceTable: deps.priceTable };
    requestId = meter.correlationId;
    const text = await callWithFallback({
      env,
      messages: body.messages,
      maxTokens: Math.min(Math.floor(body.maxTokens ?? LIMITS.maxTokensCap), LIMITS.maxTokensCap),
      pdfBase64: body.pdfBase64 || null,
      meter,
    }, fetchImpl);
    return json(200, { text }, cors);
  } catch (e) {
    if (!(e instanceof ProviderError)) {
      console.error('[ai] Unexpected error:', e?.message);
      return fail(500, 'AI service error.', cors);
    }
    const status = statusFor(e);
    if (status === 500) console.error(`[ai] Provider rejected our credentials (${e.status}).`); // never log keys or bodies
    const message = status === 500 ? 'AI service is misconfigured.'
      : status === 429 ? 'The AI provider is busy. Please try again shortly.'
      : e.message.slice(0, 300);
    return fail(status, message, cors, { truncated: e.kind === 'truncated', ...(requestId ? { requestId } : {}) });
  }
}
