// @vitest-environment jsdom
// The page opened from an email link must show the right dialog, and must not leave the token in the address bar.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

vi.mock('./lib/supabase', async (orig) => ({ ...(await orig()), sb: { select: vi.fn(async () => []), upsert: vi.fn(async () => null), insert: vi.fn(async () => []), signIn: vi.fn(), signUp: vi.fn(), recover: vi.fn(), updatePassword: vi.fn(), verifyOtp: vi.fn(), getUser: vi.fn(), refreshToken: vi.fn() } }));
import App from './App';
import { sb } from './lib/supabase';

const openFrom = (suffix) => { window.history.replaceState(null, '', `/${suffix}`); return render(<App />); };
beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
  window.scrollTo = vi.fn();
  localStorage.clear(); vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); });

describe('opening the site from an email link', () => {
  it('a password-reset link shows "Choose a new password" and removes the token from the address bar', async () => {
    openFrom('#access_token=SECRET-RECOVERY&refresh_token=REF&type=recovery');
    await waitFor(() => expect(screen.getByText('Choose a new password')).toBeTruthy());
    expect(window.location.href).not.toContain('SECRET-RECOVERY');
    expect(window.location.hash).toBe('');
  });

  it('a sign-up confirmation link shows the sign-in form with a confirmed message', async () => {
    openFrom('#access_token=A&refresh_token=R&type=signup');
    await waitFor(() => expect(screen.getByText('Welcome Back')).toBeTruthy());
    expect(document.body.textContent).toMatch(/email is confirmed/i);
  });

  it('an expired link says so and opens the sign-in form', async () => {
    openFrom('#error=access_denied&error_code=otp_expired&error_description=expired');
    await waitFor(() => expect(document.body.textContent).toMatch(/expired or was already used/i));
    expect(screen.getByText('Welcome Back')).toBeTruthy();
  });

  it('a normal visit opens no dialog', async () => {
    openFrom('');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('Choose a new password')).toBeNull();
    expect(screen.queryByText('Welcome Back')).toBeNull();
  });
});


describe('opening the site from a link that carries a token_hash', () => {
  it('a recovery link shows a button, uses nothing up on load, and removes the hash from the address bar', async () => {
    openFrom('?token_hash=SECRET-HASH&type=recovery');
    await waitFor(() => expect(screen.getByText('Choose a new password →')).toBeTruthy());
    expect(sb.verifyOtp).not.toHaveBeenCalled();
    expect(window.location.href).not.toContain('SECRET-HASH');
  });

  it('a confirmation link shows a "Confirm my email" button', async () => {
    openFrom('?token_hash=H&type=email');
    await waitFor(() => expect(screen.getByText('Confirm my email →')).toBeTruthy());
    expect(sb.verifyOtp).not.toHaveBeenCalled();
  });
});
