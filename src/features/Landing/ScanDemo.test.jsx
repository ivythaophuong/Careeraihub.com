// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
import ScanDemo from './ScanDemo';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const tenths = async (n) => { for (let i = 0; i < n; i++) await act(async () => { vi.advanceTimersByTime(100); }); };

describe('the ATS Scanner result example', () => {
  it('says that it is an example on a sample CV, and shows the parts of the real result screen', () => {
    const { container } = render(<ScanDemo onStart={vi.fn()} />);
    const t = container.textContent;
    expect(t).toMatch(/Example run on a sample CV and a sample job description/);
    expect(t).toMatch(/Resume vs Product Analyst/);
    expect(t).toMatch(/AI estimate of the match/);
    expect(t).toMatch(/Missing keywords/);
    expect(t).toMatch(/Fix suggestions/);
    expect(container.querySelectorAll('.nl-scan-chip').length).toBeGreaterThanOrEqual(6);
  });
  it('fills the score and the three bars to their figures, as the Resume Builder example does', async () => {
    const { container } = render(<ScanDemo onStart={vi.fn()} />);
    await tenths(40);
    expect(screen.getByTestId('scan-score').textContent).toBe('82');
    const bars = [...container.querySelectorAll('[data-testid="scan-bar"]')];
    expect(bars.map(b => [b.getAttribute('data-name'), b.getAttribute('data-value'), b.style.width])).toEqual([
      ['Keywords matched', '60', '60%'], ['Skills alignment', '85', '85%'], ['Format score', '90', '90%'],
    ]);
  });
  it('colours the bars by where the figure comes from, never by how high it is: code counts the keywords, the AI estimates the rest', () => {
    const { container } = render(<ScanDemo onStart={vi.fn()} />);
    const src = Object.fromEntries([...container.querySelectorAll('[data-testid="scan-bar"]')].map(b => [b.getAttribute('data-name'), b.getAttribute('data-source')]));
    expect(src).toEqual({ 'Keywords matched': 'code', 'Skills alignment': 'ai', 'Format score': 'ai' });
    const legend = container.querySelector('.nl-scan-legend').textContent;
    expect(legend).toMatch(/Counted by code/); expect(legend).toMatch(/AI estimate/);
    expect(container.textContent).toMatch(/These bars are AI estimates, except the keyword bar: code counts those in your resume\./);
  });
  it('shows the final figures at once for a visitor who prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', (q) => ({ matches: /reduce/.test(q), addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    render(<ScanDemo onStart={vi.fn()} />);
    expect(screen.getByTestId('scan-score').textContent).toBe('82');
  });
  it('waits until it is on screen before it plays', async () => {
    let cb;
    vi.stubGlobal('IntersectionObserver', class { constructor(c) { cb = c; } observe() {} disconnect() {} unobserve() {} });
    render(<ScanDemo onStart={vi.fn()} />);
    await tenths(40);
    expect(screen.getByTestId('scan-score').textContent).toBe('0');
    act(() => cb([{ isIntersecting: true }]));
    await tenths(40);
    expect(screen.getByTestId('scan-score').textContent).toBe('82');
  });
  it('Apply fix is a real button: a visitor who wants the fix is invited to create an account', () => {
    const onStart = vi.fn();
    const { container } = render(<ScanDemo onStart={onStart} />);
    fireEvent.click(within(container).getByRole('button', { name: /Apply fix/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
  it('writes no percentage sign and no promise: the rewrite says "about a third", and the draft is marked as a draft', () => {
    const { container } = render(<ScanDemo onStart={vi.fn()} />);
    const t = container.textContent;
    expect(t).not.toMatch(/\d\s?%|guarantee|verified|hired/i);
    expect(t).toMatch(/AI draft: check it matches what you actually did before applying\./);
  });
});
