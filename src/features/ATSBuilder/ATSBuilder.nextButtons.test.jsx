// @vitest-environment jsdom
// One main (pink) button on each screen of the journey, worded "Next: ..." (design: docs/architecture/plans/DESIGN-guided-journey.md, section 3.2).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('../../lib/ai', () => ({ callLLM: vi.fn() }));
vi.mock('html2pdf.js', () => ({ default: vi.fn() }));
import ATSBuilder from './ATSBuilder';

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'innerWidth', { value: 1800, configurable: true, writable: true });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

const GOOD = 'Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew revenue by 20%\n\nEducation\nBSc Business 2018\n\nSkills\nSQL, Excel\n';
const issue = { severity: 'high', title: 'No metrics in bullets', description: 'Add numbers.', before: 'Handled monthly reporting', after: 'Cut monthly reporting time by 30%', builderStep: 2, module: null };
const profile = (issues) => ({ name: 'Jane Example', email: 'jane@example.com', skills: ['SQL'], education: [], workExperience: [{ title: 'Analyst', company: 'Acme', period: '2021 - 2023', bullets: ['Handled monthly reporting for the sales team'] }], issues });
const base = (issues) => ({ user: { id: 'u1', token: 't' }, memory: { parseProfile: profile(issues) }, updateMemory: vi.fn(), form: {}, setActiveModule: vi.fn(), setResumeText: vi.fn(), resumeText: GOOD });
// A button is "pink" when it has the accent as its background: the product's one main action of a screen.
const pink = () => screen.getAllByRole('button').filter(b => /var\(--lp-teal\)/.test(b.style.background) && !/^(Step \d of 4)/.test(b.getAttribute('aria-label') || ''));

describe('the resume tab, once a resume is loaded', () => {
  it('has one main button, "Next: improve it", when there are issues', () => {
    render(<ATSBuilder {...base([issue])} />);
    expect(screen.getByRole('button', { name: /^Next: improve it/ })).toBeTruthy();
    expect(screen.queryByText(/Fix These/)).toBeNull();
    expect(pink().map(b => b.textContent.trim())).toEqual(['Next: improve it →']);
  });

  it('says "Next: edit your resume" when there is nothing to improve, and no issue is claimed', () => {
    render(<ATSBuilder {...base([])} />);
    expect(screen.getByRole('button', { name: /^Next: edit your resume/ })).toBeTruthy();
    expect(screen.queryByText(/Next: improve it/)).toBeNull();
  });

  it('the main button comes before the list of issues, so a new user sees it without scrolling past every issue', () => {
    render(<ATSBuilder {...base([issue, { ...issue, title: 'Plain verb', before: 'Built a dashboard' }, { ...issue, title: 'Another', before: 'Trained' }])} />);
    const next = screen.getByRole('button', { name: /^Next: improve it/ });
    const heading = screen.getByText(/Issues to Fix/i);
    expect(next.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();   // the heading comes after the button
  });

  it('with no issues the main button is still there, and no list of issues is', () => {
    render(<ATSBuilder {...base([])} />);
    expect(screen.getByRole('button', { name: /^Next: edit your resume/ })).toBeTruthy();
    expect(screen.queryByText(/Issues to Fix/i)).toBeNull();
  });

  it('the analysis button is not pink any more once a resume is loaded (it is "Re-run", not the way forward)', () => {
    render(<ATSBuilder {...base([issue])} />);
    expect(screen.getByRole('button', { name: /Re-run AI analysis/ }).style.background).not.toMatch(/var\(--lp-teal\)/);
  });

  it('the main button opens the Fix page on the first issue, as its words say (it used to open the Builder at step 1)', () => {
    render(<ATSBuilder {...base([issue])} />);
    fireEvent.click(screen.getByRole('button', { name: /^Next: improve it/ }));
    expect(screen.getByText(/Issue 1 of 1/)).toBeTruthy();
  });
});

describe('the end of the Fix page', () => {
  const finish = () => {
    render(<ATSBuilder {...base([issue])} />);
    fireEvent.click(screen.getByRole('button', { name: /^Next: improve it/ }));
    fireEvent.click(screen.getByRole('button', { name: /Improve this sentence/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /your text/i }), { target: { value: 'Cut monthly reporting time for the sales team' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & next/i }));
  };

  it('has one main button, "Next: choose a layout", and "Open the Builder" is a quiet one', () => {
    finish();
    expect(screen.getByText(/Review finished/i)).toBeTruthy();
    const main = screen.getByRole('button', { name: /^Next: choose a layout/ });
    expect(main.style.background).toMatch(/var\(--lp-teal\)/);
    expect(screen.getByRole('button', { name: /Open the Builder/i }).style.background).not.toMatch(/var\(--lp-teal\)/);
    expect(pink()).toHaveLength(1);
  });

  it('the main button opens the layouts', () => {
    finish();
    fireEvent.click(screen.getByRole('button', { name: /^Next: choose a layout/ }));
    expect(screen.getByText(/Choose a template/i)).toBeTruthy();
    expect(screen.getByText(/Step 1 of 2/i)).toBeTruthy();
  });
});

describe('the layouts', () => {
  it('already has one main button, "Next: download or save"', () => {
    render(<ATSBuilder {...base([issue])} />);
    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
    expect(screen.getByRole('button', { name: /^Next: download or save/ })).toBeTruthy();
    expect(pink()).toHaveLength(1);
  });
});
