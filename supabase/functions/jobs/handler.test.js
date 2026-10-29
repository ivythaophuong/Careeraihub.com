// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { handleRequest, createRateLimiter, LIMITS } from './handler.js';

const ENV = { ADZUNA_APP_ID: 'APPID', ADZUNA_APP_KEY: 'APPKEY-SECRET' };
const ok = (body, status = 200) => new Response(JSON.stringify(body), { status });
const adzuna = (results = [], count = results.length) => vi.fn(async () => ok({ count, results }));

const call = (body, { env = ENV, fetchImpl = adzuna(), limiter, headers = {}, method = 'POST' } = {}) =>
  handleRequest(
    new Request('https://proj.supabase.co/functions/v1/jobs', {
      method, headers: { 'content-type': 'application/json', ...headers },
      body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }),
    { env, fetchImpl, limiter: limiter || createRateLimiter() },
  ).then(async r => ({ status: r.status, headers: r.headers, body: r.status === 204 ? null : await r.json() }));

const Q = { what: 'Product Manager', where: 'Singapore' };

describe('jobs: validation', () => {
  it('works for guests (no Authorization header needed)', async () => {
    expect((await call(Q)).status).toBe(200);
  });
  it.each([
    ['not JSON', 'nope'],
    ['missing what', { where: 'Singapore' }],
    ['missing where', { what: 'x' }],
    ['blank what', { what: '  ', where: 'x' }],
    ['non-string what', { what: 5, where: 'x' }],
    ['too long', { what: 'x'.repeat(LIMITS.maxTermChars + 1), where: 'x' }],
    ['bad experience type', { ...Q, experience: 5 }],
  ])('400: %s', async (_n, body) => { expect((await call(body)).status).toBe(400); });
  it('405 for GET and 204 for OPTIONS', async () => {
    expect((await call(null, { method: 'GET' })).status).toBe(405);
    expect((await call(null, { method: 'OPTIONS' })).status).toBe(204);
  });
});

describe('jobs: Adzuna request', () => {
  it('builds the query on the server with the secret key and encodes user input', async () => {
    const f = adzuna();
    await call({ what: 'C++ & Rust', where: 'Singapore', experience: 'Senior' }, { fetchImpl: f });
    const url = new URL(f.mock.calls[0][0]);
    expect(url.pathname).toBe('/v1/api/jobs/sg/search/1');
    expect(url.searchParams.get('app_id')).toBe('APPID');
    expect(url.searchParams.get('app_key')).toBe('APPKEY-SECRET');
    expect(url.searchParams.get('what')).toBe('C++ & Rust');
    expect(url.searchParams.get('salary_min')).toBe('60000');
  });
  it('uses the gb market outside Singapore and ignores unknown experience labels', async () => {
    const f = adzuna();
    await call({ what: 'x', where: 'London', experience: 'Wizard' }, { fetchImpl: f });
    const url = new URL(f.mock.calls[0][0]);
    expect(url.pathname).toContain('/jobs/gb/');
    expect(url.searchParams.has('salary_min')).toBe(false);
  });
});

describe('jobs: response', () => {
  it('maps jobs, strips HTML, trims descriptions, and blocks non-http links', async () => {
    const f = adzuna([
      { title: 'PM', company: { display_name: 'Acme' }, location: { display_name: 'SG' }, redirect_url: 'https://x.test/1', salary_min: 60000, salary_max: 90000, created: '2026-01-01', description: '<b>Lead</b>   the  team ' + 'z'.repeat(500) },
      { title: 'Evil', redirect_url: 'javascript:alert(1)' },
    ], 1234);
    const r = await call(Q, { fetchImpl: f });
    expect(r.body.count).toBe(1234);
    expect(r.body.jobs[0]).toMatchObject({ title: 'PM', company: 'Acme', location: 'SG', link: 'https://x.test/1', salaryMin: 60000, salaryMax: 90000 });
    expect(r.body.jobs[0].description.startsWith('Lead the team')).toBe(true);
    expect(r.body.jobs[0].description.length).toBeLessThanOrEqual(200);
    expect(r.body.jobs[1].link).toBe('#');
  });
  it('never returns the Adzuna key', async () => {
    const r = await call(Q);
    expect(JSON.stringify(r.body)).not.toContain('APPKEY-SECRET');
  });
});

describe('jobs: failures and limits', () => {
  it('500 "not configured" when the Adzuna secrets are missing', async () => {
    expect((await call(Q, { env: {} })).status).toBe(500);
  });
  it('502 (generic) when Adzuna rejects our credentials, without leaking details', async () => {
    const f = vi.fn(async () => ok({ error: 'bad key APPKEY-SECRET' }, 401));
    const r = await call(Q, { fetchImpl: f });
    expect(r.status).toBe(502);
    expect(JSON.stringify(r.body)).not.toContain('APPKEY-SECRET');
  });
  it('passes through an Adzuna rate limit as 429 and maps a network failure to 502', async () => {
    expect((await call(Q, { fetchImpl: vi.fn(async () => ok({}, 429)) })).status).toBe(429);
    expect((await call(Q, { fetchImpl: vi.fn(async () => { throw new TypeError('x'); }) })).status).toBe(502);
  });
  it('rate limits per client IP', async () => {
    const limiter = createRateLimiter({ max: 2 });
    const h = (ip) => ({ headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` }, limiter });
    expect((await call(Q, h('1.1.1.1'))).status).toBe(200);
    expect((await call(Q, h('1.1.1.1'))).status).toBe(200);
    const blocked = await call(Q, h('1.1.1.1'));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await call(Q, h('2.2.2.2'))).status).toBe(200);
  });
});
