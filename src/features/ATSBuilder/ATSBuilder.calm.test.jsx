// @vitest-environment jsdom
// The Builder, made calmer: the resume preview owns the right column; the score and the suggestions are behind a Review button; one primary action per
// screen; the buttons say where they go.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

vi.mock('../../lib/ai', () => ({ callLLM: vi.fn() }));
vi.mock('html2pdf.js', () => ({ default: vi.fn() }));
import ATSBuilder from './ATSBuilder';

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

const GOOD = 'Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew revenue by 20%\n\nEducation\nBSc Business 2018\n\nSkills\nSQL, Excel\n';
const issue = (over) => ({ severity: 'high', title: 'No metrics in bullets', description: 'Add numbers.', before: 'Text that is not in the resume', after: 'Cut time by 30%', builderStep: 2, module: null, ...over });
const profile = (issues) => ({
  name: 'Jane Example', email: 'jane@example.com', skills: ['SQL'], education: [],
  workExperience: [{ title: 'Analyst', company: 'Acme', period: '2021 - 2023', bullets: ['Handled monthly reporting', 'Built a dashboard for 6 managers'] }],
  issues,
});
const base = (issues = [issue(), issue({ title: 'Thin skills', before: '', after: '', builderStep: 4 })]) => ({ user: { id: 'u1', token: 't' }, memory: { parseProfile: profile(issues) }, updateMemory: vi.fn(), form: {}, setActiveModule: vi.fn(), setResumeText: vi.fn(), resumeText: GOOD });
const openBuilder = () => fireEvent.click(screen.getByText(/Fix These Issues in Builder/));
const review = () => screen.getByRole('button', { name: /^Review/ });

describe('the right column is the resume', () => {
  it('does not carry the score or the suggestions until the user opens Review', () => {
    render(<ATSBuilder {...base()} />);
    openBuilder();
    expect(screen.queryByRole('region', { name: /ats readiness of this draft/i })).toBeNull();
    expect(screen.queryByRole('region', { name: /suggestions from the ai/i })).toBeNull();
    expect(screen.getByText(/Live Preview/i)).toBeTruthy();
  });

  it('has one Review button that says what is in it: the score and how many suggestions', () => {
    render(<ATSBuilder {...base()} />);
    openBuilder();
    expect(review().textContent).toMatch(/ATS \d+/);
    expect(review().textContent).toMatch(/2 suggestions/);
    expect(review().getAttribute('aria-expanded')).toBe('false');
  });

  it('Review opens the score and the suggestions, and closes them again', () => {
    render(<ATSBuilder {...base()} />);
    openBuilder();
    fireEvent.click(review());
    expect(review().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('region', { name: /ats readiness of this draft/i })).toBeTruthy();
    expect(screen.getByRole('region', { name: /suggestions from the ai/i })).toBeTruthy();
    fireEvent.click(review());
    expect(screen.queryByRole('region', { name: /suggestions from the ai/i })).toBeNull();
  });

  it('the resume preview is still on screen while Review is open', () => {
    render(<ATSBuilder {...base()} />);
    openBuilder();
    fireEvent.click(review());
    expect(screen.getByText(/Live Preview/i)).toBeTruthy();
  });

  it('says nothing about suggestions when there are none, and Review still opens the score', () => {
    render(<ATSBuilder {...base([])} />);
    openBuilder();
    expect(review().textContent).toMatch(/ATS \d+/);
    expect(review().textContent).not.toMatch(/suggestion/i);
    fireEvent.click(review());
    expect(screen.getByRole('region', { name: /ats readiness of this draft/i })).toBeTruthy();
    expect(screen.queryByRole('region', { name: /suggestions from the ai/i })).toBeNull();
  });

  it('keeps the template line and the downloads in a small toolbar', () => {
    render(<ATSBuilder {...base()} />);
    openBuilder();
    expect(screen.getByText(/Template: /)).toBeTruthy();
    expect(screen.getByRole('button', { name: /change template/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /download word/i })).toBeTruthy();
  });
});

describe('one primary action per screen', () => {
  const primaries = () => Array.from(document.querySelectorAll('[data-primary="true"]')).map(e => e.textContent.trim());

  it('on a step of the form the primary action is Next, and Download PDF is a quiet button', () => {
    render(<ATSBuilder {...base()} />);
    openBuilder();
    expect(primaries()).toEqual(['Next →']);
    expect(screen.getByRole('button', { name: /download pdf/i }).getAttribute('data-primary')).not.toBe('true');
  });

  it('on the last step the primary action is Download PDF', () => {
    render(<ATSBuilder {...base()} />);
    openBuilder();
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByText('Next →'));
    expect(screen.getByText(/Step 6 of 6/)).toBeTruthy();
    expect(primaries()).toEqual(['⬇ Download PDF']);
  });
});

describe('buttons that say where they go', () => {
  it('the reminder is hidden with Hide this reminder, not Done', () => {
    render(<ATSBuilder {...base()} />);
    fireEvent.click(screen.getAllByText(/Fix in Builder/)[0]);
    expect(screen.queryByRole('button', { name: /^Done$/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /hide this reminder/i }));
    expect(screen.queryByRole('note', { name: /fixing/i })).toBeNull();
  });

  it('a suggestion that cannot be applied offers a button named for the step it goes to', () => {
    render(<ATSBuilder {...base()} />);
    openBuilder();
    fireEvent.click(review());
    const c = screen.getByText('No metrics in bullets').closest('[data-issue]');
    expect(within(c).getByRole('button', { name: /go to experience/i })).toBeTruthy();
    expect(within(c).queryByRole('button', { name: /edit this step/i })).toBeNull();
  });
});
