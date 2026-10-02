// Request handling for the `jobs` Edge Function: a thin, validated proxy to the Adzuna job search
// API so the Adzuna app id/key stay on the server. Works for guests (the landing-page search), so
// it is rate limited by client IP rather than by user.

export const LIMITS = { maxTermChars: 100, rateWindowMs: 60_000, rateMax: 30, resultsPerPage: 6, timeoutMs: 8000 };
const EXPERIENCE_YEARS = { 'Entry level': 1, 'Mid level': 3, Senior: 5, 'Director+': 10 };

export function createRateLimiter({ windowMs = LIMITS.rateWindowMs, max = LIMITS.rateMax } = {}) {
  const hits = new Map();
  return {
    check(id, now = Date.now()) {
      const recent = (hits.get(id) || []).filter(t => now - t < windowMs);
      if (recent.length >= max) { hits.set(id, recent); return { ok: false, retryAfter: Math.ceil((recent[0] + windowMs - now) / 1000) }; }
      recent.push(now);
      hits.set(id, recent);
      if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k);
      return { ok: true };
    },
  };
}
const defaultLimiter = createRateLimiter();

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

const json = (status, body, headers) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const fail = (status, message, headers, extra = {}) => json(status, { error: { message, status, ...extra } }, headers);

const clientIp = (req) => (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown').split(',')[0].trim();
const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const safeLink = (u) => (/^https?:\/\//i.test(u || '') ? u : '#'); // never hand the browser a javascript: URL

function mapJob(j) {
  return {
    title: String(j.title || ''),
    company: String(j.company?.display_name || ''),
    location: String(j.location?.display_name || ''),
    link: safeLink(j.redirect_url),
    salaryMin: Number.isFinite(j.salary_min) ? j.salary_min : null,
    salaryMax: Number.isFinite(j.salary_max) ? j.salary_max : null,
    created: j.created || null,
    description: stripHtml(j.description).slice(0, 200),
  };
}

export async function handleRequest(req, deps = {}) {
  const { env = {}, fetchImpl = fetch, limiter = defaultLimiter, now = Date.now } = deps;
  const cors = corsHeaders(req, env);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return fail(405, 'Method not allowed.', cors);

  const rate = limiter.check(clientIp(req), now());
  if (!rate.ok) return fail(429, 'Too many searches. Please wait a moment.', { ...cors, 'Retry-After': String(rate.retryAfter) }, { retryAfter: rate.retryAfter });

  let body;
  try { body = JSON.parse(await req.text()); } catch { return fail(400, 'Request body is not valid JSON.', cors); }
  const what = typeof body?.what === 'string' ? body.what.trim() : '';
  const where = typeof body?.where === 'string' ? body.where.trim() : '';
  if (!what || !where) return fail(400, '"what" and "where" are required.', cors);
  if (what.length > LIMITS.maxTermChars || where.length > LIMITS.maxTermChars) return fail(400, 'Search terms are too long.', cors);
  if (body.experience !== undefined && body.experience !== null && typeof body.experience !== 'string') return fail(400, 'experience must be a string.', cors);

  if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) {
    console.error('[jobs] ADZUNA_APP_ID / ADZUNA_APP_KEY are not set.');
    return fail(500, 'Job search is not configured.', cors);
  }

  const country = where.toLowerCase().includes('singapore') ? 'sg' : 'gb';
  const years = EXPERIENCE_YEARS[body.experience];
  const params = new URLSearchParams({
    app_id: env.ADZUNA_APP_ID,
    app_key: env.ADZUNA_APP_KEY,
    what,
    where,
    results_per_page: String(LIMITS.resultsPerPage),
    sort_by: 'date',
    'content-type': 'application/json',
  });
  if (years) params.set('salary_min', String(years * 12000));

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LIMITS.timeoutMs);
  try {
    const r = await fetchImpl(`https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`, { signal: ctrl.signal });
    if (!r.ok) {
      // 401/403 means our credentials are wrong; keep that detail in the logs, not the response.
      console.error(`[jobs] Adzuna responded ${r.status}.`);
      return fail(r.status === 429 ? 429 : 502, r.status === 429 ? 'Job search is busy. Please try again shortly.' : 'Job search is unavailable right now.', cors);
    }
    const data = await r.json();
    const jobs = (data.results || []).slice(0, LIMITS.resultsPerPage).map(mapJob);
    return json(200, { count: Number(data.count) || 0, jobs, country }, cors);
  } catch (e) {
    console.error('[jobs] Adzuna request failed:', e?.name);
    return fail(502, 'Job search is unavailable right now.', cors);
  } finally {
    clearTimeout(timer);
  }
}
