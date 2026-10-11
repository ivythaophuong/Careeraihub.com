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
