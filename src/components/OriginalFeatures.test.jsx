// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase', async (orig) => ({ ...(await orig()), sb: { signIn: vi.fn(), signUp: vi.fn(), recover: vi.fn(), updatePassword: vi.fn(), verifyOtp: vi.fn() } }));
import { sb } from '../lib/supabase';
import { AuthModal } from './OriginalFeatures';

afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); });

const open = (props = {}) => render(<AuthModal initialMode="login" onSuccess={vi.fn()} onClose={vi.fn()} onViewLegal={vi.fn()} {...props} />);
const typeEmail = (v) => fireEvent.change(screen.getByPlaceholderText('you@email.com'), { target: { value: v } });

describe('AuthModal: forgot password', () => {
  it('"Forgot your password?" opens a form that asks only for the email', () => {
    open();
    fireEvent.click(screen.getByText('Forgot your password?'));
    expect(screen.getByText('Send reset link →')).toBeTruthy();
    expect(screen.getByPlaceholderText('you@email.com')).toBeTruthy();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it('sends the request and answers the same way whether or not the email has an account', async () => {
    sb.recover.mockResolvedValue({ data: {}, error: null });
    open();
    fireEvent.click(screen.getByText('Forgot your password?'));
    typeEmail('ann@example.com');
    fireEvent.click(screen.getByText('Send reset link →'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/If an account exists for that email/i));
    expect(sb.recover).toHaveBeenCalledWith('ann@example.com');
    expect(document.body.textContent).not.toMatch(/no account|not found|does not exist/i);
  });

  it('a failed request says it could not send, without exposing the server message', async () => {
    sb.recover.mockResolvedValue({ data: null, error: { message: 'smtp 535 Invalid username internal detail' } });
    open();
    fireEvent.click(screen.getByText('Forgot your password?'));
    typeEmail('ann@example.com');
    fireEvent.click(screen.getByText('Send reset link →'));
    await waitFor(() => expect(document.body.textContent).toMatch(/couldn.t send the email/i));
    expect(document.body.textContent).not.toMatch(/535|internal detail/);
  });

  it('"Back to sign in" returns to the sign-in form', () => {
    open();
    fireEvent.click(screen.getByText('Forgot your password?'));
    fireEvent.click(screen.getByText(/Back to sign in/));
    expect(screen.getByText('Sign In →')).toBeTruthy();
  });
});

describe('AuthModal: set a new password from the email link', () => {
  const reset = (props = {}) => open({ initialMode: 'reset', recoveryToken: 'RECOVERY-TOKEN', ...props });
  const fill = (a, b) => {
    const [p1, p2] = document.querySelectorAll('input[type="password"]');
    fireEvent.change(p1, { target: { value: a } }); fireEvent.change(p2, { target: { value: b } });
  };

  it('shows two password fields and no email field', () => {
    reset();
    expect(document.querySelectorAll('input[type="password"]')).toHaveLength(2);
    expect(screen.queryByPlaceholderText('you@email.com')).toBeNull();
    expect(screen.getByText('Set new password →')).toBeTruthy();
  });

  it('two different passwords are refused before anything is sent', () => {
    reset(); fill('first-password', 'second-password');
    fireEvent.click(screen.getByText('Set new password →'));
    expect(document.body.textContent).toMatch(/do not match/i);
    expect(sb.updatePassword).not.toHaveBeenCalled();
  });

  it('sets the password with the recovery token, then asks the person to sign in', async () => {
    sb.updatePassword.mockResolvedValue({ data: { id: 'u' }, error: null });
    reset(); fill('a-new-password', 'a-new-password');
    fireEvent.click(screen.getByText('Set new password →'));
    await waitFor(() => expect(sb.updatePassword).toHaveBeenCalledWith('RECOVERY-TOKEN', 'a-new-password'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/password was updated/i));
    expect(screen.getByText('Sign In →')).toBeTruthy();
  });

  it('shows the server\'s reason when it refuses the password', async () => {
    sb.updatePassword.mockResolvedValue({ data: null, error: { message: 'Password should be at least 6 characters.' } });
    reset(); fill('abc', 'abc');
    fireEvent.click(screen.getByText('Set new password →'));
    await waitFor(() => expect(document.body.textContent).toMatch(/at least 6 characters/));
  });

  it('with no token (the link was not used) it says to ask for a new link, and sends nothing', () => {
    reset({ recoveryToken: null }); fill('a-new-password', 'a-new-password');
    fireEvent.click(screen.getByText('Set new password →'));
    expect(document.body.textContent).toMatch(/link has expired|request a new/i);
    expect(sb.updatePassword).not.toHaveBeenCalled();
  });
});

describe('AuthModal: a link that points straight at this site (token_hash)', () => {
  const link = (props = {}) => open({ initialMode: 'link', emailLink: { kind: 'recovery-link', tokenHash: 'HASH123' }, ...props });

  it('asks the person to press a button and does not use up the link by itself', () => {
    link();
    expect(screen.getByText('Choose a new password →')).toBeTruthy();
    expect(sb.verifyOtp).not.toHaveBeenCalled();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it('on the button, checks the hash, then shows the new-password form and sets the password with the returned token', async () => {
    sb.verifyOtp.mockResolvedValue({ data: { access_token: 'ACCESS-FROM-VERIFY', user: { id: 'u' } }, error: null });
    sb.updatePassword.mockResolvedValue({ data: { id: 'u' }, error: null });
    link();
    fireEvent.click(screen.getByText('Choose a new password →'));
    await waitFor(() => expect(sb.verifyOtp).toHaveBeenCalledWith('recovery', 'HASH123'));
    await waitFor(() => expect(document.querySelectorAll('input[type="password"]')).toHaveLength(2));
    const [p1, p2] = document.querySelectorAll('input[type="password"]');
    fireEvent.change(p1, { target: { value: 'a-new-password' } }); fireEvent.change(p2, { target: { value: 'a-new-password' } });
    fireEvent.click(screen.getByText('Set new password →'));
    await waitFor(() => expect(sb.updatePassword).toHaveBeenCalledWith('ACCESS-FROM-VERIFY', 'a-new-password'));
  });

  it('an expired link says so, offers the way back, and never shows the password form', async () => {
    sb.verifyOtp.mockResolvedValue({ data: null, error: { message: 'Email link is invalid or has expired' } });
    link();
    fireEvent.click(screen.getByText('Choose a new password →'));
    await waitFor(() => expect(document.body.textContent).toMatch(/expired or was already used/i));
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it('a verify answer without a token is treated as a failure, not as success', async () => {
    sb.verifyOtp.mockResolvedValue({ data: { user: { id: 'u' } }, error: null });
    link();
    fireEvent.click(screen.getByText('Choose a new password →'));
    await waitFor(() => expect(document.body.textContent).toMatch(/expired or was already used/i));
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it('a confirmation link: the button confirms the email, then asks the person to sign in', async () => {
    sb.verifyOtp.mockResolvedValue({ data: { access_token: 'A', user: { id: 'u' } }, error: null });
    link({ emailLink: { kind: 'confirm-link', tokenHash: 'H2', type: 'email' } });
    expect(sb.verifyOtp).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Confirm my email →'));
    await waitFor(() => expect(sb.verifyOtp).toHaveBeenCalledWith('email', 'H2'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/email is confirmed/i));
    expect(screen.getByText('Sign In →')).toBeTruthy();
  });
});

describe('AuthModal: creating an account', () => {
  const register = (props = {}) => open({ initialMode: 'register', ...props });
  const fillAndSubmit = () => {
    fireEvent.change(screen.getByPlaceholderText('Your full name'), { target: { value: 'Ann Lee' } });
    typeEmail('ann@example.com');
    fireEvent.change(document.querySelector('input[type="password"]'), { target: { value: 'a-good-password' } });
    fireEvent.click(screen.getByText('Create Account →'));
  };

  it('when the project asks for the email to be confirmed (no session comes back), it says so calmly, not as an error, and shows the sign-in form', async () => {
    sb.signUp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const onSuccess = vi.fn();
    register({ onSuccess }); fillAndSubmit();
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/check your email/i));
    expect(screen.getByRole('status').textContent).toMatch(/spam/i);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText('Sign In →')).toBeTruthy();                    // the person confirms, then signs in
    expect(document.body.textContent).not.toMatch(/⚠/);                    // no red error
  });

  it('answers the same way when the server returns no user at all (an address that already has an account)', async () => {
    sb.signUp.mockResolvedValue({ data: {}, error: null });
    register(); fillAndSubmit();
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/check your email/i));
    expect(document.body.textContent).not.toMatch(/already|exists|registered/i);
  });

  it('when a session comes back (confirmation off), the person is signed in as before', async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    sb.signUp.mockResolvedValue({ data: { user: { id: 'u1', email: 'ann@example.com' }, access_token: 'a.b.c', refresh_token: 'r', expires_at: future, expires_in: 3600 }, error: null });
    const onSuccess = vi.fn();
    register({ onSuccess }); fillAndSubmit();
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it('a real error from the server is still shown as an error', async () => {
    sb.signUp.mockResolvedValue({ data: null, error: { message: 'Password should be at least 6 characters.' } });
    register(); fillAndSubmit();
    await waitFor(() => expect(document.body.textContent).toMatch(/at least 6 characters/));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
