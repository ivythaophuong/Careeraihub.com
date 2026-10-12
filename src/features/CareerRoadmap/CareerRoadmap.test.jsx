// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('../../lib/supabase', () => ({ sb: { select: vi.fn(async () => []) } }));
import CareerRoadmap from './CareerRoadmap';

afterEach(cleanup);
const render1 = (props = {}) => render(<CareerRoadmap memory={{}} form={{ role: 'Product Analyst', market: 'Singapore' }} user={null} setActiveModule={vi.fn()} {...props} />);

describe('Career Roadmap shows no invented market figures', () => {
  it('has no fixed salary range and no "market value" claim, for either market', () => {
    for (const market of ['Singapore', 'Other']) {
      const { container, unmount } = render1({ form: { role: 'Product Analyst', market } });
      const text = container.textContent;
      expect(text).not.toMatch(/SGD\s*\d/i);
      expect(text).not.toMatch(/\$\s*\d+\s*[–-]\s*\d+\s*K/i);
      expect(text).not.toMatch(/market value/i);
      expect(text).not.toMatch(/mid-market/i);
      unmount();
    }
  });

  it('points to Salary Prep, which works from the user\'s own numbers', () => {
    const setActiveModule = vi.fn();
    render1({ setActiveModule });
    fireEvent.click(screen.getByRole('button', { name: /Salary Prep/i }));
    expect(setActiveModule).toHaveBeenCalledWith('salary');
  });
});

describe('Career Roadmap step 1 does not depend on a scan that nothing writes', () => {
  it('a new user sees no ATS-score target anywhere', () => {
    const { container } = render1({ memory: {} });
    const text = container.textContent;
    expect(text).not.toMatch(/ATS score/i);
    expect(text).not.toMatch(/ATS 75/i);
    expect(screen.getByText('Add your resume')).toBeTruthy();
    expect(text).toMatch(/0\/5 steps complete/);
  });

  it('adding a resume completes step 1', () => {
    const { container } = render1({ memory: { resumeText: 'Jordan Lee\nExperience\nAnalyst' } });
    expect(container.textContent).toMatch(/1\/5 steps complete/);
  });

  it('an old stored scan score does not complete step 1 and is not shown as a target', () => {
    const { container } = render1({ memory: { scanHistory: [{ score: 90, date: '2026-05-22' }] } });
    expect(container.textContent).toMatch(/0\/5 steps complete/);
    expect(container.textContent).not.toMatch(/ATS score/i);
  });
});

describe('Career Roadmap makes no promise it cannot back', () => {
  const states = {
    'new user': {},
    'resume only': { resumeText: 'Jordan Lee\nExperience\nAnalyst' },
    'interview practice': { resumeText: 'x'.repeat(30), mockSessions: [{ avgScore: 60 }], starBank: [{}, {}, {}] },
    'ready, skills gap run': { resumeText: 'x'.repeat(30), mockSessions: [{ avgScore: 80 }], starBank: [{}, {}, {}, {}, {}], skillsGap: { result: {} } },
  };
  it.each(Object.entries(states))('%s: no estimated duration, no "offer timeline", no certificate, no "unlocked" claim', (_n, memory) => {
    const { container } = render1({ memory });
    const text = container.textContent;
    expect(text).not.toMatch(/estimated offer|offer timeline|\best\. \d|\d+\s*[–-]\s*\d+\s*weeks?|at your current pace/i);
    expect(text).not.toMatch(/certificate/i);
    expect(text).not.toMatch(/unlocked/i);
  });

  it('step 3 does not claim the resume was updated or the gap closed: the step is "run the analysis"', () => {
    const { container } = render1({ memory: { resumeText: 'x'.repeat(30), skillsGap: { result: {} } } });
    expect(container.textContent).not.toMatch(/resume updated|gap closed|closed\b/i);
    expect(container.textContent).toMatch(/Skills gap analysis run/i);
  });
});

describe('Career Roadmap "what to do next"', () => {
  it('shows one next action for a new user and it opens the Resume Builder', () => {
    const setActiveModule = vi.fn();
    render1({ memory: {}, setActiveModule });
    const card = screen.getByRole('region', { name: /what to do next/i });
    fireEvent.click(card.querySelector('button'));
    expect(setActiveModule).toHaveBeenCalledWith('ats');
  });

  it('skills gap done but no interview practice: it recommends the interview, with the real STAR count', () => {
    const setActiveModule = vi.fn();
    render1({ memory: { resumeText: 'x'.repeat(30), skillsGap: { result: {} }, starBank: [{}, {}] }, setActiveModule });
    const card = screen.getByRole('region', { name: /what to do next/i });
    expect(card.textContent).toMatch(/no mock interview yet/i);
    expect(card.textContent).toMatch(/2 of 5 STAR stories/i);
    fireEvent.click(Array.from(card.querySelectorAll('button')).find(b => /mock interview/i.test(b.textContent)));
    expect(setActiveModule).toHaveBeenCalledWith('simulate');
  });

  it('has no next-action card when every step is done', async () => {
    const { sb } = await import('../../lib/supabase');
    sb.select.mockResolvedValueOnce([{ trust_score: 70, is_visible: true }]);
    const memory = { resumeText: 'x'.repeat(30), mockSessions: [{ avgScore: 80 }], starBank: [{}, {}, {}, {}, {}], skillsGap: { result: {} } };
    const { findByText } = render(<CareerRoadmap memory={memory} form={{ role: 'Analyst' }} user={{ id: 'u1', token: 't' }} setActiveModule={vi.fn()} syncedAt={1} />);
    await findByText(/5\/5 steps complete/);
    expect(screen.queryByRole('region', { name: /what to do next/i })).toBeNull();
  });
});
