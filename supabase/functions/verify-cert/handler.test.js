// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { handleRequest, parseCertUrl, createRateLimiter, LIMITS } from './handler.js';

const ENV = { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_ANON_KEY: 'anon-key' };
const CERT = 'https://www.coursera.org/verify/ABC123';

const jsonRes = (body, status = 200) => new Response(JSON.stringify(body), { status });
const page = (html, status = 200, headers = {}) => new Response(html, { status, headers });
const ld = (o) => `<html><head><script type="application/ld+json">${JSON.stringify(o)}</script></head></html>`;

// Routes fetches: the auth server vs the platform being checked.
function makeFetch({ user = { id: 'user-1' }, authStatus = 200, platform = () => page(ld({ name: 'Machine Learning', awardedTo: { name: 'Ivy N' } })) } = {}) {
  return vi.fn(async (url, init) => {
    if (String(url).includes('/auth/v1/user')) return authStatus === 200 ? jsonRes(user) : jsonRes({ msg: 'bad jwt' }, authStatus);
    return platform(String(url), init);
  });
}
const platformCalls = (f) => f.mock.calls.filter(([u]) => !String(u).includes('/auth/v1/user'));

const call = (body, { headers = {}, method = 'POST', env = ENV, fetchImpl = makeFetch(), limiter } = {}) =>
  handleRequest(
    new Request('https://proj.supabase.co/functions/v1/verify-cert', {
      method,
      headers: { authorization: 'Bearer user-jwt', 'content-type': 'application/json', ...headers },
      body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }),
    { env, fetchImpl, limiter: limiter || createRateLimiter() },
  );

describe('parseCertUrl', () => {
  it.each([
    ['https://www.coursera.org/verify/ABC', 'coursera'],
    ['https://coursera.org/account/accomplishments/verify/ABC', 'coursera'],
    ['https://www.udemy.com/certificate/UC-123/', 'udemy'],
    ['https://www.credential.net/abc-123', 'accredible'],
    ['https://courses.edx.org/certificates/abc', 'edx'],
    ['https://www.freecodecamp.org/certification/user/responsive-web-design', 'freecodecamp'],
    ['HTTPS://WWW.COURSERA.ORG/verify/ABC', 'coursera'],
  ])('accepts %s', (url, platform) => {
    expect(parseCertUrl(url).platform).toBe(platform);
  });

  it('strips the fragment', () => {
    expect(parseCertUrl('https://www.coursera.org/verify/ABC#frag').url).toBe('https://www.coursera.org/verify/ABC');
  });

  it.each([
    ['https://evil.com/coursera.org/verify/x', 'path trick'],
    ['https://coursera.org.evil.com/verify/x', 'look-alike host'],
    ['https://evilcoursera.org/verify/x', 'suffix host'],
    ['https://coursera.org@evil.com/verify/x', 'userinfo trick'],
    ['https://user:pw@www.coursera.org/verify/x', 'credentials'],
    ['https://www.coursera.org:8443/verify/x', 'port'],
    ['http://www.coursera.org/verify/x', 'plain http'],
    ['https://www.coursera.org/learn/machine-learning', 'wrong path'],
    ['https://169.254.169.254/latest/meta-data/', 'metadata ip'],
    ['https://localhost/verify/x', 'localhost'],
    ['https://[::1]/verify/x', 'ipv6 loopback'],
    ['javascript:alert(1)', 'js scheme'],
    ['file:///etc/passwd', 'file scheme'],
    ['not a url', 'garbage'],
    ['', 'empty'],
  ])('rejects %s (%s)', (url) => {
    expect(parseCertUrl(url).error).toBeTruthy();
  });

  it('rejects non-strings and very long urls', () => {
    expect(parseCertUrl(undefined).error).toBeTruthy();
    expect(parseCertUrl({}).error).toBeTruthy();
    expect(parseCertUrl(`https://www.coursera.org/verify/${'a'.repeat(LIMITS.maxUrlChars)}`).error).toBeTruthy();
  });
});

describe('handleRequest: access', () => {
  it('answers CORS preflight for the allowed origin', async () => {
    const res = await call(null, { method: 'OPTIONS', headers: { origin: 'https://careeraihub.com' }, env: { ...ENV, ALLOWED_ORIGINS: 'https://careeraihub.com' } });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://careeraihub.com');
  });

  it('does not echo an unlisted origin', async () => {
    const res = await call(null, { method: 'OPTIONS', headers: { origin: 'https://evil.example' }, env: { ...ENV, ALLOWED_ORIGINS: 'https://careeraihub.com' } });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://careeraihub.com');
  });

  it('rejects non-POST', async () => {
    expect((await call(null, { method: 'GET' })).status).toBe(405);
  });

  it('401s with no login and never fetches the platform', async () => {
    const f = makeFetch();
    const res = await call({ url: CERT }, { headers: { authorization: '' }, fetchImpl: f });
    expect(res.status).toBe(401);
    expect(platformCalls(f)).toHaveLength(0);
  });

  it('401s for the public anon key (no user behind the token)', async () => {
    const f = makeFetch({ authStatus: 401 });
    const res = await call({ url: CERT }, { fetchImpl: f });
    expect(res.status).toBe(401);
    expect(platformCalls(f)).toHaveLength(0);
  });

  it('rate limits per user', async () => {
    const limiter = createRateLimiter({ max: 2 });
    await call({ url: CERT }, { limiter });
    await call({ url: CERT }, { limiter });
    const res = await call({ url: CERT }, { limiter });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
  });

  it('400s on a non-JSON body', async () => {
    expect((await call('{nope')).status).toBe(400);
  });
});

describe('handleRequest: rejected links never reach the network', () => {
  it.each([
    'https://evil.com/coursera.org/verify/x',
    'https://169.254.169.254/latest/meta-data/',
    'http://www.coursera.org/verify/x',
  ])('%s', async (url) => {
    const f = makeFetch();
    const res = await call({ url }, { fetchImpl: f });
    expect(res.status).toBe(400);
    expect(typeof (await res.json()).error).toBe('string');
    expect(platformCalls(f)).toHaveLength(0);
  });

  it('400s when url is missing', async () => {
    const res = await call({});
    expect(res.status).toBe(400);
  });
});

describe('handleRequest: verification', () => {
  it('verifies a certificate page with structured data', async () => {
    const res = await call({ url: CERT });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      verified: true, urlValid: true, platform: 'coursera', name: 'Machine Learning', recipientName: 'Ivy N', issuer: 'Coursera', badgeUrl: CERT,
    });
  });

  it('fetches with manual redirects and a timeout signal', async () => {
    const f = makeFetch();
    await call({ url: CERT }, { fetchImpl: f });
    const [, init] = platformCalls(f)[0];
    expect(init.redirect).toBe('manual');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not call a generic page "verified" (no structured data, no recipient)', async () => {
    const f = makeFetch({ platform: () => page('<html><head><meta property="og:title" content="Coursera | Online Courses"></head></html>') });
    const body = await (await call({ url: CERT }, { fetchImpl: f })).json();
    expect(body.verified).toBe(false);
    expect(body.urlValid).toBe(true);
  });

  it('does not verify a page that names nothing', async () => {
    const f = makeFetch({ platform: () => page('<html></html>') });
    const body = await (await call({ url: CERT }, { fetchImpl: f })).json();
    expect(body.verified).toBe(false);
  });

  it('502s with a readable message when the platform says 404', async () => {
    const f = makeFetch({ platform: () => page('', 404) });
    const res = await call({ url: CERT }, { fetchImpl: f });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/404/);
  });

  it('502s when the platform cannot be reached', async () => {
    const f = makeFetch({ platform: () => { throw new TypeError('network down'); } });
    const res = await call({ url: CERT }, { fetchImpl: f });
    expect(res.status).toBe(502);
  });

  it('reports a timeout', async () => {
    const f = makeFetch({ platform: () => { throw Object.assign(new Error('t'), { name: 'TimeoutError' }); } });
    const res = await call({ url: CERT }, { fetchImpl: f });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/too long/);
  });

  it('refuses an oversized page', async () => {
    const big = 'x'.repeat(LIMITS.maxBodyBytes + 10);
    const f = makeFetch({ platform: () => page(big) });
    const res = await call({ url: CERT }, { fetchImpl: f });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/too large/);
  });
});

describe('handleRequest: redirects', () => {
  it('follows a redirect that stays on the same platform', async () => {
    const f = makeFetch({
      platform: (url) => url.endsWith('/verify/ABC123')
        ? page('', 302, { location: 'https://www.coursera.org/verify/FINAL' })
        : page(ld({ name: 'Course', awardedTo: { name: 'Ivy' } })),
    });
    const body = await (await call({ url: CERT }, { fetchImpl: f })).json();
    expect(body.verified).toBe(true);
    expect(body.badgeUrl).toBe('https://www.coursera.org/verify/FINAL');
  });

  it.each([
    'https://evil.com/steal',
    'http://169.254.169.254/latest/meta-data/',
    'https://www.udemy.com/certificate/UC-1/',
  ])('refuses a redirect to %s', async (target) => {
    const f = makeFetch({ platform: () => page('', 302, { location: target }) });
    const res = await call({ url: CERT }, { fetchImpl: f });
    expect(res.status).toBe(400);
    expect(platformCalls(f)).toHaveLength(1); // the off-list hop was never fetched
  });

  it('gives up after too many redirects', async () => {
    const f = makeFetch({ platform: () => page('', 302, { location: 'https://www.coursera.org/verify/LOOP' }) });
    const res = await call({ url: CERT }, { fetchImpl: f });
    expect(res.status).toBe(502);
    expect(platformCalls(f)).toHaveLength(LIMITS.maxRedirects + 1);
  });
});

describe('handleRequest: Accredible', () => {
  it('uses the JSON API for a numeric id', async () => {
    const f = makeFetch({
      platform: (url) => url.startsWith('https://api.accredible.com/')
        ? jsonRes({ credential: { name: 'Cloud Pro', recipient: { name: 'Ivy' }, issuer: { name: 'Acme' }, issued_on: '2026-01-01' } })
        : page(''),
    });
    const body = await (await call({ url: 'https://www.credential.net/123456' }, { fetchImpl: f })).json();
    expect(body).toMatchObject({ verified: true, platform: 'accredible', name: 'Cloud Pro', issuer: 'Acme' });
    expect(platformCalls(f)[0][0]).toBe('https://api.accredible.com/v1/public/credential?id=123456');
  });

  it('falls back to the page when the API fails', async () => {
    const f = makeFetch({
      platform: (url) => url.startsWith('https://api.accredible.com/')
        ? page('', 500)
        : page(ld({ name: 'Cloud Pro', awardedTo: { name: 'Ivy' } })),
    });
    const body = await (await call({ url: 'https://www.credential.net/123456' }, { fetchImpl: f })).json();
    expect(body.verified).toBe(true);
  });
});
