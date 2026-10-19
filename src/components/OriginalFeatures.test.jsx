// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase', async (orig) => ({ ...(await orig()), sb: { signIn: vi.fn(), signUp: vi.fn(), recover: vi.fn(), updatePassword: vi.fn() } }));
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
