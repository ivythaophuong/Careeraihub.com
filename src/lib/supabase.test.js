// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./session', () => ({ getValidSession: vi.fn() }));
import { getValidSession } from './session';
import { sb } from './supabase';

const okJson = (body, status = 200) => new Response(JSON.stringify(body), { status });
const bearer = (fetchMock) => fetchMock.mock.calls.at(-1)[1].headers.Authorization;

let fetchMock;
beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn(async () => okJson([]));
  vi.stubGlobal('fetch', fetchMock);
});

describe('database helpers use a fresh token, not the one from React state', () => {
  beforeEach(() => getValidSession.mockResolvedValue({ access_token: 'fresh-token' }));

  it('select', async () => {
    await sb.select('profiles', { id: 'eq.1' }, 'stale-token');
    expect(bearer(fetchMock)).toBe('Bearer fresh-token');
  });
  it('upsert', async () => {
    await sb.upsert('candidate_trust_profiles', { user_id: 'u1' }, 'stale-token');
    expect(bearer(fetchMock)).toBe('Bearer fresh-token');
  });
  it('insert', async () => {
    await sb.insert('mock_sessions', { user_id: 'u1' }, 'stale-token');
    expect(bearer(fetchMock)).toBe('Bearer fresh-token');
  });
  it('delete', async () => {
    await sb.delete('applications', { id: 'eq.1' }, 'stale-token');
    expect(bearer(fetchMock)).toBe('Bearer fresh-token');
  });
});

describe('falling back to the token it was given', () => {
  it('when there is no stored session', async () => {
    getValidSession.mockResolvedValue(null);
    await sb.select('profiles', {}, 'given-token');
    expect(bearer(fetchMock)).toBe('Bearer given-token');
  });

  it('when reading the session throws', async () => {
    getValidSession.mockRejectedValue(new Error('storage blocked'));
    await sb.select('profiles', {}, 'given-token');
    expect(bearer(fetchMock)).toBe('Bearer given-token');
  });
});

describe('errors still surface to the caller', () => {
  it('select rejects with the server message', async () => {
    getValidSession.mockResolvedValue({ access_token: 't' });
    fetchMock.mockResolvedValue(okJson({ message: 'JWT expired' }, 401));
    await expect(sb.select('profiles', {}, 'x')).rejects.toThrow('JWT expired');
  });

  it('upsert rejects with the server message', async () => {
    getValidSession.mockResolvedValue({ access_token: 't' });
    fetchMock.mockResolvedValue(okJson({ message: 'permission denied' }, 403));
    await expect(sb.upsert('t', { a: 1 }, 'x')).rejects.toThrow('permission denied');
  });
});
