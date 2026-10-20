import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({ callLLM: vi.fn(), extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } } }));
vi.mock('../../lib/serverScoring', () => ({ serverScoringOn: () => false, evaluateAnswerOnServer: vi.fn(), saveInterviewOnServer: vi.fn() }));
import { callLLM } from '../../lib/ai.jsx';
import HiringManagerSim from './HiringManagerSim';

const QUESTIONS = { questions: [1, 2, 3, 4, 5].map(n => ({ question: `Interview question number ${n}, tell me more?`, focus: `Focus ${n}`, why: `Why ${n}` })) };
const resumeText = { type: 'text', content: 'Product manager at Acme. '.repeat(10), fileName: 'cv' };
const setup = (onFocusChange) => render(<HiringManagerSim resumeText={resumeText} form={{ role: '' }} memory={{}} updateMemory={vi.fn()} setAuthModal={vi.fn()} setActiveModule={vi.fn()} user={{ id: 'u1' }} onFocusChange={onFocusChange} />);

beforeEach(() => { sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); callLLM.mockImplementation(async () => JSON.stringify(QUESTIONS)); });
afterEach(cleanup);

describe('focus while practising', () => {
  it('is not asked for on the choose-an-interviewer screen', () => {
    const onFocusChange = vi.fn();
    setup(onFocusChange);
    expect(onFocusChange).not.toHaveBeenCalledWith(true);
  });
  it('starts when the questions appear, and ends when the person exits', async () => {
    const onFocusChange = vi.fn();
    setup(onFocusChange);
    fireEvent.click(screen.getByText(/Series B/)); await screen.findByText(/Question 1\/5/);
    expect(onFocusChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: /Exit/ }));
    expect(onFocusChange).toHaveBeenLastCalledWith(false);
  });
  it('ends when the screen is left', async () => {
    const onFocusChange = vi.fn();
    const { unmount } = setup(onFocusChange);
    fireEvent.click(screen.getByText(/Series B/)); await screen.findByText(/Question 1\/5/);
    unmount();
    expect(onFocusChange).toHaveBeenLastCalledWith(false);
  });
  it('works without anyone listening', async () => {
    setup(undefined);
    fireEvent.click(screen.getByText(/Series B/));
    expect(await screen.findByText(/Question 1\/5/)).toBeTruthy();
  });
});
