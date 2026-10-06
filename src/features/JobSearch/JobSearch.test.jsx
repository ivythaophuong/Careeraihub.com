import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import JobSearch from './JobSearch';

const setup = (props = {}) => {
  const p = { form: { role: 'Product Manager', market: 'Singapore' }, memory: {}, updateMemory: vi.fn(), setAuthModal: vi.fn(), setActiveModule: vi.fn(), onProTrigger: vi.fn(), user: null, ...props };
  render(<JobSearch {...p} />);
  return p;
};
const find = () => fireEvent.click(screen.getByText(/Find Jobs/));
const text = () => document.body.textContent;

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Job Search — no invented market data', () => {
  it('does not show unsourced statistics before searching', () => {
    setup();
    for (const claim of ['75%', '$18K', '3.2×', 'rejected by ATS']) expect(text()).not.toContain(claim);
    expect(text()).not.toMatch(/20\+ platforms/);
  });

  it('shows only the real board links after a search, with no fake analysis or salary figures', () => {
    setup();
    find();
    vi.advanceTimersByTime(5000); // the old fake analysis appeared after 2s
    for (const name of ['LinkedIn', 'Indeed', 'Glassdoor', 'Wellfound']) expect(screen.getByText(name)).toBeTruthy();
    const links = [...document.querySelectorAll('a')].map(a => a.href);
    expect(links.some(h => h.includes('linkedin.com') && h.includes('Product%20Manager'))).toBe(true);
    for (const fake of ['AI Search Strategy', 'Market Salary Estimate', 'Expansion Roles', 'Hiring Now', 'INSIDER TIP', '$125k', 'Stripe', 'Revolut']) {
      expect(text()).not.toContain(fake);
    }
  });

  it('asks for a title and location inline instead of crashing on an undefined toast', () => {
    setup({ form: { role: '', market: '' } });
    find();
    expect(screen.getByRole('alert').textContent).toMatch(/job title and a location/i);
  });
});

describe('Salary tab', () => {
  it('shows no fabricated compensation numbers and points to real sources', () => {
    const p = setup();
    fireEvent.click(screen.getByText(/Salary Research/));
    vi.advanceTimersByTime(5000);
    expect(text()).toMatch(/doesn't have a salary database/);
    for (const fake of ['$155,000', '$130k', 'Expected Total Compensation', 'TOP PAYERS', 'Research Salary']) expect(text()).not.toContain(fake);
    const hrefs = [...document.querySelectorAll('a')].map(a => a.href);
    expect(hrefs.some(h => h.includes('levels.fyi'))).toBe(true);
    expect(hrefs.some(h => h.includes('glassdoor.com/Salaries'))).toBe(true);
    fireEvent.click(screen.getByText(/Open Salary Coach/));
    expect(p.setActiveModule).toHaveBeenCalledWith('salary');
  });

  it('mentions the user\'s own role and location, nothing else', () => {
    setup();
    fireEvent.click(screen.getByText(/Salary Research/));
    expect(screen.getByText('Product Manager')).toBeTruthy();
    expect(screen.getByText('Singapore')).toBeTruthy();
  });
});

describe('Application tracker — Recovery Tips', () => {
  it('no longer cites an invented statistic', () => {
    setup({ memory: { applications: [{ id: 1, company: 'Acme', role: 'PM', status: 'Rejected', date: '2026-01-01' }] } });
    fireEvent.click(screen.getByText(/Application Tracker/));
    expect(screen.getByText('Recovery Tips')).toBeTruthy();
    expect(text()).toMatch(/Rejections are a normal part of a job search/);
    expect(text()).not.toMatch(/85%|Statistical analysis|AI Recovery Coach/);
  });
});
