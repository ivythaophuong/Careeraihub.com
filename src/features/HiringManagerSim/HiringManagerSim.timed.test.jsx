import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({
  callLLM: vi.fn(),
  extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } },
}));
vi.mock('../../lib/serverScoring', () => ({
  serverScoringOn: () => false, evaluateAnswerOnServer: vi.fn(), saveInterviewOnServer: vi.fn(),
}));
import { callLLM } from '../../lib/ai.jsx';
import HiringManagerSim from './HiringManagerSim';

const QUESTIONS = { questions: [1, 2, 3, 4, 5].map(n => ({ question: `Interview question number ${n}, tell me more?`, focus: `Focus ${n}`, why: `Why ${n}` })) };
const EVAL = { score: 70, worked: 'Clear structure.', missed: 'No measurable result.', tip: 'A tip.', betterAnswerOutline: ['Open with context'] };
const ANSWER = 'I led the migration of our checkout service and coordinated three teams to deliver it.';
const resumeText = { type: 'text', content: 'Product manager at Acme. '.repeat(10), fileName: 'cv' };
const ai = () => callLLM.mockImplementation(async (msgs) => (msgs[0].content.includes('Write 5 interview questions') ? JSON.stringify(QUESTIONS) : JSON.stringify(EVAL)));
const setup = () => render(<HiringManagerSim resumeText={resumeText} form={{ role: '' }} memory={{}} updateMemory={vi.fn()} setAuthModal={vi.fn()} setActiveModule={vi.fn()} user={{ id: 'u1' }} />);

beforeEach(() => { sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const startWith = async (challengeName) => {
  if (challengeName) fireEvent.click(screen.getByRole('button', { name: challengeName }));
  fireEvent.click(screen.getByText(/Series B/));
  await screen.findByText(/Question 1\/5/);
};

describe('choosing a challenge', () => {
  it('starts untimed by default and offers an optional timed challenge', () => {
    ai(); setup();
    expect(screen.getByRole('button', { name: /^Untimed/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /^Timed: 3 minutes/ }).getAttribute('aria-pressed')).toBe('false');
  });

  it('shows no countdown in the untimed challenge', async () => {
    ai(); setup(); await startWith();
    expect(screen.queryByText(/Time left/)).toBeNull();
  });
});

describe('the timed challenge', () => {
  it('counts down from 3:00, and the answer box stays usable when time is up', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    ai(); setup(); await startWith('Timed: 3 minutes per question');
    expect(screen.getByRole('timer', { name: /Time left/ }).textContent).toMatch(/03:00|02:59/);
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: ANSWER } });
    await act(async () => { vi.advanceTimersByTime(181_000); });
    expect(screen.getByRole('status').textContent).toMatch(/Time is up/);
    expect(screen.getByRole('status').textContent).toMatch(/answer is kept/i);
    expect(screen.getByRole('status').textContent).toMatch(/does not change your score/i);
    const box = screen.getByLabelText('Your answer');
    expect(box.disabled).toBe(false);
    expect(box.value).toBe(ANSWER);
    vi.useRealTimers();
    fireEvent.click(screen.getByText(/Get AI Feedback/));
    await screen.findByLabelText('Answer score');
  });

  it('says on the side panel that the limit is soft', async () => {
    ai(); setup(); await startWith('Timed: 3 minutes per question');
    expect(screen.getByRole('complementary', { name: 'Session progress' }).textContent).toMatch(/3 minutes.*never cuts/i);
  });
});

describe('after a finished round', () => {
  const finishRound = async () => {
    for (let i = 0; i < 5; i++) {
      fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: ANSWER } });
      fireEvent.click(screen.getByText(/Get AI Feedback/));
      await screen.findByLabelText('Answer score');
      fireEvent.click(screen.getByText(i === 4 ? /See Results/ : /Next Question/));
      if (i < 4) await screen.findByText(new RegExp(`Question ${i + 2}/5`));
    }
    await screen.findByText(/Interview Results/);
  };

  it('offers one next step with a reason and the four ways forward, after an untimed round', async () => {
    ai(); setup(); await startWith(); await finishRound();
    expect(screen.getByText('Next challenge')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Try the timed challenge/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Review my feedback first' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue at my own pace' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Preview next step' }));
    expect(screen.getByText(/not available yet/i)).toBeTruthy();
  });

  it('starts a timed round from the suggestion', async () => {
    ai(); setup(); await startWith(); await finishRound();
    fireEvent.click(screen.getByRole('button', { name: /Try the timed challenge/ }));
    await waitFor(() => expect(screen.getByRole('timer', { name: /Time left/ })).toBeTruthy());
  });

  it('remembers on this device that a timed round was finished, so the suggestion changes', async () => {
    ai(); setup(); await startWith('Timed: 3 minutes per question'); await finishRound();
    expect(screen.getByRole('button', { name: /Another timed round/ })).toBeTruthy();
    expect(localStorage.getItem('careerai_mock_timed:u1')).toBeTruthy();
  });
});
