// @vitest-environment jsdom
// Real supabase.js + real session.js together (no mocks): the two modules import each other, so this
// proves the cycle loads and that an expired login token is refreshed before a database call.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sb } from './supabase';

const KEY = 'supabase.auth.token';
const jwt = (expSec) => `h.${btoa(JSON.stringify({ exp: expSec })).replace(/=/g, '')}.s`;
const nowSec = () => Math.floor(Date.now() / 1000);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

let fetchMock;
beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

describe('sb database calls with the real session module', () => {
  it('refreshes an expired token first and sends the new one', async () => {
    localStorage.setItem(KEY, JSON.stringify({ currentSession: { access_token: jwt(nowSec() - 10), refresh_token: 'r1', user: { id: 'u1' } } }));
    fetchMock.mockImplementation(async (url) =>
      String(url).includes('grant_type=refresh_token')
        ? json({ access_token: jwt(nowSec() + 3600), refresh_token: 'r2' })
        : json([{ ok: true }]));

    const rows = await sb.select('profiles', { id: 'eq.u1' }, 'stale-token-from-react-state');
    expect(rows).toEqual([{ ok: true }]);

    const refreshCall = fetchMock.mock.calls.find(([u]) => String(u).includes('grant_type=refresh_token'));
    expect(JSON.parse(refreshCall[1].body)).toEqual({ refresh_token: 'r1' });
    const dbCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/rest/v1/profiles'));
    expect(dbCall[1].headers.Authorization).not.toContain('stale-token-from-react-state');
    expect(dbCall[1].headers.Authorization).toMatch(/^Bearer h\./);
    // and the refreshed session is stored for the next call
    expect(JSON.parse(localStorage.getItem(KEY)).currentSession.refresh_token).toBe('r2');
  });

  it('uses the stored token as is when it is still valid (no refresh call)', async () => {
    const token = jwt(nowSec() + 3600);
    localStorage.setItem(KEY, JSON.stringify({ currentSession: { access_token: token, refresh_token: 'r1' } }));
    fetchMock.mockResolvedValue(json([]));
    await sb.select('profiles', {}, 'stale');
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('grant_type=refresh_token'))).toBe(false);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${token}`);
  });

  it('with no stored session (guest) falls back to the token it was given', async () => {
    fetchMock.mockResolvedValue(json([]));
    await sb.select('profiles', {}, 'given');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer given');
  });

  it('two calls at once share one refresh (refresh tokens are single-use)', async () => {
    localStorage.setItem(KEY, JSON.stringify({ currentSession: { access_token: jwt(nowSec() - 10), refresh_token: 'r1' } }));
    fetchMock.mockImplementation(async (url) =>
      String(url).includes('grant_type=refresh_token')
        ? json({ access_token: jwt(nowSec() + 3600), refresh_token: 'r2' })
        : json([]));
    await Promise.all([sb.select('a', {}, 'x'), sb.select('b', {}, 'x'), sb.insert('c', {}, 'x')]);
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('grant_type=refresh_token'))).toHaveLength(1);
  });
});
