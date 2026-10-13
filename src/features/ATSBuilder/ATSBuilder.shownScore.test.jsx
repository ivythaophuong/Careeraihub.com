// @vitest-environment jsdom
// Product decision 2026-10-09: the ATS score shown to the user is computed by code (src/scoring/), never by the model.
// An AI-made score in a stored profile (profile.atsScore / profile.scoreBreakdown) must not reach the screen.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

afterEach(cleanup);
const callLLM = vi.fn();
vi.mock('../../lib/ai', () => ({ callLLM: (...a) => callLLM(...a) }));
vi.mock('html2pdf.js', () => ({ default: vi.fn() }));
import ATSBuilder from './ATSBuilder';

const GOOD = 'Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew revenue by 20%\n• Cut costs by $40,000\n\nEducation\nBSc Business 2018\n\nSkills\nSQL, Excel, Leadership';
const AI_PROFILE = {
  name: 'Jane Example', skills: ['SQL'], workExperience: [], education: [],
  atsScore: 99, scoreBreakdown: [{ dimension: 'Impact Metrics', score: 99 }, { dimension: 'Keywords', score: 98 }],
  issues: [{ severity: 'high', title: 'No metrics in bullets', description: 'Add numbers.', before: 'a', after: 'b', builderStep: 2, module: null }],
};
const base = { user: { id: 'u1', token: 't' }, memory: { parseProfile: AI_PROFILE }, updateMemory: vi.fn(), form: {}, setActiveModule: vi.fn(), setResumeText: vi.fn() };

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));

const shownNumber = () => Number(screen.getByText('out of 100').previousSibling.textContent);

describe('ATS Builder shows the computed score', () => {
  it('shows the score computed from the resume text and ignores the model\'s number', () => {
    render(<ATSBuilder {...base} resumeText={GOOD} />);
    expect(screen.getByText('ATS Readiness')).toBeTruthy();
    expect(screen.queryByText(/ATS Readiness Score/)).toBeNull(); // approved name is "ATS Readiness", never "ATS score"
    fireEvent.click(screen.getByLabelText('How is this score calculated?'));
    expect(screen.getByText(/not the score any real recruiting system gives you/i)).toBeTruthy(); // says what it is not
    expect(screen.getByText(/not a prediction of interviews or hiring/i)).toBeTruthy();
    const n = shownNumber();
    expect(n).not.toBe(99);
    expect(n).toBeGreaterThan(0);
    expect(screen.queryByText('Impact Metrics')).toBeNull();     // the model's breakdown is gone
    expect(screen.getByText('Completeness')).toBeTruthy();       // the computed parts are shown instead
    expect(screen.getByText('Measurable impact')).toBeTruthy();
    expect(screen.getByText('Date consistency')).toBeTruthy();
    expect(screen.getByText(/2 of 2 experience bullets contain a measurable number/)).toBeTruthy(); // the evidence is shown
  });

  it('gives the same resume the same score every time', () => {
    render(<ATSBuilder {...base} resumeText={GOOD} />);
    const first = shownNumber();
    cleanup();
    render(<ATSBuilder {...base} resumeText={GOOD} />);
    expect(shownNumber()).toBe(first);
  });

  it('shows the score at once, without calling the AI (the AI only runs when the user asks)', () => {
    callLLM.mockClear();
    render(<ATSBuilder {...base} memory={{}} resumeText={GOOD} />);
    expect(shownNumber()).toBeGreaterThan(0);
    expect(callLLM).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Find issues & enhance with AI/).length).toBeGreaterThan(0); // the AI step is offered, not forced
  });

  it('marks the score as rule-based with a small badge; the explanation opens from an info button instead of sitting on the screen', () => {
    render(<ATSBuilder {...base} resumeText={GOOD} />);
    expect(screen.getByText('Rule-based')).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();                    // closed by default: no wall of text
    const info = screen.getByLabelText('How is this score calculated?');
    expect(info.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(info);
    expect(info.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('note').textContent).toMatch(/same resume always gets the same score; no AI is involved/);
    fireEvent.click(info);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('shows no score card at all (not a 0) when there is no readable text', () => {
    render(<ATSBuilder {...base} resumeText={'   '} />);
    expect(screen.queryByText('out of 100')).toBeNull();
    expect(screen.queryByText('ATS Readiness')).toBeNull();
  });
});

describe('ATS Builder when the pasted text has lost its line breaks', () => {
  const ONE_LINE = GOOD.replace(/\s*\n\s*/g, ' ').repeat(3);
  it('shows no score and says the line breaks are missing, with what to do, instead of a low score', () => {
    render(<ATSBuilder {...base} resumeText={ONE_LINE} />);
    expect(screen.getByText(/line breaks/i)).toBeTruthy();
    expect(screen.getByText(/paste it again|upload the file/i)).toBeTruthy();
    expect(screen.queryByText('out of 100')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Needs Major Work/);
  });
  it('a normal text still gets its score', () => {
    render(<ATSBuilder {...base} resumeText={GOOD} />);
    expect(screen.getByText('out of 100')).toBeTruthy();
    expect(screen.queryByText(/line breaks are missing/i)).toBeNull();
  });
});

describe('ATS Builder when the sections of the resume cannot be read (for example two columns read line by line)', () => {
  const TWO_COLUMN = `Ahmed Khalil                          SKILLS\nahmed.khalil@example.com              Project planning\n+20 100 555 0100                      Budgeting\n                                       Risk management\n\nEXPERIENCE                            EDUCATION\nProject Manager, Delta Build          BSc Civil Engineering\nFeb 2018 - Present                    Cairo University, 2014\n- Delivered 6 projects on budget      Languages: Arabic, English\n- Led a site team of 12 people        Certifications: PMP\n`;
  it('shows no score and says what could not be found and what to do, instead of a score of 50', () => {
    render(<ATSBuilder {...base} resumeText={TWO_COLUMN} />);
    expect(screen.getByText(/could not find your experience, education or skills/i)).toBeTruthy();
    expect(screen.getByText(/two columns|a table/i)).toBeTruthy();
    expect(screen.queryByText('out of 100')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Needs Major Work/);
  });
});
