// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../components/OriginalFeatures', () => ({ GlowBar: () => null }));
import JobSearch from './JobSearch';

afterEach(cleanup);

const setup = () => render(<JobSearch form={{ role: 'Product Manager', market: 'Singapore' }} memory={{}} updateMemory={vi.fn()} showToast={vi.fn()} />);

describe('JobSearch', () => {
  it('searching shows job-board links built from the query, and no invented market data', () => {
    setup();
    fireEvent.click(screen.getByText(/Find Jobs Now/));
    const links = [...document.querySelectorAll('a[href]')].map(a => a.href);
    expect(links.some(h => h.includes('linkedin.com') && h.includes('Product%20Manager'))).toBe(true);
    expect(links.some(h => h.includes('indeed.com'))).toBe(true);

    const text = document.body.textContent;
    for (const invented of ['Stripe', 'Revolut', 'Series B', '12% MoM', '$95k', '$160k', 'INSIDER TIP', 'Expansion Roles', 'Hiring Now']) {
      expect(text).not.toContain(invented);
    }
    expect(text).toMatch(/don't have live data/);
  });
});
