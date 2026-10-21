// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
import ResumeDemo from './ResumeDemo';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const play = (ms = 3000) => act(async () => { vi.advanceTimersByTime(ms); });

describe('the interactive Resume Builder example', () => {
  it('says what it is: an example run on a sample CV, not the visitor\'s CV', () => {
    render(<ResumeDemo onStart={vi.fn()} />);
    expect(screen.getByTestId('resume-demo').textContent).toMatch(/Sample CV/);
    expect(screen.getByTestId('resume-demo').textContent).toMatch(/Resume Builder/);
    expect(screen.getByTestId('resume-demo').textContent).toMatch(/Example run on a sample CV/);
  });

  it('starts empty, then the score ring fills to 83 and counts up, and every bar moves to its value', async () => {
    render(<ResumeDemo onStart={vi.fn()} />);
    const ring = screen.getByRole('img', { name: /ATS readiness/i });
    await play(100);
    expect(Number(screen.getByTestId('demo-score').textContent)).toBeLessThan(83);
    await play(3000);
    expect(screen.getByTestId('demo-score').textContent).toBe('83');
    expect(ring.getAttribute('aria-label')).toBe('ATS readiness 83 out of 100');
    const bars = [...screen.getAllByTestId('demo-bar')];
    expect(bars.map(b => [b.getAttribute('data-name'), b.getAttribute('data-value'), b.style.width])).toEqual([
      ['Completeness', '75', '75%'], ['Measurable impact', '78', '78%'], ['Date consistency', '100', '100%'],
    ]);
  });

  it('shows the checks and their evidence, including the one that failed', async () => {
    render(<ResumeDemo onStart={vi.fn()} />);
    await play();
    const t = screen.getByTestId('resume-demo').textContent;
    expect(t).toMatch(/Rule-based/);
    expect(t).toMatch(/Based on 3 of 3 checks/);
    expect(t).toMatch(/Email not found/);
    expect(t).toMatch(/7 of 9 experience bullets contain a measurable number/);
    expect(t).toMatch(/0 internal date contradiction\(s\) found across 3 checkable experience entries/);
  });

  it('shows the final figures at once when the visitor prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', (q) => ({ matches: /reduce/.test(q), addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    render(<ResumeDemo onStart={vi.fn()} />);
    expect(screen.getByTestId('demo-score').textContent).toBe('83');
  });

  it('waits until it is on screen before it plays', async () => {
    let cb;
    vi.stubGlobal('IntersectionObserver', class { constructor(c) { cb = c; } observe() {} disconnect() {} unobserve() {} });
    render(<ResumeDemo onStart={vi.fn()} />);
    await play(3000);
    expect(screen.getByTestId('demo-score').textContent).toBe('0');
    act(() => cb([{ isIntersecting: true }]));
    await play(3000);
    expect(screen.getByTestId('demo-score').textContent).toBe('83');
  });
});

describe('the two columns of the example', () => {
  it('has the extracted profile on the left and the score on the right, as the real Resume Builder shows them', () => {
    const { container } = render(<ResumeDemo onStart={vi.fn()} />);
    const cols = container.querySelectorAll('.nl-demo-body > .nl-demo-col');
    expect(cols).toHaveLength(2);
    expect(cols[0].textContent).toMatch(/Sample CV/);
    expect(cols[0].textContent).toMatch(/Profile extracted/);
    expect(cols[0].textContent).toMatch(/Growth Product Manager/);
    expect(cols[1].querySelector('[data-testid="demo-score"]')).toBeTruthy();
  });
});

describe('the steps of the example', () => {
  it('does not show the four steps: they are not what the example is about', () => {
    const { container } = render(<ResumeDemo onStart={vi.fn()} />);
    expect(container.querySelector('.nl-demo-steps')).toBeNull();
    expect(container.textContent).not.toMatch(/Choose a layout and download/);
  });
});

describe('the Next button of the example', () => {
  const toIssues = async (onStart = vi.fn()) => { render(<ResumeDemo onStart={onStart} />); await play(); fireEvent.click(screen.getByRole('button', { name: /Next: improve it/i })); return onStart; };

  it('shows the issues first, with a Fix it now button, and no sign-up wording yet', async () => {
    await toIssues();
    const issues = screen.getByTestId('demo-issues');
    expect(issues.textContent).toMatch(/Issues to fix/);
    expect(issues.textContent).toMatch(/4 found/);
    expect(issues.textContent).toMatch(/Missing contact information/);
    expect(issues.textContent).toMatch(/Critical/);
    expect(issues.textContent).toMatch(/does not include an email address, phone number, or LinkedIn profile/);
    expect(within(issues).getAllByTestId('demo-locked')).toHaveLength(3);
    expect(within(issues).getByRole('button', { name: /Fix it now/i })).toBeTruthy();
    expect(screen.getByTestId('resume-demo').textContent).not.toMatch(/Create a free account/);
  });
  it('before Next, the sign-up wording is not on the screen at all', async () => {
    render(<ResumeDemo onStart={vi.fn()} />);
    await play();
    expect(screen.getByTestId('resume-demo').textContent).not.toMatch(/Create a free account|Fix it now|Back to the score/);
  });
  it('Fix it now shows the invitation to create a free account, and the button starts sign-up', async () => {
    const onStart = await toIssues();
    fireEvent.click(screen.getByRole('button', { name: /Fix it now/i }));
    const gate = screen.getByTestId('demo-gate');
    expect(gate.textContent).toMatch(/Create a free account to see all 4 issues and how to fix them/);
    fireEvent.click(within(gate).getByRole('button', { name: /Create a free account/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
  it('can go back from each step, and play again', async () => {
    await toIssues();
    fireEvent.click(screen.getByRole('button', { name: /Fix it now/i }));
    fireEvent.click(screen.getByRole('button', { name: /Back to the issues/i }));
    expect(screen.getByTestId('demo-issues')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Back to the score/i }));
    expect(screen.getByRole('button', { name: /Next: improve it/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Replay/i }));
    await play(100);
    expect(Number(screen.getByTestId('demo-score').textContent)).toBeLessThan(83);
    await play(3000);
    expect(screen.getByTestId('demo-score').textContent).toBe('83');
  });
  it('makes no claim beyond the example: no percentage, no "verified", no grade words', async () => {
    render(<ResumeDemo onStart={vi.fn()} />);
    await play();
    const t = screen.getByTestId('resume-demo').textContent;
    expect(t).not.toMatch(/\d\s?%|verified|guarantee|hired/i);
  });
});

describe('the example plays once', () => {
  it('fills slowly (about two and a half seconds), then stays still: it does not start again by itself', async () => {
    render(<ResumeDemo onStart={vi.fn()} />);
    const tenths = async (n) => { let lowest = 100; for (let i = 0; i < n; i++) { await play(100); lowest = Math.min(lowest, Number(screen.getByTestId('demo-score').textContent)); } return lowest; };
    await play(100);
    expect(Number(screen.getByTestId('demo-score').textContent)).toBeLessThan(83);
    await tenths(10); // one second in: it is not done yet
    expect(Number(screen.getByTestId('demo-score').textContent)).toBeLessThan(83);
    await tenths(20);
    expect(screen.getByTestId('demo-score').textContent).toBe('83');
    expect(await tenths(300)).toBe(83); // thirty more seconds: never goes back
  });
  it('has a light that turns once round the ring', () => {
    render(<ResumeDemo onStart={vi.fn()} />);
    expect(screen.getByTestId('resume-demo').querySelector('.nl-demo-ring-spin')).toBeTruthy();
  });
});
