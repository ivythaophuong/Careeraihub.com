// Request handling for the `score-interview` Edge Function (finding F-1, S4 slice 2).
// The server grades each interview answer and writes the mock_sessions row; the browser never sends a score to be stored.
//
//   { action: 'evaluate', personaId, role?, question, answer, resumeText? } -> { feedback, receipt }   grades one answer, saves nothing
//   { action: 'save', personaId, role?, items: [{ question, answer, score, ts, sig }] } -> { saved, id, avgScore, questionsCount }
//
// Each receipt is an HMAC over (user id, time, persona, question, answer, score). 'save' checks every receipt and computes the
// average itself from the signed scores, so a changed score, answer or user, or a made-up item, is refused.
// Known limits: the questions come from the `ai` function and are not signed (a user can practise on questions of their own choosing);
// a valid session can be saved again (capped at 10 sessions per user per 24 hours) because mock_sessions has no column to remember it.
import { callProvider, pickProvider, resolveModel, setting, KEY_ENV, ProviderError } from '../ai/providers.js';
import { corsHeaders, json, fail, authenticate, createRateLimiter } from '../ai/handler.js';
import { PERSONAS, MIN_ANSWER_CHARS, MAX_ANSWER_CHARS, buildEvaluationPrompt, normalizeEvaluation } from '../_shared/interviewScoring.js';
import { extractJSON } from '../_shared/extractJson.js';
import { signingKey, hmacHex, sameText, rest, countLastDay } from '../_shared/receipt.js';

export const LIMITS = {
  maxBodyBytes: 64 * 1024,
  receiptTtlMs: 2 * 60 * 60 * 1000,
  dailySessions: 10,
  maxItems: 5,
  maxQuestionChars: 500,
  maxResumeChars: 6000,
  rateMax: 20, // requests per user per minute, per function instance
  maxTokens: 1800,
};

const defaultLimiter = createRateLimiter({ max: LIMITS.rateMax });

const canonical = (uid, ts, personaId, question, answer, score) => JSON.stringify([uid, ts, personaId, question, answer, score]);
const text = (v) => (typeof v === 'string' ? v.trim() : '');

async function evaluate(body, user, env, fetchImpl, cors, now) {
  const personaId = body.personaId;
  const question = text(body.question), answer = text(body.answer);
  if (!PERSONAS[personaId]) return fail(400, 'Unknown interview style.', cors);
  if (!question || question.length > LIMITS.maxQuestionChars) return fail(400, 'The question is missing or too long.', cors);
  if (answer.length < MIN_ANSWER_CHARS) return fail(400, `Answer a bit more fully (at least ${MIN_ANSWER_CHARS} characters).`, cors);
  if (answer.length > MAX_ANSWER_CHARS) return fail(400, `The answer is too long (at most ${MAX_ANSWER_CHARS} characters).`, cors);
  const provider = pickProvider(env);
  if (!provider) { console.error('[score-interview] No provider key configured.'); return fail(500, 'AI service is not configured.', cors); }
  const resumeText = text(body.resumeText).slice(0, LIMITS.maxResumeChars);
  const resume = resumeText ? { kind: 'text', text: resumeText } : { kind: 'none' };

  let feedback;
  try {
    const reply = await callProvider({
      provider, model: resolveModel(provider, setting(env, 'AI_MODEL')), key: setting(env, KEY_ENV[provider]),
      messages: [{ role: 'user', content: buildEvaluationPrompt({ personaId, role: text(body.role).slice(0, 80), question, answer, resume }) }],
      maxTokens: LIMITS.maxTokens, pdfBase64: null,
    }, fetchImpl);
    feedback = normalizeEvaluation(extractJSON(reply));
  } catch (e) {
    if (e instanceof ProviderError) {
      console.error(`[score-interview] Provider error ${e.status ?? ''} ${e.kind ?? ''}`);
      return fail(e.status === 429 ? 429 : e.kind === 'truncated' || e.kind === 'blocked' ? 422 : 502, 'The AI could not evaluate the answer. Please try again.', cors);
    }
    return fail(502, e?.message || 'The AI returned unreadable feedback. Please try again.', cors);
  }
  const key = signingKey(env);
  if (!key) { console.error('[score-interview] No signing key available.'); return fail(500, 'Scoring service is not configured.', cors); }
  const ts = now();
  const sig = await hmacHex(key, canonical(user.id, ts, personaId, question, answer, feedback.score));
  return json(200, { feedback, receipt: { ts, sig } }, cors);
}

async function save(body, user, env, fetchImpl, cors, now) {
  const personaId = body.personaId;
  if (!PERSONAS[personaId]) return fail(400, 'Unknown interview style.', cors);
  const items = body.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > LIMITS.maxItems) return fail(400, `A session needs 1 to ${LIMITS.maxItems} answered questions.`, cors);
  const key = signingKey(env);
  if (!key) return fail(500, 'Scoring service is not configured.', cors);
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_URL) { console.error('[score-interview] Service role key missing.'); return fail(500, 'Scoring service is not configured.', cors); }

  const seen = new Set();
  let sum = 0;
  for (const it of items) {
    const question = text(it?.question), answer = text(it?.answer);
    if (!question || answer.length < MIN_ANSWER_CHARS || !Number.isInteger(it?.score) || it.score < 0 || it.score > 100 || !Number.isFinite(it?.ts) || typeof it?.sig !== 'string') {
      return fail(400, 'An answer in this session is incomplete. Please redo the session.', cors);
    }
    if (now() - it.ts > LIMITS.receiptTtlMs || it.ts > now() + 60_000) return fail(409, 'This session has expired. Please start a new one.', cors);
    const expected = await hmacHex(key, canonical(user.id, it.ts, personaId, question, answer, it.score));
    if (!sameText(expected, it.sig)) return fail(403, 'This score was not produced by the server. Please redo the session.', cors);
    if (seen.has(it.sig)) return fail(400, 'The same answer cannot be counted twice.', cors);
    seen.add(it.sig);
    sum += it.score;
  }
  const avgScore = Math.round(sum / items.length);

  try {
    if (await countLastDay(env, fetchImpl, 'mock_sessions', user.id, now()) >= LIMITS.dailySessions) {
      return fail(429, 'Daily limit of saved interview sessions reached. Please try again tomorrow.', cors);
    }
    const ins = await rest(env, fetchImpl, 'mock_sessions', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: user.id, mode: personaId, questions_count: items.length, avg_score: avgScore }),
    });
    if (!ins.ok) throw new Error(`insert ${ins.status}`);
    const row = (await ins.json())[0];
    return json(200, { saved: true, id: row?.id, avgScore, questionsCount: items.length }, cors);
  } catch (e) {
    console.error('[score-interview] Save failed:', e?.message);
    return fail(502, 'The session could not be saved. Please try again.', cors);
  }
}

export async function handleRequest(req, deps = {}) {
  const { env = {}, fetchImpl = fetch, limiter = defaultLimiter, now = Date.now } = deps;
  const cors = corsHeaders(req, env);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return fail(405, 'Method not allowed.', cors);

  const user = await authenticate(req, env, fetchImpl);
  if (!user) return fail(401, 'Please sign in to use this feature.', cors);

  const rate = limiter.check(user.id, now());
  if (!rate.ok) return fail(429, 'Too many requests. Please wait a moment and try again.', { ...cors, 'Retry-After': String(rate.retryAfter) }, { retryAfter: rate.retryAfter });

  let body;
  try {
    const raw = await req.text();
    if (raw.length > LIMITS.maxBodyBytes) return fail(413, 'Request is too large.', cors);
    body = JSON.parse(raw);
  } catch { return fail(400, 'Request body is not valid JSON.', cors); }
  if (!body || typeof body !== 'object') return fail(400, 'Request body must be a JSON object.', cors);

  if (body.action === 'evaluate') return evaluate(body, user, env, fetchImpl, cors, now);
  if (body.action === 'save') return save(body, user, env, fetchImpl, cors, now);
  return fail(400, 'action must be "evaluate" or "save".', cors);
}
