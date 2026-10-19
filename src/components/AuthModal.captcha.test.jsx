// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';

vi.mock('../lib/supabase', async (orig) => ({ ...(await orig()), sb: { signIn: vi.fn(), signUp: vi.fn(), recover: vi.fn(), updatePassword: vi.fn(), verifyOtp: vi.fn() } }));
vi.mock('../lib/captcha', () => ({
  TURNSTILE_SITE_KEY: 'SITEKEY',
  TURNSTILE_SCRIPT_URL: 'x',
  captchaEnabled: () => globalThis.__captchaOn !== false,
  loadTurnstile: () => globalThis.__loadTurnstile(),
}));
import { sb } from '../lib/supabase';
import { AuthModal } from './OriginalFeatures';

let fake, opts;
beforeEach(() => {
  vi.clearAllMocks();
  globalThis.__captchaOn = true;
  opts = null;
  fake = { render: vi.fn((el, o) => { opts = o; return 'wid-1'; }), reset: vi.fn(), remove: vi.fn(), isExpired: vi.fn(() => false) };
  globalThis.__loadTurnstile = () => Promise.resolve(fake);
});
afterEach(cleanup);

const open = (mode = 'login') => render(<AuthModal initialMode={mode} onSuccess={vi.fn()} onClose={vi.fn()} onViewLegal={vi.fn()} />);
const btn = (label) => screen.getByText(label).closest('button');
const widgetReady = () => waitFor(() => expect(fake.render).toHaveBeenCalled());
const solve = async (token = 'TOK') => { await widgetReady(); await act(async () => { opts.callback(token); }); };
const fillLogin = () => { fireEvent.change(screen.getByPlaceholderText('you@email.com'), { target: { value: 'a@b.co' } }); fireEvent.change(document.querySelector('input[type="password"]'), { target: { value: 'pw-123456' } }); };

describe('the CAPTCHA widget in the sign-in, sign-up and forgot-password forms', () => {
  it('renders Cloudflare\'s widget with the site key, and keeps the button off until it is solved', async () => {
    open('login'); await widgetReady();
    expect(opts.sitekey).toBe('SITEKEY');
    expect(btn('Sign In →').disabled).toBe(true);
    await solve();
    expect(btn('Sign In →').disabled).toBe(false);
  });

  it('sign-in sends the token, and the spent token is replaced: widget reset, button off again', async () => {
    sb.signIn.mockResolvedValue({ data: null, error: { message: 'Invalid login credentials' } });
    open('login'); fillLogin(); await solve('TOK-IN');
    fireEvent.click(btn('Sign In →'));
    await waitFor(() => expect(sb.signIn).toHaveBeenCalledWith('a@b.co', 'pw-123456', 'TOK-IN'));
    await waitFor(() => expect(fake.reset).toHaveBeenCalledWith('wid-1'));
    expect(btn('Sign In →').disabled).toBe(true);
  });

  it('sign-up sends the token as the last argument', async () => {
    sb.signUp.mockResolvedValue({ data: { user: { id: 'u' } }, error: null });
    open('register'); await solve('TOK-UP');
    fireEvent.change(screen.getByPlaceholderText('Your full name'), { target: { value: 'Ann' } });
    fireEvent.change(screen.getByPlaceholderText('you@email.com'), { target: { value: 'a@b.co' } });
    fireEvent.change(document.querySelector('input[type="password"]'), { target: { value: 'pw-123456' } });
    fireEvent.click(btn('Create Account →'));
    await waitFor(() => expect(sb.signUp).toHaveBeenCalled());
    const args = sb.signUp.mock.calls[0];
    expect(args[args.length - 1]).toBe('TOK-UP');
  });

  it('forgot-password sends the token too', async () => {
    sb.recover.mockResolvedValue({ data: {}, error: null });
    open('login'); await widgetReady();                                              // the sign-in widget first
    fireEvent.click(screen.getByText('Forgot your password?'));
    await waitFor(() => expect(fake.render).toHaveBeenCalledTimes(2));            // the form changed: the old widget is removed and a new one made
    expect(fake.remove).toHaveBeenCalledWith('wid-1');
    await act(async () => { opts.callback('TOK-FG'); });
    fireEvent.change(screen.getByPlaceholderText('you@email.com'), { target: { value: 'a@b.co' } });
    fireEvent.click(btn('Send reset link →'));
    await waitFor(() => expect(sb.recover).toHaveBeenCalledWith('a@b.co', 'TOK-FG'));
  });

  it('the new-password and link forms have no widget (Supabase does not ask for one there)', async () => {
    open('reset'); await new Promise((r) => setTimeout(r, 30));
    expect(fake.render).not.toHaveBeenCalled();
    cleanup();
    render(<AuthModal initialMode="link" emailLink={{ kind: 'recovery-link', tokenHash: 'H' }} onSuccess={vi.fn()} onClose={vi.fn()} onViewLegal={vi.fn()} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(fake.render).not.toHaveBeenCalled();
  });

  it('a widget error or an expired token turns the button off and says what to do', async () => {
    open('login'); await solve();
    expect(btn('Sign In →').disabled).toBe(false);
    await act(async () => { opts['expired-callback'](); });
    expect(btn('Sign In →').disabled).toBe(true);
    await solve('TOK-2');
    await act(async () => { opts['error-callback'](); });
    expect(btn('Sign In →').disabled).toBe(true);
    expect(document.body.textContent).toMatch(/security check/i);
  });

  it('if the security script cannot be loaded, it says so and does not let the form be sent', async () => {
    globalThis.__loadTurnstile = () => Promise.reject(new Error('blocked'));
    open('login');
    await waitFor(() => expect(document.body.textContent).toMatch(/couldn.t load the security check/i));
    expect(btn('Sign In →').disabled).toBe(true);
  });

  it('is not shown, and nothing changes, when no site key is configured', async () => {
    globalThis.__captchaOn = false;
    sb.signIn.mockResolvedValue({ data: null, error: { message: 'x' } });
    open('login'); fillLogin();
    expect(btn('Sign In →').disabled).toBe(false);
    fireEvent.click(btn('Sign In →'));
    await waitFor(() => expect(sb.signIn).toHaveBeenCalledWith('a@b.co', 'pw-123456'));
    expect(fake.render).not.toHaveBeenCalled();
  });

  it('removes the widget when the form changes or closes', async () => {
    const { unmount } = open('login'); await widgetReady();
    unmount();
    expect(fake.remove).toHaveBeenCalledWith('wid-1');
  });
});
