// @vitest-environment jsdom
// Product decision 2026-10-09: the ATS score shown to the user is computed by code (src/scoring/), never by the model.
// An AI-made score in a stored profile (profile.atsScore / profile.scoreBreakdown) must not reach the screen.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

afterEach(cleanup);
vi.mock('../../lib/ai', () => ({ callLLM: vi.fn() }));
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
    expect(screen.getByText('Resume Readiness')).toBeTruthy();
    expect(screen.queryByText(/ATS Readiness Score/)).toBeNull(); // not named after ATS: real ATS vendors publish no single score
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

  it('shows no score (not 0) when the resume text cannot be read', () => {
    render(<ATSBuilder {...base} resumeText={'   '} />);
    expect(screen.getByText('no score yet')).toBeTruthy();
    expect(screen.queryByText('out of 100')).toBeNull();
  });
});
