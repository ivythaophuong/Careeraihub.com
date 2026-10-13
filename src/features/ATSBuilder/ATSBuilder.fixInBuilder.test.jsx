// @vitest-environment jsdom
// "Fix in Builder" must take the user to the builder step where the issue is fixed, and keep the issue on screen while they fix it.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

afterEach(cleanup);
vi.mock('../../lib/ai', () => ({ callLLM: vi.fn() }));
vi.mock('html2pdf.js', () => ({ default: vi.fn() }));
import ATSBuilder from './ATSBuilder';

const GOOD = 'Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew revenue by 20%\n• Cut costs by $40,000\n\nEducation\nBSc Business 2018\n\nSkills\nSQL, Excel\n';
const profile = (issues) => ({ name: 'Jane Example', skills: ['SQL'], workExperience: [], education: [], issues });
const issue = (over) => ({ severity: 'high', title: 'No metrics in bullets', description: 'Add numbers to your bullets.', before: 'Handled monthly reporting', after: 'Cut reporting time by 30%', builderStep: 2, module: null, ...over });
const base = (issues) => ({ user: { id: 'u1', token: 't' }, memory: { parseProfile: profile(issues) }, updateMemory: vi.fn(), form: {}, setActiveModule: vi.fn(), setResumeText: vi.fn(), resumeText: GOOD });

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => vi.unstubAllGlobals());

describe('Fix in Builder', () => {
  it('opens the builder at the step the issue belongs to, not at the first step', () => {
    render(<ATSBuilder {...base([issue({ builderStep: 2 })])} />);
    fireEvent.click(screen.getByText(/Fix in Builder/));
    expect(screen.getByText(/Step 2 of 6/)).toBeTruthy();
  });

  it.each([[1, 'Step 1 of 6'], [3, 'Step 3 of 6'], [4, 'Step 4 of 6'], [5, 'Step 5 of 6']])('when nothing else decides, the AI step %i opens %s', (n, label) => {
    render(<ATSBuilder {...base([issue({ title: 'Needs a closer look', description: 'Please review.', builderStep: n })])} />);
    fireEvent.click(screen.getByText(/Fix in Builder/));
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('keeps the issue on screen in the builder: its title, and what is wrong once it is asked for', () => {
    render(<ATSBuilder {...base([issue()])} />);
    fireEvent.click(screen.getByText(/Fix in Builder/));
    const note = screen.getByRole('note', { name: /fixing/i });
    expect(note.textContent).toMatch(/No metrics in bullets/);
    expect(note.textContent).not.toMatch(/Add numbers to your bullets\./);          // folded away: the card stays short
    fireEvent.click(within(note).getByRole('button', { name: /why this matters/i }));
    expect(note.textContent).toMatch(/Add numbers to your bullets\./);
    expect(note.textContent).not.toMatch(/Handled monthly reporting/);               // the quote is not in this resume, so it is not shown as text of it
  });

  it('the user can dismiss the reminder', () => {
    render(<ATSBuilder {...base([issue()])} />);
    fireEvent.click(screen.getByText(/Fix in Builder/));
    fireEvent.click(screen.getByRole('button', { name: /hide this reminder/i }));
    expect(screen.queryByRole('note', { name: /fixing/i })).toBeNull();
  });

  it('opening the builder from the main button (no single issue) starts at step 1 with no reminder', () => {
    render(<ATSBuilder {...base([issue({ builderStep: 4 })])} />);
    (() => { fireEvent.click(screen.getByRole('button', { name: 'Builder' })); fireEvent.click(screen.getByText(/Load from memory/)); })();
    expect(screen.getByText(/Step 1 of 6/)).toBeTruthy();
    expect(screen.queryByRole('note', { name: /fixing/i })).toBeNull();
  });

  it('tells the parts apart: the issue as a heading, then the AI suggestion in a badge with its warning', () => {
    render(<ATSBuilder {...base([issue()])} />);
    fireEvent.click(screen.getByText(/Fix in Builder/));
    const note = screen.getByRole('note', { name: /fixing/i });
    expect(within(note).getByRole('heading', { name: /No metrics in bullets/ })).toBeTruthy();
    expect(note.querySelector('[data-badge="ai"]').textContent).toMatch(/AI suggestion/i);
    expect(note.textContent).toMatch(/check every figure is true/i);
    const suggestion = note.querySelector('[data-quote="after"]');
    expect(suggestion.textContent).toBe('Cut reporting time by [X]%');   // a figure the resume does not contain is shown as [X]
  });
});
