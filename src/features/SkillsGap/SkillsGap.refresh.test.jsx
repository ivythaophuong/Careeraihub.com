// @vitest-environment jsdom
// A model's answer differs from run to run, so a "Refresh" that overwrites a result gives the user a different answer for the same inputs.
// The analysis is made again only when what it was based on has changed, and the page says so.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

afterEach(cleanup);
const callLLM = vi.fn();
vi.mock('../../lib/ai', () => ({ callLLM: (...a) => callLLM(...a), extractJSON: (s) => JSON.parse(s) }));
vi.mock('../Landing/LandingPage', () => ({ GetReadyTabStrip: () => null }));
import SkillsGap from './SkillsGap';
import { skillsGapInputKey } from './skillsGapInputs';

const RESUME = 'Jane Doe\nSoftware Engineer\nSQL, Python';
const form = { role: 'Engineer', market: 'Singapore', level: 'Mid' };
const result = { summary: 'Solid base.', skills: [{ name: 'SQL', yourLevel: 'good', status: 'strong' }], recommendations: [] };
const keyFor = (over = {}) => skillsGapInputKey({ form, resumeCtx: RESUME, scanSummary: '', jdTitles: [], ...over });
const mount = ({ memory = {}, formOver = {}, resumeText = RESUME } = {}) => {
  const updateMemory = vi.fn();
  render(<SkillsGap resumeText={resumeText} form={{ ...form, ...formOver }} memory={memory} updateMemory={updateMemory} showToast={vi.fn()} setActiveModule={vi.fn()} />);
  return updateMemory;
};

describe('skillsGapInputKey', () => {
  it('is the same for the same inputs and changes when any input the analysis uses changes', () => {
    expect(keyFor()).toBe(keyFor());
    expect(keyFor({ form: { ...form, role: 'Data Analyst' } })).not.toBe(keyFor());
    expect(keyFor({ form: { ...form, level: 'Senior' } })).not.toBe(keyFor());
    expect(keyFor({ form: { ...form, market: 'Other' } })).not.toBe(keyFor());
    expect(keyFor({ resumeCtx: `${RESUME}\nTableau` })).not.toBe(keyFor());
    expect(keyFor({ jdTitles: ['Product Analyst'] })).not.toBe(keyFor());
    expect(keyFor({ scanSummary: 'A scan summary' })).not.toBe(keyFor());
  });
  it('ignores what the analysis does not see (a CV change after the first 800 characters)', () => {
    const long = `${'x'.repeat(800)}`;
    expect(keyFor({ resumeCtx: `${long}AAA` })).toBe(keyFor({ resumeCtx: `${long}BBB` }));
  });
});

describe('Skills Gap does not offer a refresh that would change the answer for the same inputs', () => {
  it('with a result for the current inputs: no Refresh and no Analyze button, and it says the result is up to date', () => {
    mount({ memory: { skillsGap: { result, inputKey: keyFor(), computedAt: '2026-10-11T00:00:00Z' } } });
    expect(screen.queryByRole('button', { name: /Refresh|Analyze my gaps|Update analysis/ })).toBeNull();
    expect(screen.getByText(/Up to date/)).toBeTruthy();
    expect(screen.getByText(/only when one of these changes/i)).toBeTruthy();
  });

  it('when an input changed (the role): offers "Update analysis" and says why', () => {
    mount({ memory: { skillsGap: { result, inputKey: keyFor(), computedAt: '2026-10-11T00:00:00Z' } }, formOver: { role: 'Data Analyst' } });
    expect(screen.getByRole('button', { name: /Update analysis/ })).toBeTruthy();
    expect(screen.getByText(/inputs changed/i)).toBeTruthy();
  });

  it('a result saved before inputs were tracked is offered one update, with a plain explanation', () => {
    mount({ memory: { skillsGap: { result, computedAt: '2026-10-01T00:00:00Z' } } });
    expect(screen.getByRole('button', { name: /Update analysis/ })).toBeTruthy();
    expect(screen.getByText(/before inputs were tracked/i)).toBeTruthy();
  });

  it('with no result yet: "Analyze my gaps"', () => {
    mount();
    expect(screen.getByRole('button', { name: /Analyze my gaps/ })).toBeTruthy();
  });

  it('updating calls the model once and saves the key of the inputs it used, so the next visit shows "Up to date"', async () => {
    callLLM.mockClear();
    callLLM.mockResolvedValue(JSON.stringify(result));
    const updateMemory = mount({ memory: { skillsGap: { result, inputKey: keyFor(), computedAt: '2026-10-11T00:00:00Z' } }, formOver: { role: 'Data Analyst' } });
    fireEvent.click(screen.getByRole('button', { name: /Update analysis/ }));
    await waitFor(() => expect(updateMemory).toHaveBeenCalled());
    expect(callLLM).toHaveBeenCalledTimes(1);
    const saved = updateMemory.mock.calls[0][0]({}).skillsGap;
    expect(saved.inputKey).toBe(keyFor({ form: { ...form, role: 'Data Analyst' } }));
  });
});
