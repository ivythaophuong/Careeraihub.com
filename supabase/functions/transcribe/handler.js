// Request handling for the `transcribe` Edge Function (voice practice spike, owner decisions V1 to V3 and V7 of
// docs/architecture/plans/DECISION-voice-practice-2026-10-18.md).
//
//   { audioBase64, mimeType, durationSec? } -> { text, provider }
//
// Speech becomes text here and nowhere else. The audio is held in memory for the length of the request and dropped: it is not written to
// any table, file or log. The transcript is returned to the browser, which shows it for correction before anything is graded.
// Off unless VOICE_TRANSCRIBE=on, and then only for the user ids in VOICE_ALLOWED_USER_IDS (comma list), so the spike reaches the owner alone.
// English only (the platform is for English speakers). Groq first, OpenAI as fallback; a provider with no key is skipped.
// Not gated by the usage ledger yet: the ledger counts tokens and audio is billed in seconds (decision V6, later, before wide use).
import { corsHeaders, json, fail, authenticate, createRateLimiter } from '../ai/handler.js';

export const LIMITS = {
  maxAudioBytes: 6 * 1024 * 1024, // about 3 minutes of browser-recorded audio is 1 to 4 MB
  maxDurationSec: 200, // the browser stops at 180 s; a little slack for the stop delay
  maxTranscriptChars: 8000,
  rateMax: 10, // requests per user per minute, per function instance
};

const ALLOWED_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/m4a'];
const EXT = { 'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mpeg': 'mp3', 'audio/m4a': 'm4a' };

const PROVIDERS = {
  groq: { key: 'GROQ_API_KEY', url: 'https://api.groq.com/openai/v1/audio/transcriptions', model: 'whisper-large-v3-turbo' },
  openai: { key: 'OPENAI_API_KEY', url: 'https://api.openai.com/v1/audio/transcriptions', model: 'gpt-4o-mini-transcribe' },
};

const limiter = createRateLimiter({ max: LIMITS.rateMax });
const setting = (env, name) => String(env[name] ?? '').trim();

export function voiceAllowed(env, userId) {
  if (setting(env, 'VOICE_TRANSCRIBE').toLowerCase() !== 'on') return false;
  return setting(env, 'VOICE_ALLOWED_USER_IDS').split(',').map(s => s.trim()).filter(Boolean).includes(userId);
}

function decode(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function validate(body) {
  if (!body || typeof body !== 'object') return { status: 400, message: 'Request body must be a JSON object.' };
  const { audioBase64, mimeType, durationSec } = body;
  if (typeof audioBase64 !== 'string' || !audioBase64) return { status: 400, message: 'audioBase64 is required.' };
  if (audioBase64.length * 3 / 4 > LIMITS.maxAudioBytes) return { status: 413, message: 'The recording is too large.' };
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(audioBase64)) return { status: 400, message: 'audioBase64 is not valid base64.' };
  const type = String(mimeType || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.includes(type)) return { status: 400, message: 'Unsupported audio type.' };
  if (durationSec !== undefined && (!Number.isFinite(durationSec) || durationSec < 0 || durationSec > LIMITS.maxDurationSec)) return { status: 400, message: 'durationSec is out of range.' };
  return { type };
}

// 'ok' | 'retry' (this provider is busy, down or rejects our key: try the next) | 'reject' (the audio itself was refused: another provider will not help)
async function transcribeWith(name, env, fetchImpl, bytes, type) {
  const p = PROVIDERS[name];
  const form = new FormData();
  form.set('file', new Blob([bytes], { type }), `answer.${EXT[type]}`);
  form.set('model', p.model);
  form.set('language', 'en');
  form.set('temperature', '0');
  form.set('response_format', 'json');
  let res;
  try { res = await fetchImpl(p.url, { method: 'POST', headers: { Authorization: `Bearer ${setting(env, p.key)}` }, body: form }); }
  catch { return { kind: 'retry' }; }
  if (res.ok) {
    let data = null;
    try { data = await res.json(); } catch { return { kind: 'retry' }; }
    return { kind: 'ok', text: typeof data?.text === 'string' ? data.text : '' };
  }
  if (res.status === 429 || res.status >= 500 || res.status === 401 || res.status === 403) return { kind: 'retry', status: res.status };
  return { kind: 'reject', status: res.status };
}

export async function handleRequest(req, deps = {}) {
  const { env = {}, fetchImpl = fetch, limiter: rl = limiter, now = Date.now } = deps;
  const log = deps.log || ((line) => console.log('[usage]', JSON.stringify(line)));
  const cors = corsHeaders(req, env);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return fail(405, 'Method not allowed.', cors);
  if (setting(env, 'VOICE_TRANSCRIBE').toLowerCase() !== 'on') return fail(403, 'Voice practice is not available.', cors);

  const user = await authenticate(req, env, fetchImpl);
  if (!user) return fail(401, 'Please sign in to use voice practice.', cors);
  if (!voiceAllowed(env, user.id)) return fail(403, 'Voice practice is not available.', cors);

  const rate = rl.check(user.id, now());
  if (!rate.ok) return fail(429, 'Too many requests. Please wait a moment and try again.', { ...cors, 'Retry-After': String(rate.retryAfter) }, { retryAfter: rate.retryAfter });

  const declared = Number(req.headers.get('content-length') || 0);
  const maxRaw = Math.ceil(LIMITS.maxAudioBytes * 4 / 3) + 4096;
  if (declared > maxRaw) return fail(413, 'The recording is too large.', cors);

  let body;
  try {
    const raw = await req.text();
    if (raw.length > maxRaw) return fail(413, 'The recording is too large.', cors);
    body = JSON.parse(raw);
  } catch { return fail(400, 'Request body is not valid JSON.', cors); }

  const v = validate(body);
  if (v.message) return fail(v.status, v.message, cors);

  const chain = ['groq', 'openai'].filter(n => setting(env, PROVIDERS[n].key) !== '');
  if (chain.length === 0) { console.error('[transcribe] No speech provider key configured.'); return fail(500, 'Voice service is not configured.', cors); }

  const bytes = decode(body.audioBase64);
  const audioSec = Number.isFinite(body.durationSec) ? Math.round(body.durationSec) : null;
  for (const name of chain) {
    const r = await transcribeWith(name, env, fetchImpl, bytes, v.type);
    log({ event: 'voice_usage', feature: 'voice_transcribe', provider: name, audioSec, outcome: r.kind === 'ok' ? 'success' : r.kind, ...(r.status ? { status: r.status } : {}) });
    if (r.kind === 'retry') continue;
    if (r.kind === 'reject') return fail(422, 'We could not read that recording. Please try again, or type your answer.', cors);
    const text = r.text.trim().slice(0, LIMITS.maxTranscriptChars);
    if (!text) return fail(422, 'We could not hear any speech. Check your microphone and try again, or type your answer.', cors);
    return json(200, { text, provider: name }, cors);
  }
  return fail(502, 'The speech service is busy. Please try again shortly, or type your answer.', cors);
}
