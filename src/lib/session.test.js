import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./supabase', () => ({ sb: { refreshToken: vi.fn() } }));

import { sb } from './supabase';
import {
  normalizeSession, loadSession, saveSession, clearSession, isExpiring,
  getValidSession, refreshSession, REFRESH_SKEW_MS,
} from './session';

const KEY = 'supabase.auth.token';
const store = (session) => localStorage.setItem(KEY, JSON.stringify({ currentSession: session }));
const jwt = (expSec) => `x.${btoa(JSON.stringify({ exp: expSec })).replace(/=/g, '')}.y`;

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

describe('normalizeSession', () => {
  it('uses expires_at (seconds) when present', () => {
    expect(normalizeSession({ access_token: 'a', expires_at: 2000 }).expiresAt).toBe(2_000_000);
  });
  it('derives expiry from expires_in', () => {
    expect(normalizeSession({ access_token: 'a', expires_in: 3600 }, 1000).expiresAt).toBe(3_601_000);
  });
  it('falls back to the JWT exp claim for sessions saved before this module', () => {
    expect(normalizeSession({ access_token: jwt(5000) }).expiresAt).toBe(5_000_000);
  });
  it('yields null expiry when nothing is known', () => {
    expect(normalizeSession({ access_token: 'opaque' }).expiresAt).toBeNull();
  });
});

describe('isExpiring', () => {
  it('is true inside the refresh window and false outside it', () => {
    const now = 1_000_000;
    expect(isExpiring({ expiresAt: now + REFRESH_SKEW_MS - 1 }, now)).toBe(true);
    expect(isExpiring({ expiresAt: now + REFRESH_SKEW_MS + 1000 }, now)).toBe(false);
    expect(isExpiring({ expiresAt: null }, now)).toBe(false);
  });
});

describe('save / load / clear', () => {
  it('round-trips and keeps the existing storage shape', () => {
    saveSession({ access_token: 'a', expires_at: 4000, user: { id: 1 } });
    expect(JSON.parse(localStorage.getItem(KEY)).currentSession.access_token).toBe('a');
    expect(loadSession()).toMatchObject({ access_token: 'a', expiresAt: 4_000_000 });
    clearSession();
    expect(loadSession()).toBeNull();
  });
  it('returns null for corrupt storage', () => {
    localStorage.setItem(KEY, '{not json');
    expect(loadSession()).toBeNull();
  });
});

describe('getValidSession', () => {
  it('returns null when nothing is stored', async () => {
    expect(await getValidSession()).toBeNull();
  });

  it('returns a fresh session without calling the server', async () => {
    store({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600 });
    expect((await getValidSession()).access_token).toBe('a');
    expect(sb.refreshToken).not.toHaveBeenCalled();
  });

  it('refreshes an expired session and stores the new tokens (audit 2.1)', async () => {
    store({ access_token: 'old', refresh_token: 'r1', expires_at: Math.floor(Date.now() / 1000) - 10, user: { id: 'u' } });
    sb.refreshToken.mockResolvedValue({ access_token: 'new', refresh_token: 'r2', expires_in: 3600 });
    const s = await getValidSession();
    expect(sb.refreshToken).toHaveBeenCalledWith('r1');
    expect(s).toMatchObject({ access_token: 'new', refresh_token: 'r2', user: { id: 'u' } });
    expect(s.expiresAt).toBeGreaterThan(Date.now() + 3_000_000);
    expect(loadSession().access_token).toBe('new');
  });

  it('clears the session when the server rejects the refresh token', async () => {
    store({ access_token: 'old', refresh_token: 'r1', expires_at: 1 });
    sb.refreshToken.mockRejectedValue(Object.assign(new Error('bad'), { status: 400 }));
    expect(await getValidSession()).toBeNull();
    expect(loadSession()).toBeNull();
  });

  it('keeps stored session after a network failure so the next load can retry', async () => {
    store({ access_token: 'old', refresh_token: 'r1', expires_at: 1 });
    sb.refreshToken.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await getValidSession()).toBeNull(); // already expired → not usable now
    expect(loadSession()?.access_token).toBe('old'); // but not wiped
  });

  it('still returns a not-yet-expired token if only the refresh hit a network error', async () => {
    const soon = Date.now() + REFRESH_SKEW_MS - 5000;
    store({ access_token: 'ok', refresh_token: 'r1', expires_at: Math.floor(soon / 1000) });
    sb.refreshToken.mockRejectedValue(new TypeError('Failed to fetch'));
    expect((await getValidSession()).access_token).toBe('ok');
  });
});

describe('refreshSession', () => {
  it('shares one in-flight refresh between concurrent callers (tokens are single-use)', async () => {
    let resolve;
    sb.refreshToken.mockReturnValue(new Promise(r => { resolve = r; }));
    const s = { access_token: 'o', refresh_token: 'r1' };
    const a = refreshSession(s);
    const b = refreshSession(s);
    resolve({ access_token: 'n', refresh_token: 'r2', expires_in: 60 });
    await Promise.all([a, b]);
    expect(sb.refreshToken).toHaveBeenCalledTimes(1);
  });
  it('rejects with status 401 when there is no refresh token', async () => {
    await expect(refreshSession({ access_token: 'x' })).rejects.toMatchObject({ status: 401 });
  });
});
