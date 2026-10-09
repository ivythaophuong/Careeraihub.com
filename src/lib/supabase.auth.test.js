/**
 * Auth client tests. These exercise the real `sb` client from src/lib/supabase.js
 * against a mocked fetch, so they never touch the live Supabase project.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sb } from './supabase';

const res = (status, body) => ({ status, ok: status < 400, json: async () => body, text: async () => JSON.stringify(body) });

let fetchMock;
beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('sb.signUp', () => {
  it('posts email, password and full_name to the signup endpoint', async () => {
    fetchMock.mockResolvedValue(res(200, { user: { id: 'u' } }));
    const { data, error } = await sb.signUp('a@b.c', 'pw', 'Ann');
    expect(error).toBeNull();
    expect(data.user.id).toBe('u');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/v1\/signup$/);
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.c', password: 'pw', data: { full_name: 'Ann' } });
  });

  it('returns the server error message on failure', async () => {
    fetchMock.mockResolvedValue(res(422, { msg: 'User already registered' }));
    const { data, error } = await sb.signUp('a@b.c', 'pw', 'Ann');
    expect(data).toBeNull();
    expect(error.message).toBe('User already registered');
  });

  it('returns a plain-language error on a network failure', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const { error } = await sb.signUp('a@b.c', 'pw', 'Ann');
    // The user sees this text, so it is a plain sentence rather than the raw "offline" / "Failed to fetch".
    expect(error.message).toBe('Network error — check your connection.');
  });
});

describe('sb.signIn', () => {
  it('returns the session on success', async () => {
    fetchMock.mockResolvedValue(res(200, { access_token: 'tok', user: { email: 'a@b.c' } }));
    const { data, error } = await sb.signIn('a@b.c', 'pw');
    expect(error).toBeNull();
    expect(data.access_token).toBe('tok');
    expect(fetchMock.mock.calls[0][0]).toMatch(/grant_type=password$/);
  });

  it('rejects invalid credentials', async () => {
    fetchMock.mockResolvedValue(res(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' }));
    const { data, error } = await sb.signIn('a@b.c', 'bad');
    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });
});

describe('sb.refreshToken / getUser', () => {
  it('refreshToken returns the new session', async () => {
    fetchMock.mockResolvedValue(res(200, { access_token: 'new', refresh_token: 'r2' }));
    expect((await sb.refreshToken('r1')).access_token).toBe('new');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refresh_token: 'r1' });
  });

  it('getUser throws when the session is expired', async () => {
    fetchMock.mockResolvedValue(res(401, { msg: 'JWT expired' }));
    await expect(sb.getUser('old')).rejects.toThrow(/expired/i);
  });

  it('refreshToken errors carry the HTTP status', async () => {
    fetchMock.mockResolvedValue(res(400, { error: 'invalid_grant' }));
    await expect(sb.refreshToken('bad')).rejects.toMatchObject({ status: 400 });
  });
});

describe('sb database helpers', () => {
  it('select sends the bearer token and query filters', async () => {
    fetchMock.mockResolvedValue(res(200, [{ id: 1 }]));
    await sb.select('resume_scans', { user_id: 'eq.u1', limit: 5 }, 'tok');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/rest/v1/resume_scans?');
    expect(url).toContain('user_id=eq.u1');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('select throws on a database error', async () => {
    fetchMock.mockResolvedValue(res(401, { message: 'JWT expired' }));
    await expect(sb.select('x', {}, 't')).rejects.toMatchObject({ message: 'JWT expired', status: 401 });
  });

  it('upsert uses on_conflict=user_id when the row has a user_id', async () => {
    fetchMock.mockResolvedValue(res(201, [{ ok: true }]));
    await sb.upsert('user_memory', { user_id: 'u1', data: {} }, 'tok');
    expect(fetchMock.mock.calls[0][0]).toContain('on_conflict=user_id');
  });
});
