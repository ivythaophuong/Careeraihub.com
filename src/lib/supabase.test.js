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

describe('errors carry the HTTP status so callers can tell an expired session from a blip', () => {
  const failWith = (status, body = { message: 'nope' }) => { fetchMock.mockResolvedValue(okJson(body, status)); };
  beforeEach(() => getValidSession.mockResolvedValue({ access_token: 't' }));

  it.each([
    ['select', () => sb.select('profiles', {}, 'x'), 401],
    ['upsert', () => sb.upsert('t', { a: 1 }, 'x'), 403],
    ['insert', () => sb.insert('t', { a: 1 }, 'x'), 401],
    ['delete', () => sb.delete('t', { id: 'eq.1' }, 'x'), 500],
    ['getUser', () => sb.getUser('x'), 401],
    ['refreshToken', () => sb.refreshToken('r'), 400],
  ])('%s', async (_name, call, status) => {
    failWith(status);
    await expect(call()).rejects.toMatchObject({ status });
  });
});


describe('update and rpc', () => {
  beforeEach(() => getValidSession.mockResolvedValue({ access_token: 'fresh-token' }));

  it('update sends a PATCH with the filter in the URL, the data as the body, and a fresh token', async () => {
    fetchMock.mockResolvedValueOnce(okJson([{ id: 'c1', revoked_at: 'now' }]));
    const out = await sb.update('consents', { id: 'eq.c1' }, { revoked_at: '2026-10-09T00:00:00Z' }, 'stale-token');
    const [url, init] = fetchMock.mock.calls.at(-1);
    expect(init.method).toBe('PATCH');
    expect(url).toContain('/rest/v1/consents?id=eq.c1');
    expect(JSON.parse(init.body)).toEqual({ revoked_at: '2026-10-09T00:00:00Z' });
    expect(init.headers.Authorization).toBe('Bearer fresh-token');
    expect(out).toEqual([{ id: 'c1', revoked_at: 'now' }]);
  });
  it('update refuses to run without a filter (it would touch every visible row)', async () => {
    await expect(sb.update('consents', {}, { revoked_at: 'x' }, 't')).rejects.toMatchObject({ status: 400 });
    await expect(sb.update('consents', undefined, { revoked_at: 'x' }, 't')).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('update turns a database error into an error carrying the status', async () => {
    fetchMock.mockResolvedValueOnce(okJson({ message: 'a consent cannot be edited' }, 403));
    await expect(sb.update('consents', { id: 'eq.c1' }, { scope: {} }, 't')).rejects.toMatchObject({ status: 403, message: 'a consent cannot be edited' });
  });
  it('update copes with an empty 204 reply', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(sb.update('consents', { id: 'eq.c1' }, { revoked_at: 'x' }, 't')).resolves.toBeNull();
  });

  it('rpc posts named arguments to /rpc/<name> with a fresh token', async () => {
    fetchMock.mockResolvedValueOnce(okJson([{ user_id: 'u1' }]));
    const out = await sb.rpc('employer_view_candidates', { p_employer_id: 'e1' }, 'stale-token');
    const [url, init] = fetchMock.mock.calls.at(-1);
    expect(init.method).toBe('POST');
    expect(url).toContain('/rest/v1/rpc/employer_view_candidates');
    expect(JSON.parse(init.body)).toEqual({ p_employer_id: 'e1' });
    expect(init.headers.Authorization).toBe('Bearer fresh-token');
    expect(out).toEqual([{ user_id: 'u1' }]);
  });
  it('rpc sends {} when there are no arguments', async () => {
    await sb.rpc('list_open_jobs', undefined, 't');
    expect(JSON.parse(fetchMock.mock.calls.at(-1)[1].body)).toEqual({});
  });
  it('rpc reports a missing function with its status so a caller can fall back', async () => {
    fetchMock.mockResolvedValueOnce(okJson({ code: 'PGRST202', message: 'Could not find the function public.x' }, 404));
    await expect(sb.rpc('x', {}, 't')).rejects.toMatchObject({ status: 404 });
  });
});
