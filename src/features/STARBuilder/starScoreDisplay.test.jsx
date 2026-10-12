// A STAR score is an AI estimate of how a story reads. Wherever it is shown it is named as one, and nothing grades it: no colour, label or
// threshold changes with the number (docs/audits/STAR-BUILDER-AUDIT-2026-10-12.md, F1, F7).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({ callLLM: vi.fn(), extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } } }));
vi.mock('../../lib/serverScoring', () => ({ serverScoringOn: () => false, reviewStarOnServer: vi.fn(), saveStarOnServer: vi.fn() }));
vi.mock('../CoverLetterGen/coverLetter', () => ({ copyToClipboard: vi.fn().mockResolvedValue(true) }));
vi.mock('../../lib/supabase', async (orig) => ({ ...(await orig()), sb: { delete: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('../Landing/LandingPage', () => ({ GetReadyTabStrip: () => null }));
import { callLLM } from '../../lib/ai.jsx';
import STARBuilder from './STARBuilder';
import WeaknessRadar from '../WeaknessRadar/WeaknessRadar';

const IN = {
  Situation: 'Our checkout team had to migrate platforms while 2 million users shopped daily.',
  Task: 'I owned the migration plan and had to avoid downtime.',
  Action: 'I set up blue-green deployments and wrote rollback scripts.',
  Result: 'We finished with no downtime and conversion rose 15 percent.',
};
const reply = (n) => JSON.stringify({
  scores: { situation: n, task: n, action: n, result: n },
  refined: { situation: 's', task: 't', action: 'a', result: 'r' }, oneLiner: 'Led a migration.', feedback: ['x'], missingDetails: [], competencies: ['ownership'],
});
const GRADE_WORDS = /Needs work|\bBuilding\b|\bStrong\b|\bGood\b|\bDeveloping\b|\bExcellent\b|\bWeak\b|Priority/;

beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(cleanup);

const review = async (score) => {
  callLLM.mockResolvedValue(reply(score));
  render(<STARBuilder memory={{}} updateMemory={vi.fn()} setAuthModal={vi.fn()} />);
  Object.entries(IN).forEach(([k, v]) => fireEvent.change(screen.getByLabelText(k), { target: { value: v } }));
  fireEvent.click(screen.getByText(/Refine My Story/));
  return screen.findByLabelText('Overall score');
};

describe('the STAR review result', () => {
  it('is named an AI estimate of the wording, and says it is not a verified assessment', async () => {
    await review(72);
    expect(document.body.textContent).toMatch(/AI estimate/i);
    expect(document.body.textContent).toMatch(/not a verified assessment/i);
    expect(document.body.textContent).toMatch(/can score differently/i);
  });

  it('is shown the same way whatever the number: no colour, border or label changes between a low, a middle and a high score', async () => {
    const seen = [];
    for (const n of [20, 60, 92]) {
      const el = await review(n);
      seen.push({ colour: el.style.color, border: el.closest('[style*="border"]')?.style.border, grade: GRADE_WORDS.test(document.body.textContent) });
      cleanup();
    }
    expect(new Set(seen.map(s => s.colour)).size).toBe(1);
    expect(new Set(seen.map(s => s.border)).size).toBe(1);
    expect(seen.every(s => s.grade === false)).toBe(true);
  });

  it('still shows the number and the four section numbers', async () => {
    const el = await review(72);
    expect(el.textContent).toMatch(/72/);
    expect(document.body.textContent).toMatch(/situation/i);
  });
});

describe('the story bank list', () => {
  const bank = (scores) => scores.map((s, i) => ({ id: `r${i}`, user_id: 'u1', score: s, oneLiner: `Story number ${i}`, date: '2026-01-02T00:00:00Z', refined: { situation: 's', task: 't', action: 'a', result: 'r' } }));

  it('says the scores are AI estimates, and does not colour them by value', () => {
    render(<STARBuilder memory={{ starBank: bank([20, 60, 92]) }} updateMemory={vi.fn()} setAuthModal={vi.fn()} />);
    expect(document.body.textContent).toMatch(/scores are AI estimates/i);
    const colours = ['20', '60', '92'].map((n) => screen.getByText(n).style.color);
    expect(new Set(colours).size).toBe(1);
  });
});

describe('Weakness Radar', () => {
  const mem = (interview, star) => ({
    mockSessions: [{ avgScore: interview }, { avgScore: interview }],
    starBank: [{ score: star }, { score: star }],
  });

  it.each([[15, 15], [55, 55], [90, 90]])('interview %i / STAR %i: no Needs work / Building / Strong label, and the averages are named AI estimates', (a, b) => {
    render(<WeaknessRadar memory={mem(a, b)} setActiveModule={vi.fn()} embedded />);
    expect(document.body.textContent).not.toMatch(GRADE_WORDS);
    expect(screen.getAllByText(/AI estimate/i).length).toBeGreaterThanOrEqual(2);
  });

  it('shows the same next action whatever the average, so no number is treated as a pass mark', () => {
    for (const n of [20, 90]) {
      render(<WeaknessRadar memory={mem(n, n)} setActiveModule={vi.fn()} embedded />);
      expect(screen.getByText('Refine another story')).toBeTruthy();
      expect(screen.getByText('Practice another answer')).toBeTruthy();
      cleanup();
    }
  });
});
