import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({ callLLM: vi.fn(), extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } } }));
vi.mock('../../lib/serverScoring', () => ({ serverScoringOn: () => false, evaluateAnswerOnServer: vi.fn(), saveInterviewOnServer: vi.fn() }));
import { callLLM } from '../../lib/ai.jsx';
import HiringManagerSim from './HiringManagerSim';

const QUESTIONS = { questions: [1, 2, 3, 4, 5].map(n => ({ question: `Tell me about a time you led a project under pressure (${n})?`, focus: `Focus ${n}`, why: `Why ${n}` })) };
const EVAL = { score: 70, worked: 'Clear structure.', missed: 'No measurable result.', tip: 'A tip.', betterAnswerOutline: ['Open with context'] };
const ANSWER = 'I led a migration of our checkout flow, split the work into three phases and shipped it in six weeks, cutting payment errors by 30 percent.';
const resumeText = { type: 'text', content: 'Product manager at Acme. '.repeat(10), fileName: 'cv' };
const updateMemory = vi.fn();
const setup = (id = 'u1') => render(<HiringManagerSim resumeText={resumeText} form={{ role: '' }} memory={{}} updateMemory={updateMemory} setAuthModal={vi.fn()} setActiveModule={vi.fn()} user={{ id }} />);
const run = async () => {
  callLLM.mockImplementation(async (msgs) => (msgs[0].content.includes('Write 5 interview questions') ? JSON.stringify(QUESTIONS) : JSON.stringify(EVAL)));
  fireEvent.click(screen.getByText(/Series B/)); await screen.findByText(/Question 1\/5/);
  fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: ANSWER } });
  fireEvent.click(screen.getByText(/Get AI Feedback/));
  await screen.findByLabelText('Answer score');
};

beforeEach(() => { sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe('the rules panel next to the AI feedback', () => {
  it('is absent by default (production builds set nothing)', async () => {
    setup(); await run();
    expect(screen.queryByRole('region', { name: /Structure Score/ })).toBeNull();
  });
  it('is absent for a user who is not listed', async () => {
    vi.stubEnv('VITE_STRUCTURE_PANEL_USERS', 'someone-else');
    setup('u1'); await run();
    expect(screen.queryByRole('region', { name: /Structure Score/ })).toBeNull();
  });
  it('appears for a listed user, after the feedback, and leaves the AI score and everything saved exactly as they were', async () => {
    vi.stubEnv('VITE_STRUCTURE_PANEL_USERS', 'u1');
    setup('u1'); await run();
    expect(screen.getByRole('region', { name: /Structure Score/ })).toBeTruthy();
    expect(screen.getByLabelText('Answer score').textContent).toBe('70%');          // the AI figure is unchanged
    expect(updateMemory).not.toHaveBeenCalled();                                      // nothing saved for the preview, nothing saved yet at all
  });
  it('is not on screen while the answer is still being typed', async () => {
    vi.stubEnv('VITE_STRUCTURE_PANEL_USERS', 'u1');
    setup('u1');
    callLLM.mockImplementation(async () => JSON.stringify(QUESTIONS));
    fireEvent.click(screen.getByText(/Series B/)); await screen.findByText(/Question 1\/5/);
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: ANSWER } });
    expect(screen.queryByRole('region', { name: /Structure Score/ })).toBeNull();
  });
});
