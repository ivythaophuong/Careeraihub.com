// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../lib/supabase', async (orig) => ({ ...(await orig()), sb: { signIn: vi.fn(), signUp: vi.fn() } }));
import { AuthModal } from './OriginalFeatures';

afterEach(cleanup);

describe('AuthModal "Forgot your password?"', () => {
  it('does not claim that a reset link was sent, because none is', () => {
    render(<AuthModal initialMode="login" onSuccess={vi.fn()} onClose={vi.fn()} onViewLegal={vi.fn()} />);
    fireEvent.click(screen.getByText('Forgot your password?'));
    expect(document.body.textContent).toMatch(/Password reset isn't available yet/);
    expect(document.body.textContent).not.toMatch(/sent|simulated/i);
  });
});
