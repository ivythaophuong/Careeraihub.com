// Request handling for the `verify-cert` Edge Function: given a certificate link, fetch the issuing
// platform's public page and report what it says. Because the function fetches a URL the caller
// supplies, it only ever talks to an allowlist of platform hosts (exact hostname match over HTTPS),
// re-checks every redirect hop against the same allowlist, and caps time and size.

export const LIMITS = {
  maxUrlChars: 2048,
  timeoutMs: 8000,
  maxRedirects: 3,
  maxBodyBytes: 1_500_000,
  rateWindowMs: 60_000,
  rateMax: 20, // requests per user per window, per function instance
};

// Exact hostnames and path prefixes accepted for each platform.
export const PLATFORMS = {
  coursera: { hosts: ['coursera.org', 'www.coursera.org'], paths: ['/verify/', '/account/accomplishments/'] },
  udemy: { hosts: ['udemy.com', 'www.udemy.com'], paths: ['/certificate/'] },
  accredible: { hosts: ['credential.net', 'www.credential.net', 'accredible.com', 'www.accredible.com'], paths: ['/'] },
  edx: { hosts: ['courses.edx.org', 'edx.org', 'www.edx.org'], paths: ['/certificates/'] },
  freecodecamp: { hosts: ['freecodecamp.org', 'www.freecodecamp.org'], paths: ['/certification/'] },
};

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class VerifyError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'VerifyError';
    this.status = status;
  }
}

// Returns { platform, url } for an acceptable certificate link, or { error } saying why not.
// The hostname must match exactly, so `evil.com/coursera.org/verify/x` and `coursera.org.evil.com` fail.
export function parseCertUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return { error: 'url required' };
  if (raw.length > LIMITS.maxUrlChars) return { error: 'url is too long' };
  let u;
  try { u = new URL(raw.trim()); } catch { return { error: 'url is not valid' }; }
  if (u.protocol !== 'https:') return { error: 'Only https links are supported' };
  if (u.username || u.password) return { error: 'url must not contain credentials' };
  if (u.port) return { error: 'url must not specify a port' };
  const host = u.hostname.toLowerCase();
  for (const [platform, rule] of Object.entries(PLATFORMS)) {
    if (!rule.hosts.includes(host)) continue;
    if (!rule.paths.some(p => u.pathname.startsWith(p))) return { error: 'Unsupported certificate link' };
    u.hash = '';
    return { platform, url: u.href };
  }
  return { error: 'Unsupported platform' };
}

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

// The client reads `error` as a string.
const json = (status, body, headers) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const fail = (status, message, headers, extra = {}) => json(status, { error: message, ...extra }, headers);

// Supabase's gateway accepts the public anon key as a valid JWT, so ask the auth server who the
// caller really is. The anon key (or any non-user token) has no user and is rejected.
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

// ── Safe fetching ────────────────────────────────────────────────────────────

async function readCapped(res, maxBytes) {
  if (!res.body) {
    const t = await res.text();
    if (t.length > maxBytes) throw new VerifyError('The certificate page is too large.', 502);
    return t;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new VerifyError('The certificate page is too large.', 502);
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

// Fetches `url`, following up to maxRedirects redirects by hand so each hop is re-checked against the
// allowlist for the same platform. Returns { text, url } for the final page.
async function fetchPage(url, platform, fetchImpl, accept = 'text/html') {
  let current = url;
  for (let hop = 0; hop <= LIMITS.maxRedirects; hop++) {
    let res;
    try {
      res = await fetchImpl(current, {
        headers: { 'User-Agent': UA, Accept: accept },
        redirect: 'manual',
        signal: AbortSignal.timeout(LIMITS.timeoutMs),
      });
    } catch (e) {
      const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
      throw new VerifyError(timedOut ? 'The platform took too long to respond.' : 'Could not reach the platform.', 502);
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new VerifyError('The platform sent an invalid redirect.', 502);
      let next;
      try { next = new URL(loc, current).href; } catch { throw new VerifyError('The platform sent an invalid redirect.', 502); }
      const parsed = parseCertUrl(next);
      if (parsed.error || parsed.platform !== platform) throw new VerifyError('The link redirects somewhere that is not supported.', 400);
      current = parsed.url;
      continue;
    }
    if (!res.ok) throw new VerifyError(`The platform returned ${res.status}. The certificate may be private or invalid.`, 502);
    return { text: await readCapped(res, LIMITS.maxBodyBytes), url: current };
  }
  throw new VerifyError('Too many redirects.', 502);
}

// ── Page parsing ─────────────────────────────────────────────────────────────

function extractJsonLd(html) {
  const m = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try { return JSON.parse(m[1].trim()); } catch { return null; }
}

function extractMeta(html, prop) {
  const m =
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
  return m?.[1] ?? null;
}

// A page that loads is not proof of a certificate: sites often serve a generic page for a bad id.
// Only call it verified when the page names the credential AND carries structured data or a
// recipient. Otherwise the link is accepted as well-formed (urlValid) but not verified.
function finish(platform, url, fields, ld) {
  const verified = Boolean(fields.name && (fields.recipientName || ld));
  return { verified, urlValid: true, platform, ...fields, badgeUrl: url };
}

const PARSERS = {
  coursera(html, url) {
    const ld = extractJsonLd(html);
    return finish('coursera', url, {
      name: ld?.name ?? extractMeta(html, 'og:title')?.replace(/ \| Coursera$/, '') ?? null,
      recipientName: ld?.awardedTo?.name ?? ld?.recipient?.name ?? null,
      issuer: ld?.recognizedBy?.name ?? ld?.issuedBy?.name ?? ld?.sourceOrganization?.name ?? 'Coursera',
      issuedAt: ld?.dateCreated ?? ld?.completionDate ?? ld?.datePublished ?? null,
    }, ld);
  },
  udemy(html, url) {
    const ld = extractJsonLd(html);
    const title = extractMeta(html, 'og:title') ?? '';
    return finish('udemy', url, {
      name: ld?.name ?? (title.replace(/ \| Udemy$/, '').replace(/^Certificate of Completion: /, '') || null),
      recipientName: ld?.awardedTo?.name ?? null,
      issuer: 'Udemy',
      issuedAt: ld?.dateCreated ?? null,
    }, ld);
  },
  accredible(html, url) {
    const ld = extractJsonLd(html);
    return finish('accredible', url, {
      name: ld?.name ?? extractMeta(html, 'og:title') ?? null,
      recipientName: ld?.awardedTo?.name ?? null,
      issuer: ld?.issuedBy?.name ?? 'Accredible',
      issuedAt: ld?.dateCreated ?? null,
    }, ld);
  },
  edx(html, url) {
    const ld = extractJsonLd(html);
    return finish('edx', url, {
      name: ld?.name ?? extractMeta(html, 'og:title')?.replace(/ \| edX$/, '') ?? null,
      recipientName: ld?.awardedTo?.name ?? null,
      issuer: ld?.issuedBy?.name ?? ld?.recognizedBy?.name ?? 'edX',
      issuedAt: ld?.dateCreated ?? null,
    }, ld);
  },
  freecodecamp(html, url) {
    const ld = extractJsonLd(html);
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    return finish('freecodecamp', url, {
      name: ld?.name ?? titleMatch?.[1]?.replace(/ \| freeCodeCamp\.org$/, '') ?? null,
      recipientName: ld?.awardedTo?.name ?? null,
      issuer: 'freeCodeCamp',
      issuedAt: ld?.dateCreated ?? null,
    }, ld);
  },
};

// Accredible publishes a JSON API for numeric credential ids; use it first, then the page.
async function verifyAccredible(url, fetchImpl) {
  const idMatch = new URL(url).pathname.match(/^\/(?:credentials\/)?(\d+)\/?$/);
  if (idMatch) {
    try {
      const api = await fetchPage(`https://api.accredible.com/v1/public/credential?id=${idMatch[1]}`, 'api', fetchImpl, 'application/json');
      const c = JSON.parse(api.text)?.credential;
      if (c) {
        return {
          verified: true, urlValid: true, platform: 'accredible',
          name: c.name ?? c.group_name ?? null,
          recipientName: c.recipient?.name ?? null,
          issuer: c.issuer?.name ?? 'Accredible',
          issuedAt: c.issued_on ?? null,
          expiresAt: c.expired_on ?? null,
          imageUrl: c.badge?.url ?? null,
          badgeUrl: url,
        };
      }
    } catch { /* fall through to the page */ }
  }
  const page = await fetchPage(url, 'accredible', fetchImpl);
  return PARSERS.accredible(page.text, page.url);
}

export async function verifyCertificate(rawUrl, fetchImpl = fetch) {
  const parsed = parseCertUrl(rawUrl);
  if (parsed.error) throw new VerifyError(parsed.error, 400);
  if (parsed.platform === 'accredible') return verifyAccredible(parsed.url, fetchImpl);
  const page = await fetchPage(parsed.url, parsed.platform, fetchImpl);
  return PARSERS[parsed.platform](page.text, page.url);
}

// ── Entry point ──────────────────────────────────────────────────────────────

export async function handleRequest(req, deps = {}) {
  const { env = {}, fetchImpl = fetch, limiter = defaultLimiter, now = Date.now } = deps;
  const cors = corsHeaders(req, env);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return fail(405, 'Method not allowed.', cors);

  const user = await authenticate(req, env, fetchImpl);
  if (!user) return fail(401, 'Please sign in to verify credentials.', cors);

  const rate = limiter.check(user.id, now());
  if (!rate.ok) return fail(429, 'Too many requests. Please wait a moment and try again.', { ...cors, 'Retry-After': String(rate.retryAfter) }, { retryAfter: rate.retryAfter });

  let body;
  try { body = JSON.parse(await req.text()); } catch { return fail(400, 'Request body is not valid JSON.', cors); }

  try {
    return json(200, await verifyCertificate(body?.url, fetchImpl), cors);
  } catch (e) {
    if (e instanceof VerifyError) return fail(e.status, e.message, cors);
    console.error('[verify-cert] Unexpected error:', e?.message);
    return fail(500, 'Verification failed.', cors);
  }
}
