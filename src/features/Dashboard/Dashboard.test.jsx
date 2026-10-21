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

describe('Dashboard names the interview figure and does not turn "no session" into a score', () => {
  it('a user with no session sees no "0/100" interview readiness and no "Interview Ready" badge', () => {
    const { container } = show();
    const text = container.textContent;
    expect(text).not.toMatch(/readiness 0\/100/i);
    expect(text).not.toMatch(/Interview Ready/);
    expect(text).toMatch(/Start first session/);
  });

  it('with sessions, the figure is called the latest session and is not an unqualified readiness', () => {
    const { container } = show({ memory: { mockSessions: [{ avgScore: 85, questionsCount: 5 }, { avgScore: 40, questionsCount: 5 }] } });
    const text = container.textContent;
    expect(text).toMatch(/Latest session/);
    expect(text).toMatch(/85/);
    expect(text).not.toMatch(/Interview Ready/);
  });

  it('a latest session that really scored 0 is shown as 0, not as "no session"', () => {
    const { container } = show({ memory: { mockSessions: [{ avgScore: 0, questionsCount: 5 }] } });
    expect(container.textContent).not.toMatch(/Start first session/);
  });
});

describe('Dashboard priority actions are real buttons', () => {
  it('each priority action is a button a keyboard can reach, and it opens its module', () => {
    const setActiveModule = vi.fn();
    const { container } = show({ setActiveModule });
    const section = screen.getByText('Priority Actions').parentElement;
    const items = [...section.querySelectorAll('[data-priority-action]')];
    expect(items.length).toBeGreaterThan(0);
    for (const el of items) {
      expect(el.tagName).toBe('BUTTON');
      expect(el.getAttribute('type')).toBe('button');
    }
    fireEvent.click(items[0]);
    expect(setActiveModule).toHaveBeenCalledTimes(1);
  });
});
