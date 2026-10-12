// @vitest-environment jsdom
// "Fix in Builder" on an issue whose text is in the resume opens the Fix page; any other issue keeps the step flow (ATSBuilder.fixInBuilder.test.jsx).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('../../lib/ai', () => ({ callLLM: vi.fn() }));
vi.mock('html2pdf.js', () => ({ default: vi.fn() }));
import ATSBuilder, { builderDraftKey, builderAppliedKey } from './ATSBuilder';
import { TEMPLATES } from './resumeTemplates.jsx';

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

const GOOD = 'Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew revenue by 20%\n• Cut costs by $40,000\n\nEducation\nBSc Business 2018\n\nSkills\nSQL, Excel\n';
const issue = (over) => ({ severity: 'high', title: 'No metrics in bullets', description: 'Add numbers to your bullets.', before: 'Handled monthly reporting', after: 'Cut monthly reporting time by 30%', builderStep: 2, module: null, ...over });
const profile = (issues) => ({
  name: 'Jane Example', email: 'jane@example.com', skills: ['SQL'], education: [],
  workExperience: [{ title: 'Analyst', company: 'Acme', period: '2021 - 2023', bullets: ['Handled monthly reporting for the sales team', 'Built a dashboard for 6 managers'] }],
  issues,
});
const base = (issues) => ({ user: { id: 'u1', token: 't' }, memory: { parseProfile: profile(issues) }, updateMemory: vi.fn(), form: {}, setActiveModule: vi.fn(), setResumeText: vi.fn(), resumeText: GOOD });
const openFix = (issues = [issue()]) => {
  render(<ATSBuilder {...base(issues)} />);
  fireEvent.click(screen.getByText(/Fix in Builder/));
};

describe('opening the Fix page', () => {
  it('Fix in Builder on an issue whose text is in the resume opens the Fix page, not the step form', () => {
    openFix();
    expect(screen.getByText(/Issue 1 of 1/)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();   // the first screen has no edit box
    fireEvent.click(screen.getByRole('button', { name: /Improve this sentence/i }));
    expect(screen.getByRole('textbox', { name: /your text/i }).value).toBe('Handled monthly reporting for the sales team');
    expect(screen.queryByText(/Step \d of 6/)).toBeNull();
  });

  it('an issue whose text is not in the resume keeps the step flow and its reminder', () => {
    openFix([issue({ before: 'Text that is not in the resume' })]);
    expect(screen.getByText(/Step 2 of 6/)).toBeTruthy();
    expect(screen.getByRole('note', { name: /fixing/i })).toBeTruthy();
    expect(screen.queryByText(/Issue 1 of 1/)).toBeNull();
  });

  it('an issue with no quoted text keeps the step flow', () => {
    openFix([issue({ title: 'Needs a closer look', description: 'Please review.', before: '', after: '', builderStep: 4 })]);
    expect(screen.getByText(/Step 4 of 6/)).toBeTruthy();
  });

  it('the main button (no single issue) still opens the Builder at step 1', () => {
    render(<ATSBuilder {...base([issue()])} />);
    fireEvent.click(screen.getByText(/Fix These Issues in Builder/));
    expect(screen.getByText(/Step 1 of 6/)).toBeTruthy();
    expect(screen.queryByText(/Issue 1 of 1/)).toBeNull();
  });
});

describe('saving from the Fix page', () => {
  it('writes the text into the Builder draft and keeps a record the Suggestions panel can read', () => {
    openFix();
    fireEvent.click(screen.getByRole('button', { name: /Improve this sentence/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /your text/i }), { target: { value: 'Cut monthly reporting time for the sales team' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & next/i }));
    const draft = JSON.parse(localStorage.getItem(builderDraftKey('u1')));
    expect(draft.experience[0].bullets[0]).toBe('Cut monthly reporting time for the sales team');
    expect(draft.experience[0].bullets[1]).toBe('Built a dashboard for 6 managers');
    const records = JSON.parse(localStorage.getItem(builderAppliedKey('u1')));
    expect(Object.keys(records)).toEqual(['0:No metrics in bullets:Handled monthly reporting']);
  });

  it('after Open the Builder the Suggestions panel shows that issue as Applied, and there is no Fixing reminder', () => {
    openFix();
    fireEvent.click(screen.getByRole('button', { name: /Improve this sentence/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /your text/i }), { target: { value: 'Cut monthly reporting time for the sales team' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Open the Builder/i }));
    expect(screen.getByText(/Step \d of 6/)).toBeTruthy();
    expect(screen.queryByRole('note', { name: /fixing/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Review/ }));
    expect(screen.getByText('Applied')).toBeTruthy();
  });

  it('Back to list returns to Upload & Parse', () => {
    openFix();
    fireEvent.click(screen.getByRole('button', { name: /Back to list/i }));
    expect(screen.queryByText(/Issue 1 of 1/)).toBeNull();
    expect(screen.getByText(/Fix in Builder/)).toBeTruthy();
  });
});

describe('the template', () => {
  it('the template the user chose in the gallery is the one the Fix page draws, after a trip through the tabs', () => {
    render(<ATSBuilder {...base([issue()])} />);
    fireEvent.click(screen.getByRole('button', { name: /^Templates$/ }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(TEMPLATES[4].label) }));
    fireEvent.click(screen.getByRole('button', { name: /Upload & Parse/ }));
    fireEvent.click(screen.getByText(/Fix in Builder/));
    expect(document.querySelector(`[data-template="${TEMPLATES[4].id}"]`)).toBeTruthy();
    expect(document.querySelector(`[data-template="${TEMPLATES[0].id}"]`)).toBeNull();
  });
});
