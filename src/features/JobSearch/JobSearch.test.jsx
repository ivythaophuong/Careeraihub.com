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
    fireEvent.click(screen.getByRole('button', { name: /Acme/ })); // the tips sit in the card's detail panel
    expect(screen.getByText('Recovery Tips')).toBeTruthy();
    expect(text()).toMatch(/Rejections are a normal part of a job search/);
    expect(text()).not.toMatch(/85%|Statistical analysis|AI Recovery Coach/);
  });
});

// ── Job Hunt: freshness, adding a job, next steps, hand-off to other modules ────────────────────
// Runs an updater the way useMemory does and returns the merged memory.
const applyUpdate = (p, memory = {}) => {
  const patch = p.updateMemory.mock.calls.map(c => c[0]).reduce((m, u) => ({ ...m, ...(typeof u === 'function' ? u(m) : u) }), memory);
  return patch;
};

describe('Search: freshness and boards', () => {
  it('puts the chosen freshness in the board links and offers Singapore boards first', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    find();
    const hrefs = [...document.querySelectorAll('a')].map(a => a.href);
    expect(hrefs.some(h => h.includes('linkedin.com') && h.includes('f_TPR=r604800'))).toBe(true);
    expect(hrefs.some(h => h.includes('indeed.com') && h.includes('fromage=7'))).toBe(true);
    expect(hrefs.some(h => h.includes('mycareersfuture.gov.sg') && h.includes('new_posting_date'))).toBe(true);
    expect(screen.getByText('MyCareersFuture')).toBeTruthy();
  });

  it('does not offer a Singapore-only board for a global search', () => {
    setup({ form: { role: 'Product Manager', market: 'Global' } });
    find();
    expect(screen.queryByText('MyCareersFuture')).toBeNull();
    expect(screen.getByText('LinkedIn')).toBeTruthy();
  });
});

describe('Add a job', () => {
  const open = () => fireEvent.click(screen.getByText(/Add a job you found/));
  const fill = (company, role) => {
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: company } });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: role } });
  };

  it('needs a company and a role', () => {
    setup({ form: { role: '', market: 'Singapore' } });
    open();
    fireEvent.click(screen.getByText('Add to tracker'));
    expect(screen.getByRole('alert').textContent).toMatch(/company and the role/i);
  });

  it('saves a pasted link on a Saved application and opens the tracker', () => {
    const p = setup({ showToast: vi.fn() });
    open();
    fireEvent.change(screen.getByLabelText('Job link or description'), { target: { value: 'https://example.com/jobs/1' } });
    fill('Northwind', 'Product Manager');
    fireEvent.click(screen.getByText('Add to tracker'));
    const apps = applyUpdate(p).applications;
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({ company: 'Northwind', role: 'Product Manager', status: 'Saved', link: 'https://example.com/jobs/1' });
    expect(p.showToast).toHaveBeenCalledWith('Added to your tracker', 'success');
    expect(screen.getByText('Your tracker is empty')).toBeTruthy(); // the tracker tab is open (this test's memory is a mock, so the new job is not rendered back)
  });

  it('cannot check fit from a link alone, and hands the pasted description to the JD Analyzer', () => {
    const p = setup();
    open();
    expect(screen.getByText('Add and check my fit').closest('button').disabled).toBe(true);
    const jd = 'We are hiring a product manager to own the roadmap. '.repeat(3);
    fireEvent.change(screen.getByLabelText('Job link or description'), { target: { value: jd } });
    fill('Northwind', 'Product Manager');
    fireEvent.click(screen.getByText('Add and check my fit'));
    const mem = applyUpdate(p);
    expect(mem.activeJob).toMatchObject({ company: 'Northwind', role: 'Product Manager' });
    expect(mem.activeJob.jd).toContain('own the roadmap');
    expect(mem.activeJob.appId).toBe(mem.applications[0].id);
    expect(p.setActiveModule).toHaveBeenCalledWith('jd');
  });
});

describe('Tracker: stages and next steps', () => {
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const apps = [
    { id: 1, company: 'Cedar', role: 'PM', status: 'Applied', date: day(2) },
    { id: 2, company: 'Brightpath', role: 'PM', status: 'Applied', date: day(11) },
    { id: 3, company: 'Northwind', role: 'PM', status: 'Interviewing', date: day(12), appliedOn: day(12) },
  ];
  const track = (p = {}) => { const r = setup({ memory: { applications: apps }, ...p }); fireEvent.click(screen.getByText(/Application Tracker/)); return r; };

  it('shows an Applied job older than 7 days under No reply, with no stored change', () => {
    track();
    const noReply = screen.getByRole('region', { name: /No reply/ });
    expect(noReply.textContent).toContain('Brightpath');
    expect(screen.getByRole('region', { name: /^Applied/ }).textContent).toContain('Cedar');
  });

  it('counts only what the user entered', () => {
    track();
    expect(text()).toMatch(/Heard back\s*1\s*of 3/);
  });

  it('moves a job to Interviewing, stamps the dates and triggers the existing Pro prompt', () => {
    const p = track();
    fireEvent.click(screen.getByRole('button', { name: /Cedar/ }));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Interviewing' } });
    const next = applyUpdate(p, { applications: apps }).applications.find(a => a.id === 1);
    expect(next.status).toBe('Interviewing');
    expect(next.reachedInterview).toBe(true);
    expect(p.onProTrigger).toHaveBeenCalledWith('interviewing');
  });

  it('opens Interview Coach for the job, carrying company, role and description', () => {
    const p = track({ memory: { applications: [{ ...apps[2], jd: 'Own the payments roadmap.' }] } });
    fireEvent.click(screen.getByRole('button', { name: /Northwind/ }));
    fireEvent.click(screen.getAllByText('Practise for this job')[0]); // the same step shows in "Do this next" and in the detail panel
    expect(p.setActiveModule).toHaveBeenCalledWith('simulate');
    expect(applyUpdate(p).activeJob).toMatchObject({ appId: 3, company: 'Northwind', role: 'PM', jd: 'Own the payments roadmap.' });
  });

  it('drafts a follow-up email for a job with no reply, without any AI call', () => {
    track();
    fireEvent.click(screen.getByRole('button', { name: /Brightpath/ }));
    fireEvent.click(screen.getAllByText('Draft a follow-up')[0]);
    const draft = screen.getByLabelText(/Draft \(edit before you send\)/);
    expect(draft.value).toContain('Subject: Following up on my PM application');
    expect(draft.value).toContain('Brightpath');
  });

  it('asks before deleting', () => {
    const p = track();
    fireEvent.click(screen.getByRole('button', { name: /Cedar/ }));
    fireEvent.click(screen.getByText('Delete this job'));
    expect(p.updateMemory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Yes, delete'));
    expect(applyUpdate(p, { applications: apps }).applications.map(a => a.id)).toEqual([2, 3]);
  });

  it('keeps old rows working: an ISO created_at date and an unknown status', () => {
    setup({ memory: { applications: [{ id: 9, company: 'Old Co', role: 'PM', status: 'Applied', date: '2024-01-01T08:00:00Z' }, { id: 10, company: 'Odd Co', role: 'PM', status: 'Mystery', date: '2024-01-01' }] } });
    fireEvent.click(screen.getByText(/Application Tracker/));
    expect(screen.getByRole('region', { name: /No reply/ }).textContent).toContain('Old Co');
    expect(text()).toContain('Odd Co');
  });
});

describe('Tracker: empty', () => {
  it('offers to add a job or go search', () => {
    setup();
    fireEvent.click(screen.getByText(/Application Tracker/));
    expect(screen.getByText('Your tracker is empty')).toBeTruthy();
    fireEvent.click(screen.getByText('Find jobs'));
    expect(screen.getByText(/Find Jobs Now/)).toBeTruthy();
  });
});
