import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sb, SUPABASE_URL } from './supabase';

let fetchMock;
const json = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });

describe('sb.recover (ask for a password-reset email)', () => {
  it('posts the email to /auth/v1/recover and asks for the link to come back to this site', async () => {
    fetchMock.mockResolvedValue(json({}));
    const out = await sb.recover('ann@example.com');
    expect(out.error).toBeNull();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(`${SUPABASE_URL}/auth/v1/recover`);
    expect(String(url)).toContain(`redirect_to=${encodeURIComponent(window.location.origin)}`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ email: 'ann@example.com' });
    expect(init.headers.apikey).toBeTruthy();
  });

  it('returns the error when the request fails, and never throws on a network error', async () => {
    fetchMock.mockResolvedValue(json({ msg: 'email rate limit exceeded' }, 429));
    expect((await sb.recover('a@b.co')).error).toBeTruthy();
    fetchMock.mockRejectedValue(new Error('offline'));
    expect((await sb.recover('a@b.co')).error.message).toMatch(/network/i);
  });
});

describe('sb.updatePassword (set the new password with the recovery token)', () => {
  it('puts the password to /auth/v1/user with the recovery token as the bearer', async () => {
    fetchMock.mockResolvedValue(json({ id: 'u1' }));
    const out = await sb.updatePassword('RECOVERY-TOKEN', 'a-new-password');
    expect(out.error).toBeNull();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${SUPABASE_URL}/auth/v1/user`);
    expect(init.method).toBe('PUT');
    expect(init.headers.Authorization).toBe('Bearer RECOVERY-TOKEN');
    expect(JSON.parse(init.body)).toEqual({ password: 'a-new-password' });
  });

  it('passes the server message on (for example a password that is too short) and survives a network error', async () => {
    fetchMock.mockResolvedValue(json({ msg: 'Password should be at least 6 characters.' }, 422));
    expect((await sb.updatePassword('t', 'abc')).error.message).toMatch(/at least 6/);
    fetchMock.mockRejectedValue(new Error('offline'));
    expect((await sb.updatePassword('t', 'abcdefgh')).error.message).toMatch(/network/i);
  });

  it('refuses to call the server without a token or a password', async () => {
    expect((await sb.updatePassword('', 'abcdefgh')).error).toBeTruthy();
    expect((await sb.updatePassword('t', '')).error).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
