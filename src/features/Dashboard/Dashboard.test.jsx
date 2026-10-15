// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('../../lib/supabase', () => ({ sb: { select: vi.fn(async () => []) } }));
import Dashboard from './Dashboard';

afterEach(cleanup);
const show = (props = {}) => render(<Dashboard memory={{}} form={{ role: 'Product Analyst' }} user={null} setActiveModule={vi.fn()} resumeText="" resumeProfile={null} profileLoading={false} {...props} />);

describe('Dashboard does not report a resume score that nothing records', () => {
  it('a new user sees no "0/100" resume score, no "No scans yet", and no promise of a scan', () => {
    const { container } = show();
    const text = container.textContent;
    expect(text).not.toMatch(/ATS score \d+\/100/i);
    expect(text).not.toMatch(/Score 0\/100/);
    expect(text).not.toMatch(/No scans yet/);
    expect(text).not.toMatch(/after your first scan/i);
  });

  it('the resume tile is an ATS Readiness check with no number, and it opens ATS Builder', () => {
    const setActiveModule = vi.fn();
    show({ setActiveModule });
    expect(screen.getAllByText(/ATS Readiness/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByText(/Check your CV in ATS Builder/)[0]);
    expect(setActiveModule).toHaveBeenCalledWith('ats');
  });

  it('an old stored scan is labelled as an earlier AI estimate and does not drive a "0/100" advice line', () => {
    const { container } = show({ memory: { scanHistory: [{ score: 64, date: '2026-05-22' }] } });
    expect(container.textContent).toMatch(/Earlier AI estimate/);
  });
});

describe('Dashboard shows a JD match percentage as an AI estimate', () => {
  it('the recent-activity line says AI estimate', () => {
    const { container } = show({ memory: { jdAnalyses: [{ roleTitle: 'Product Manager', matchScore: 72, date: '2026-10-01' }] } });
    expect(container.textContent).toMatch(/JD match: Product Manager · AI estimate 72%/);
  });
});
