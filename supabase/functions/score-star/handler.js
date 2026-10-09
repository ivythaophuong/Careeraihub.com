// Request handling for the `score-star` Edge Function (finding F-1, S4).
// The browser sends the words the user wrote; the SERVER asks the model, computes the score with the shared rules
// and writes the star_stories row with the service role. The browser never sends a score to be stored.
//
//   { action: 'review', story, context? } -> { result, receipt }   grades the story, saves nothing
//   { action: 'save', story, result, receipt } -> { saved, id, score }   saves a story that this function graded
//
// The receipt is an HMAC over (user id, time, story, section scores, rewrite, one-liner). 'save' recomputes the overall
// score from the signed section scores, so changing any number or the rewrite in transit invalidates the receipt.
import { callProvider, pickProvider, resolveModel, setting, KEY_ENV, ProviderError } from '../ai/providers.js';
import { corsHeaders, json, fail, authenticate, createRateLimiter } from '../ai/handler.js';
import { SECTIONS, MIN_FIELD_CHARS, MAX_FIELD_CHARS, buildStarPrompt, normalizeStarResult, overallScore } from '../_shared/starScoring.js';
import { extractJSON } from '../_shared/extractJson.js';
import { signingKey, hmacHex, sameText, rest, countLastDay } from '../_shared/receipt.js';

export const LIMITS = {
  maxBodyBytes: 64 * 1024,
  receiptTtlMs: 2 * 60 * 60 * 1000,
  dailySaves: 30, // stories saved per user per 24 hours
  rateMax: 10, // requests per user per minute, per function instance
  maxTokens: 2500,
};

const defaultLimiter = createRateLimiter({ max: LIMITS.rateMax });
// What the receipt covers. Fixed field order so the same content always signs the same way.
const canonical = (uid, ts, story, scores, refined, oneLiner) =>
  JSON.stringify([uid, ts, SECTIONS.map(k => story[k]), SECTIONS.map(k => scores[k]), SECTIONS.map(k => refined[k]), oneLiner]);

function readStory(story) {
  if (!story || typeof story !== 'object') return { error: 'story must be an object.' };
  const out = {};
  for (const k of SECTIONS) {
    const v = typeof story[k] === 'string' ? story[k].trim() : '';
    if (v.length < MIN_FIELD_CHARS) return { error: `Add a little more detail to "${k}" (at least ${MIN_FIELD_CHARS} characters).` };
    if (v.length > MAX_FIELD_CHARS) return { error: `"${k}" is too long (at most ${MAX_FIELD_CHARS} characters).` };
    out[k] = v;
  }
  return { story: out };
}

const clipText = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

async function review(body, user, env, fetchImpl, cors, now) {
  const { story, error } = readStory(body.story);
  if (error) return fail(400, error, cors);
  const provider = pickProvider(env);
  if (!provider) { console.error('[score-star] No provider key configured.'); return fail(500, 'AI service is not configured.', cors); }
  const ctx = body.context && typeof body.context === 'object' ? body.context : {};
  const prompt = buildStarPrompt(story, { role: clipText(ctx.role, 80), level: clipText(ctx.level, 40), industry: clipText(ctx.industry, 80) });
  let result;
  try {
    const text = await callProvider({
      provider, model: resolveModel(provider, setting(env, 'AI_MODEL')), key: setting(env, KEY_ENV[provider]),
      messages: [{ role: 'user', content: prompt }], maxTokens: LIMITS.maxTokens, pdfBase64: null,
    }, fetchImpl);
    result = normalizeStarResult(extractJSON(text));
  } catch (e) {
    if (e instanceof ProviderError) {
      console.error(`[score-star] Provider error ${e.status ?? ''} ${e.kind ?? ''}`);
      return fail(e.status === 429 ? 429 : e.kind === 'truncated' || e.kind === 'blocked' ? 422 : 502, 'The AI could not review the story. Please try again.', cors);
    }
    return fail(502, e?.message || 'The AI returned an unreadable review. Please try again.', cors);
  }
  const key = signingKey(env);
  if (!key) { console.error('[score-star] No signing key available.'); return fail(500, 'Scoring service is not configured.', cors); }
  const ts = now();
  const sig = await hmacHex(key, canonical(user.id, ts, story, result.scores, result.refined, result.oneLiner));
  return json(200, { result, receipt: { ts, sig } }, cors);
}

async function save(body, user, env, fetchImpl, cors, now) {
  const { story, error } = readStory(body.story);
  if (error) return fail(400, error, cors);
  const r = body.result, rc = body.receipt;
  const scores = {}, refined = {};
  for (const k of SECTIONS) {
    scores[k] = r?.scores?.[k];
    refined[k] = r?.refined?.[k];
    if (!Number.isInteger(scores[k]) || scores[k] < 0 || scores[k] > 100 || typeof refined[k] !== 'string') return fail(400, 'The reviewed story is incomplete.', cors);
  }
  const oneLiner = typeof r?.oneLiner === 'string' ? r.oneLiner : '';
  if (!rc || !Number.isFinite(rc.ts) || typeof rc.sig !== 'string') return fail(400, 'Review the story again before saving.', cors);
  if (now() - rc.ts > LIMITS.receiptTtlMs || rc.ts > now() + 60_000) return fail(409, 'This review has expired. Please review the story again.', cors);
  const key = signingKey(env);
  if (!key) return fail(500, 'Scoring service is not configured.', cors);
  const expected = await hmacHex(key, canonical(user.id, rc.ts, story, scores, refined, oneLiner));
  if (!sameText(expected, rc.sig)) return fail(403, 'This review was not produced by the server. Please review the story again.', cors);
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_URL) { console.error('[score-star] Service role key missing.'); return fail(500, 'Scoring service is not configured.', cors); }

  const score = overallScore(scores);
  try {
    // Same story twice returns the saved row instead of adding a second copy (a receipt could otherwise be replayed).
    const dup = new URLSearchParams({ select: 'id,score', user_id: `eq.${user.id}`, one_liner: `eq.${oneLiner}`, situation: `eq.${story.situation}`, limit: '1' });
    const dupRes = await rest(env, fetchImpl, `star_stories?${dup}`);
    if (!dupRes.ok) throw new Error(`dedupe ${dupRes.status}`);
    const existing = await dupRes.json();
    if (existing[0]) return json(200, { saved: true, id: existing[0].id, score: existing[0].score, duplicate: true }, cors);

    const total = await countLastDay(env, fetchImpl, 'star_stories', user.id, now());
    if (total >= LIMITS.dailySaves) return fail(429, 'Daily limit of saved stories reached. Please try again tomorrow.', cors);

    const ins = await rest(env, fetchImpl, 'star_stories', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: user.id, one_liner: oneLiner, score, ...story, refined }),
    });
    if (!ins.ok) throw new Error(`insert ${ins.status}`);
    const row = (await ins.json())[0];
    return json(200, { saved: true, id: row?.id, score }, cors);
  } catch (e) {
    console.error('[score-star] Save failed:', e?.message);
    return fail(502, 'The story could not be saved. Please try again.', cors);
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

  if (body.action === 'review') return review(body, user, env, fetchImpl, cors, now);
  if (body.action === 'save') return save(body, user, env, fetchImpl, cors, now);
  return fail(400, 'action must be "review" or "save".', cors);
}
