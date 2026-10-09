// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../lib/supabase', async (orig) => ({ ...(await orig()), sb: {} }));
import ReadinessScore, { statusFor } from './ReadinessScore';

afterEach(cleanup);
const show = (props = {}) => render(<ReadinessScore memory={{}} setActiveModule={vi.fn()} embedded {...props} />);

describe('ReadinessScore never invents a score', () => {
  it.each([
    ['no scan at all', {}],
    ['a scan without a score', { scanResult: { issues: [] } }],
    ['a score that is not a number', { scanResult: { credibilityScore: 'n/a' } }],
    ['a stored scan without a score', { memory: { scanHistory: [{ result: { summary: 'x' } }] } }],
  ])('%s shows the empty state, not a default number', (_n, props) => {
    show(props);
    expect(screen.getByText('No readiness score yet')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\b50\b|Excellent|Strong|Found/);
  });

  it('the empty state sends the user to the scanner', () => {
    const setActiveModule = vi.fn();
    show({ setActiveModule });
    fireEvent.click(screen.getByText('Run a scan'));
    expect(setActiveModule).toHaveBeenCalledWith('scan');
  });

  it('with a real score it shows that score and the status derived from it', () => {
    show({ scanResult: { credibilityScore: 72, issues: [{ severity: 'critical' }, { severity: 'warning' }, { severity: 'warning' }] } });
    expect(screen.getByText('Latest scan score')).toBeTruthy();
    expect(screen.getByText('Needs polish')).toBeTruthy();
    expect(screen.getByText('3 (1 critical)')).toBeTruthy(); // counted from the scan, not typed in
  });

  it('says when a scan carried no issue details instead of showing a count', () => {
    show({ scanResult: { credibilityScore: 90 } });
    expect(screen.getByText('No issue details in this scan.')).toBeTruthy();
  });

  it('keeps a real score of 0 (zero is data; missing is not)', () => {
    show({ scanResult: { credibilityScore: 0, issues: [] } });
    expect(screen.getByText('Needs work')).toBeTruthy();
    expect(screen.queryByText('No readiness score yet')).toBeNull();
  });

  it('no longer shows made-up verdicts, probabilities or progress', () => {
    show({ scanResult: { credibilityScore: 72, issues: [] } });
    const text = document.body.textContent;
    expect(text).not.toMatch(/Excellent|3 Found|Portfolio Signal|99%|Probability|Market Ready|High Risk/);
    expect(text).not.toMatch(/✓/); // no pre-ticked steps
  });

  it('maps score bands to labels', () => {
    expect(statusFor(85).label).toBe('Strong');
    expect(statusFor(84).label).toBe('Needs polish');
    expect(statusFor(65).label).toBe('Needs polish');
    expect(statusFor(64).label).toBe('Needs work');
  });
});
