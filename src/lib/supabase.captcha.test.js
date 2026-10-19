import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sb } from './supabase';

let fetchMock;
const json = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
beforeEach(() => { fetchMock = vi.fn().mockResolvedValue(json({ user: { id: 'u' }, access_token: 'a' })); vi.stubGlobal('fetch', fetchMock); });
const body = () => JSON.parse(fetchMock.mock.calls[0][1].body);

// The field name and shape are the ones the official @supabase/auth-js sends: gotrue_meta_security: { captcha_token }.
describe('the CAPTCHA token is sent with sign-up, sign-in and password recovery', () => {
  it('sign-up carries it next to the usual fields', async () => {
    await sb.signUp('a@b.co', 'pw', 'Ann', { role: 'candidate' }, 'TOKEN-1');
    expect(body()).toEqual({ email: 'a@b.co', password: 'pw', data: { full_name: 'Ann', role: 'candidate' }, gotrue_meta_security: { captcha_token: 'TOKEN-1' } });
  });
  it('sign-in carries it', async () => {
    await sb.signIn('a@b.co', 'pw', 'TOKEN-2');
    expect(String(fetchMock.mock.calls[0][0])).toContain('grant_type=password');
    expect(body()).toEqual({ email: 'a@b.co', password: 'pw', gotrue_meta_security: { captcha_token: 'TOKEN-2' } });
  });
  it('password recovery carries it', async () => {
    await sb.recover('a@b.co', 'TOKEN-3');
    expect(body()).toEqual({ email: 'a@b.co', gotrue_meta_security: { captcha_token: 'TOKEN-3' } });
  });
  it('without a token the requests are exactly as before (CAPTCHA off changes nothing)', async () => {
    await sb.signUp('a@b.co', 'pw', 'Ann'); expect(body()).toEqual({ email: 'a@b.co', password: 'pw', data: { full_name: 'Ann' } });
    fetchMock.mockClear();
    await sb.signIn('a@b.co', 'pw'); expect(body()).toEqual({ email: 'a@b.co', password: 'pw' });
    fetchMock.mockClear();
    await sb.recover('a@b.co'); expect(body()).toEqual({ email: 'a@b.co' });
  });
});
