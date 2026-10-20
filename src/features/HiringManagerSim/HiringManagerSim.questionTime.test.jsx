import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({
  callLLM: vi.fn(),
  extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } },
}));
vi.mock('../../lib/serverScoring', () => ({ serverScoringOn: () => false, evaluateAnswerOnServer: vi.fn(), saveInterviewOnServer: vi.fn() }));
import { callLLM } from '../../lib/ai.jsx';
import HiringManagerSim from './HiringManagerSim';

const QUESTIONS = { questions: [1, 2, 3, 4, 5].map(n => ({ question: `Interview question number ${n}, tell me more?`, focus: `Focus ${n}`, why: `Why ${n}` })) };
const EVAL = { score: 70, worked: 'Clear structure.', missed: 'No measurable result.', tip: 'A tip.', betterAnswerOutline: ['Open with context'] };
const ANSWER = 'I led the migration of our checkout service and coordinated three teams to deliver it.';
const resumeText = { type: 'text', content: 'Product manager at Acme. '.repeat(10), fileName: 'cv' };
const ai = () => callLLM.mockImplementation(async (msgs) => (msgs[0].content.includes('Write 5 interview questions') ? JSON.stringify(QUESTIONS) : JSON.stringify(EVAL)));
const setup = () => render(<HiringManagerSim resumeText={resumeText} form={{ role: '' }} memory={{}} updateMemory={vi.fn()} setAuthModal={vi.fn()} setActiveModule={vi.fn()} user={{ id: 'u1' }} />);

beforeEach(() => { sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

// The clock starts when the person is ready, so these tests press "I'm ready" where they mean to start counting.
const ready = () => fireEvent.click(screen.getByRole('button', { name: /i'?m ready/i }));
const start = async () => { ai(); setup(); fireEvent.click(screen.getByText(/Series B/)); await screen.findByText(/Question 1\/5/); ready(); };
const tick = (s) => act(async () => { vi.advanceTimersByTime(s * 1000); });
const timerText = () => screen.getByRole('timer', { name: /Elapsed/ }).textContent;
const answerAndSubmit = async () => {
  fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: ANSWER } });
  fireEvent.click(screen.getByText(/Get AI Feedback/));
  await screen.findByLabelText('Answer score');
};

describe('where the timer is, and how visible', () => {
  it('shows the timer by default, in the question card, above the question text', async () => {
    await start();
    const card = screen.getByTestId('question-card');
    const timer = within(card).getByRole('timer', { name: /Elapsed/ });
    const question = within(card).getByText(/Interview question number 1/);
    expect(timer.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // the timer comes before the question text
    expect(within(card).getByRole('button', { name: 'Hide timer' })).toBeTruthy();
  });

  it('lets the person hide it, shows it again, and remembers the choice on this device', async () => {
    await start();
    const card = () => within(screen.getByTestId('question-card'));
    fireEvent.click(card().getByRole('button', { name: 'Hide timer' }));
    expect(screen.queryByRole('timer', { name: /Elapsed/ })).toBeNull();
    cleanup(); setup();
    fireEvent.click(screen.getByRole('button', { name: 'Continue practice' })); await screen.findByText(/Question 1\/5/);
    expect(screen.queryByRole('timer', { name: /Elapsed/ })).toBeNull();
    fireEvent.click(card().getByRole('button', { name: 'Show timer' }));
    expect(card().getByRole('timer', { name: /Elapsed/ })).toBeTruthy();
  });

  it('turns the time-left count-down gold for the last 30 seconds, as a quiet cue rather than an alarm', async () => {
    ai(); setup();
    fireEvent.click(screen.getByRole('button', { name: /^Timed: 3 minutes/ }));
    fireEvent.click(screen.getByText(/Series B/)); await screen.findByText(/Question 1\/5/);
    ready();
    const left = () => screen.getByRole('timer', { name: /Time left/ });
    expect(left().getAttribute('data-urgency')).toBe('calm');
    await tick(155);
    expect(left().getAttribute('data-urgency')).toBe('soon');
    await tick(30);
    expect(left().getAttribute('data-urgency')).toBe('over');
  });
});

describe('time is counted per question first, then for the session', () => {
  it('shows this question and the whole session, both starting at zero', async () => {
    await start();
    expect(timerText()).toMatch(/This question 00:00/);
    expect(timerText()).toMatch(/Whole session 00:00/);
  });

  it('stops counting this question once the answer is submitted', async () => {
    await start();
    await tick(5);
    await answerAndSubmit();
    const atSubmit = timerText();
    expect(atSubmit).toMatch(/This question 00:0[5-6]/);
    await tick(30);
    expect(timerText()).toBe(atSubmit);
  });

  it('starts the next question at zero and adds the finished question to the session total', async () => {
    await start();
    await tick(5);
    await answerAndSubmit();
    fireEvent.click(screen.getByText(/Next Question/));
    await screen.findByText(/Question 2\/5/);
    expect(timerText()).toMatch(/This question 00:00/);
    expect(timerText()).toMatch(/Whole session 00:0[5-6]/);
    ready();
    await tick(3);
    expect(timerText()).toMatch(/This question 00:03/);
    expect(timerText()).toMatch(/Whole session 00:0[8-9]/);
  });

  it('does not count a practice retry of an answer that was already submitted', async () => {
    await start();
    await tick(4);
    await answerAndSubmit();
    const before = timerText();
    fireEvent.click(screen.getByText(/Try this answer again/));
    await tick(20);
    expect(timerText()).toBe(before);
  });

  it('a skipped question keeps the time spent on it in the session total', async () => {
    await start();
    await tick(7);
    fireEvent.click(screen.getByText(/Skip/));
    await screen.findByText(/Question 2\/5/);
    expect(timerText()).toMatch(/Whole session 00:0[7-8]/);
  });

  it('the time never cuts an answer or changes a score', async () => {
    await start();
    await tick(200);
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: ANSWER } });
    expect(screen.getByLabelText('Your answer').disabled).toBe(false);
  });
});

describe('after coming back to a kept session', () => {
  it('continues from the time already spent on this question and on the session', async () => {
    await start();
    await tick(9);
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'draft' } });
    cleanup();
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Continue practice' }));
    await screen.findByText(/Question 1\/5/);
    expect(timerText()).toMatch(/This question 00:0[8-9]/);
    expect(timerText()).toMatch(/Whole session 00:0[8-9]/);
  });
});
