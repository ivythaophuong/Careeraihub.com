// Practice mode inside a mock interview: feedback is short with "more detail" on request, and an answer can be tried again.
// The score that counts (session average, saved history, trust score input) stays the FIRST attempt, so retrying cannot inflate it.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({
  callLLM: vi.fn(),
  extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } },
}));
vi.mock('../../lib/serverScoring', () => ({
  serverScoringOn: () => globalThis.__serverScoring === true, evaluateAnswerOnServer: vi.fn(), saveInterviewOnServer: vi.fn(),
}));
import { callLLM } from '../../lib/ai.jsx';
import { evaluateAnswerOnServer, saveInterviewOnServer } from '../../lib/serverScoring';
import HiringManagerSim from './HiringManagerSim';

const QUESTIONS = { questions: [1, 2, 3, 4, 5].map(n => ({ question: `Interview question number ${n}, tell me more?`, focus: `Focus ${n}`, why: `Why ${n}` })) };
const LONG = (score, extra = {}) => ({
  score, worked: 'Clear structure. You named your own part and the team around you.',
  missed: 'No measurable result. You describe the work but never say what changed. Add one number you can defend.',
  tip: 'Lead with the outcome. Then explain how you got there in two sentences.',
  betterAnswerOutline: ['Open with context', 'State the result'], ...extra,
});
const ANSWER = 'I led the migration of our checkout service and coordinated three teams to deliver it.';
const ANSWER_2 = 'I led the checkout migration across three teams and cut failed payments by a third in two months.';
const resumeText = { type: 'text', content: 'Product manager at Acme. '.repeat(10), fileName: 'cv' };

const ai = (evals) => {
  let i = 0;
  callLLM.mockImplementation(async (msgs) => {
    if (msgs[0].content.includes('Write 5 interview questions')) return JSON.stringify(QUESTIONS);
    return JSON.stringify(evals[Math.min(i++, evals.length - 1)]);
  });
};
const setup = (props = {}) => {
  const p = { resumeText, form: { role: '' }, memory: {}, updateMemory: vi.fn(), setAuthModal: vi.fn(), setActiveModule: vi.fn(), ...props };
  render(<HiringManagerSim {...p} />);
  return p;
};
const start = async () => { fireEvent.click(screen.getByText(/Series B/)); await screen.findByText(/Question 1\/5/); };
const answerWith = (text) => fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: text } });
const submit = async () => { fireEvent.click(screen.getByText(/Get AI Feedback/)); await screen.findByLabelText('Answer score'); };
const retry = () => fireEvent.click(screen.getByRole('button', { name: /try this answer again/i }));
const scoreShown = () => screen.getByLabelText('Answer score').textContent;

beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks(); delete globalThis.__serverScoring; vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(cleanup);

describe('feedback is short, with "more detail" on request', () => {
  it('shows the first sentence of each point and keeps the rest behind a button', async () => {
    ai([LONG(70)]); setup(); await start(); answerWith(ANSWER); await submit();
    expect(screen.getByText('No measurable result.')).toBeTruthy();
    expect(screen.queryByText(/never say what changed/)).toBeNull();
    const buttons = screen.getAllByRole('button', { name: /more detail/i });
    expect(buttons.length).toBe(3); // worked, missed, tip
    fireEvent.click(buttons[1]);
    expect(screen.getByText(/never say what changed/)).toBeTruthy();
  });

  it('a one-sentence point has no "more detail" button', async () => {
    ai([LONG(70, { worked: 'Clear structure.', missed: 'No measurable result.', tip: 'Lead with the outcome.' })]); setup(); await start(); answerWith(ANSWER); await submit();
    expect(screen.queryByRole('button', { name: /more detail/i })).toBeNull();
  });

  it('keeps the stronger structure hidden until asked, so the user tries first', async () => {
    ai([LONG(70)]); setup(); await start(); answerWith(ANSWER); await submit();
    expect(screen.queryByText('Open with context')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /show a stronger structure/i }));
    expect(screen.getByText(/Open with context/)).toBeTruthy();
  });
});

describe('trying an answer again', () => {
  it('brings the answer back into the box, editable, and asks for fresh feedback', async () => {
    ai([LONG(61), LONG(78)]); setup(); await start(); answerWith(ANSWER); await submit();
    expect(scoreShown()).toBe('61%');
    retry();
    expect(screen.getByLabelText('Your answer').value).toBe(ANSWER);
    answerWith(ANSWER_2);
    fireEvent.click(screen.getByText(/Get AI Feedback/));
    await waitFor(() => expect(scoreShown()).toBe('78%'));
    expect(screen.getByText(/practice attempt 2/i)).toBeTruthy();
    expect(callLLM.mock.calls.filter(c => !c[0][0].content.includes('Write 5 interview questions')).length).toBe(2);
  });

  it('keeps the same question on screen and offers no Skip while retrying (it would record the question twice)', async () => {
    ai([LONG(61)]); setup(); await start(); answerWith(ANSWER); await submit();
    retry();
    expect(screen.getByText(/Question 1\/5/)).toBeTruthy();
    expect(screen.queryByText(/Skip/)).toBeNull();
  });

  it('can go back to the feedback without submitting again', async () => {
    ai([LONG(61)]); setup(); await start(); answerWith(ANSWER); await submit();
    retry();
    fireEvent.click(screen.getByRole('button', { name: /back to feedback/i }));
    expect(scoreShown()).toBe('61%');
    expect(callLLM.mock.calls.filter(c => !c[0][0].content.includes('Write 5 interview questions')).length).toBe(1);
  });

  it('a retry that is too short is refused, like a first answer', async () => {
    ai([LONG(61)]); setup(); await start(); answerWith(ANSWER); await submit();
    retry(); answerWith('too short');
    fireEvent.click(screen.getByText(/Get AI Feedback/));
    expect(screen.getByRole('alert').textContent).toMatch(/at least/);
  });

  it('works more than once: attempt 3 is possible', async () => {
    ai([LONG(55), LONG(66), LONG(72)]); setup(); await start(); answerWith(ANSWER); await submit();
    retry(); answerWith(ANSWER_2); fireEvent.click(screen.getByText(/Get AI Feedback/)); await waitFor(() => expect(scoreShown()).toBe('66%'));
    retry(); answerWith(ANSWER_2 + ' I also trained the support team.'); fireEvent.click(screen.getByText(/Get AI Feedback/));
    await waitFor(() => expect(scoreShown()).toBe('72%'));
    expect(screen.getByText(/practice attempt 3/i)).toBeTruthy();
  });

  it('after a retry, moving on still goes to question 2', async () => {
    ai([LONG(61), LONG(78)]); setup(); await start(); answerWith(ANSWER); await submit();
    retry(); answerWith(ANSWER_2); fireEvent.click(screen.getByText(/Get AI Feedback/)); await waitFor(() => expect(scoreShown()).toBe('78%'));
    fireEvent.click(screen.getByText(/Next Question/));
    expect(screen.getByText(/Question 2\/5/)).toBeTruthy();
    expect(screen.getByLabelText('Your answer').value).toBe('');
  });
});

describe('the score that counts is the first attempt', () => {
  it('the saved session uses the first attempt, and the summary shows the retry next to it', async () => {
    ai([LONG(61), LONG(88)]);
    const p = setup(); await start(); answerWith(ANSWER); await submit();
    retry(); answerWith(ANSWER_2); fireEvent.click(screen.getByText(/Get AI Feedback/)); await waitFor(() => expect(scoreShown()).toBe('88%'));
    fireEvent.click(screen.getByText(/Finish & see results/));
    await screen.findByText(/Interview Results/);
    const [, row] = p.updateMemory.mock.calls[0];
    expect(row.data.avg_score).toBe(61);
    expect(screen.getByLabelText('Average score').textContent).toBe('61%');
    expect(screen.getByText(/latest practice attempt: 88% \(first attempt: 61%\)/i)).toBeTruthy();
    expect(screen.getByText(/only the first attempt counts/i)).toBeTruthy();
  });

  it('with server scoring, only the first attempt of each question is sent to be saved', async () => {
    globalThis.__serverScoring = true;
    evaluateAnswerOnServer
      .mockResolvedValueOnce({ feedback: { ...LONG(61), verdict: 'Okay' }, receipt: { ts: 1, sig: 'first' } })
      .mockResolvedValueOnce({ feedback: { ...LONG(88), verdict: 'Good' }, receipt: { ts: 2, sig: 'second' } });
    saveInterviewOnServer.mockResolvedValue({ avgScore: 61 });
    callLLM.mockImplementation(async () => JSON.stringify(QUESTIONS));
    setup(); await start(); answerWith(ANSWER); await submit();
    retry(); answerWith(ANSWER_2); fireEvent.click(screen.getByText(/Get AI Feedback/)); await waitFor(() => expect(scoreShown()).toBe('88%'));
    fireEvent.click(screen.getByText(/Finish & see results/));
    await screen.findByText(/Interview Results/);
    const items = saveInterviewOnServer.mock.calls[0][2];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ score: 61, sig: 'first' });
  });
});

describe('how a practice score is shown (it is not an official score)', () => {
  it('on a retry the official first score stays visible, the new score is labelled practice, and a higher score is not read as proof of skill', async () => {
    ai([LONG(61), LONG(78)]); setup(); await start(); answerWith(ANSWER); await submit();
    retry(); answerWith(ANSWER_2); fireEvent.click(screen.getByText(/Get AI Feedback/)); await waitFor(() => expect(scoreShown()).toBe('78%'));
    expect(screen.getByText(/practice score/i)).toBeTruthy();
    expect(screen.getByText(/first attempt \(the one that counts\): 61%/i)).toBeTruthy();
    expect(screen.getByText(/scored higher than your first/i)).toBeTruthy();
    expect(screen.getByText(/not proof/i)).toBeTruthy();
  });

  it('does not say it scored higher when it did not', async () => {
    ai([LONG(70), LONG(64)]); setup(); await start(); answerWith(ANSWER); await submit();
    retry(); answerWith(ANSWER_2); fireEvent.click(screen.getByText(/Get AI Feedback/)); await waitFor(() => expect(scoreShown()).toBe('64%'));
    expect(screen.queryByText(/scored higher/i)).toBeNull();
    expect(screen.queryByText(/improved/i)).toBeNull();
    expect(screen.getByText(/did not score higher than your first/i)).toBeTruthy();
  });

  it('the summary keeps the official average prominent and shows the practice attempt as secondary, saying it is not saved', async () => {
    ai([LONG(61), LONG(88)]); setup(); await start(); answerWith(ANSWER); await submit();
    retry(); answerWith(ANSWER_2); fireEvent.click(screen.getByText(/Get AI Feedback/)); await waitFor(() => expect(scoreShown()).toBe('88%'));
    fireEvent.click(screen.getByText(/Finish & see results/));
    await screen.findByText(/Interview Results/);
    expect(screen.getByLabelText('Average score').textContent).toBe('61%');
    expect(screen.getByText(/not saved/i)).toBeTruthy();
    expect(screen.getByText(/ai estimates/i)).toBeTruthy();
    expect(screen.getByText(/scored higher/i)).toBeTruthy();
  });

  it('an unscored first-attempt-only session shows no practice wording at all', async () => {
    ai([LONG(61)]); setup(); await start(); answerWith(ANSWER); await submit();
    fireEvent.click(screen.getByText(/Finish & see results/));
    await screen.findByText(/Interview Results/);
    // No retry wording. (The next-step card may say "practice" in its own words; what must not appear is the retry disclaimer.)
    expect(screen.queryByText(/practice attempt|practice score|only the first attempt|not counted/i)).toBeNull();
  });
});
