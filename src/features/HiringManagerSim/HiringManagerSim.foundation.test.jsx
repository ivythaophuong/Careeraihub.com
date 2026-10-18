import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';

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
const EVAL = (score) => ({ score, worked: 'Clear structure.', missed: 'No measurable result.', tip: `Tip for ${score}`, betterAnswerOutline: ['Open with context', 'State the result'] });
const ANSWER = 'I led the migration of our checkout service and coordinated three teams to deliver it.';
const resumeText = { type: 'text', content: 'Product manager at Acme. '.repeat(10), fileName: 'cv' };

const ai = (evals = [EVAL(70)]) => {
  let i = 0;
  callLLM.mockImplementation(async (msgs) => {
    if (msgs[0].content.includes('Write 5 interview questions')) return JSON.stringify(QUESTIONS);
    const e = evals[Math.min(i++, evals.length - 1)];
    if (e instanceof Error) throw e;
    return JSON.stringify(e);
  });
};
const props = (over = {}) => ({ resumeText, form: { role: '' }, memory: {}, updateMemory: vi.fn(), setAuthModal: vi.fn(), setActiveModule: vi.fn(), user: { id: 'u1' }, ...over });
const setup = (over) => render(<HiringManagerSim {...props(over)} />);
const start = async () => { fireEvent.click(screen.getByText(/Series B/)); await screen.findByText(/Question 1\/5/); };
const typeAnswer = (text = ANSWER) => fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: text } });
const submit = () => fireEvent.click(screen.getByText(/Get AI Feedback/));

beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks(); delete globalThis.__serverScoring; vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(cleanup);

describe('practice mode', () => {
  it('offers text practice and a voice option that is disabled and says why', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Text practice' }).getAttribute('aria-pressed')).toBe('true');
    const voice = screen.getByRole('button', { name: 'Voice practice' });
    expect(voice.disabled).toBe(true);
    expect(screen.getByText(/Voice practice is not available yet/).textContent).toMatch(/no microphone is used and nothing is recorded/);
    fireEvent.click(voice);
    expect(callLLM).not.toHaveBeenCalled();
  });
});

describe('the active interview', () => {
  it('shows the timer by default, lets the person hide it, and the timer only informs', async () => {
    ai(); setup(); await start();
    expect(screen.getByRole('timer').textContent).toMatch(/This question 00:0\d/);
    fireEvent.click(screen.getByRole('button', { name: 'Hide timer' }));
    expect(screen.queryByRole('timer')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show timer' }));
    expect(screen.getByRole('timer')).toBeTruthy();
  });

  it('shows progress from the real question list, with no invented figures', async () => {
    ai(); setup(); await start();
    const panel = screen.getByRole('complementary', { name: 'Session progress' });
    expect(within(panel).getAllByRole('listitem')).toHaveLength(5);
    expect(within(panel).getByText(/0 answered/)).toBeTruthy();
    expect(within(panel).getByText('Focus 1')).toBeTruthy();
    expect(panel.textContent).toMatch(/no time limit/i);
    expect(panel.textContent).not.toMatch(/token|budget|minutes left/i);
  });

  it('calls a typed draft "kept on this device", not saved, and stores it only in this tab', async () => {
    ai(); setup(); await start();
    expect(screen.queryByText(/Draft kept on this device/)).toBeNull();
    typeAnswer('My draft answer');
    expect(screen.getByText(/Draft kept on this device\. It is not saved to your account/)).toBeTruthy();
    expect(screen.queryByText(/^Saved/)).toBeNull();
    expect(JSON.parse(sessionStorage.getItem('careerai_mock_session:u1')).answer).toBe('My draft answer');
    expect(localStorage.getItem('careerai_mock_session:u1')).toBeNull();
  });

  it('does not claim a draft is kept when the browser refuses to store it', async () => {
    ai(); setup(); await start();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    typeAnswer('Another draft');
    expect(screen.queryByText(/Draft kept on this device/)).toBeNull();
    spy.mockRestore();
  });

  it('asks before the tab is closed once there is work, and not before', async () => {
    ai(); setup(); await start();
    const quiet = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(quiet);
    expect(quiet.defaultPrevented).toBe(false);
    typeAnswer('Some work in progress');
    const warn = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(warn);
    expect(warn.defaultPrevented).toBe(true);
  });
});

describe('continuing on this device', () => {
  it('offers to continue after leaving and returning, restoring the question and the typed answer', async () => {
    ai(); const first = setup(); await start();
    typeAnswer('Half-written answer');
    first.unmount();
    setup();
    expect(screen.getByText('Continue your practice')).toBeTruthy();
    expect(screen.getByText(/kept on this device only, not in your account/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue practice' }));
    expect(screen.getByText(/Question 1\/5/)).toBeTruthy();
    expect(screen.getByLabelText('Your answer').value).toBe('Half-written answer');
    expect(callLLM).toHaveBeenCalledTimes(1); // the questions were not generated again
  });

  it('brings back feedback already received, without asking the AI again', async () => {
    ai([EVAL(72)]); const first = setup(); await start();
    typeAnswer(); submit(); await screen.findByLabelText('Answer score');
    const calls = callLLM.mock.calls.length;
    first.unmount();
    setup(); fireEvent.click(screen.getByRole('button', { name: 'Continue practice' }));
    expect(screen.getByLabelText('Answer score').textContent).toBe('72%');
    expect(callLLM.mock.calls.length).toBe(calls);
  });

  it('is not offered to another user, and can be discarded', async () => {
    ai(); const first = setup(); await start(); typeAnswer('x'.repeat(5));
    first.unmount();
    setup({ user: { id: 'u2' } });
    expect(screen.queryByText('Continue your practice')).toBeNull();
    cleanup();
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Discard it' }));
    expect(screen.queryByText('Continue your practice')).toBeNull();
    expect(sessionStorage.getItem('careerai_mock_session:u1')).toBeNull();
  });

  it('is removed when the user exits, and after a finished and saved session', async () => {
    ai(); setup(); await start(); typeAnswer('abc');
    fireEvent.click(screen.getByText(/← Exit/));
    expect(sessionStorage.getItem('careerai_mock_session:u1')).toBeNull();
    await start();
    typeAnswer(); submit(); await screen.findByLabelText('Answer score');
    expect(sessionStorage.getItem('careerai_mock_session:u1')).not.toBeNull();
    fireEvent.click(screen.getByText(/Finish & see results/));
    await screen.findByText(/Interview Results/);
    expect(sessionStorage.getItem('careerai_mock_session:u1')).toBeNull();
  });

  it('keeps the copy when saving the finished session failed, so it can be finished again', async () => {
    globalThis.__serverScoring = true;
    callLLM.mockResolvedValue(JSON.stringify(QUESTIONS));
    evaluateAnswerOnServer.mockResolvedValue({ feedback: { ...EVAL(70) }, receipt: { ts: Date.now(), sig: 'sig' } });
    saveInterviewOnServer.mockRejectedValue(new Error('The session could not be saved. Please try again.'));
    setup(); await start(); typeAnswer(); submit(); await screen.findByLabelText('Answer score');
    fireEvent.click(screen.getByText(/Finish & see results/));
    await screen.findByText(/Not saved to your history/);
    expect(sessionStorage.getItem('careerai_mock_session:u1')).not.toBeNull();
  });
});

describe('when the feedback request fails', () => {
  it('says the outcome is unknown after a timeout or network error, keeps the answer, and offers no blind promise', async () => {
    ai([new Error('The request timed out.'), EVAL(66)]); setup(); await start();
    typeAnswer(); submit();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/could not confirm whether this answer was evaluated/);
    expect(alert.textContent).toMatch(/new AI request/);
    expect(screen.getByLabelText('Your answer').value).toBe(ANSWER);
    submit(); // the user chooses to retry
    await screen.findByLabelText('Answer score');
  });

  it('says "not evaluated" when the server answered with an error', async () => {
    ai([Object.assign(new Error('The AI could not evaluate the answer. Please try again.'), { status: 502 })]); setup(); await start();
    typeAnswer(); submit();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/It was not evaluated/);
    expect(alert.textContent).not.toMatch(/could not confirm/);
    expect(screen.getByLabelText('Your answer').value).toBe(ANSWER);
  });

  it('does not allow a second request while one is running', async () => {
    let release; callLLM.mockImplementation((msgs) => msgs[0].content.includes('Write 5 interview questions')
      ? Promise.resolve(JSON.stringify(QUESTIONS)) : new Promise(r => { release = () => r(JSON.stringify(EVAL(70))); }));
    setup(); await start(); typeAnswer(); submit();
    await waitFor(() => expect(screen.getByLabelText('Your answer').disabled).toBe(true));
    expect(screen.getByText(/Sending your answer for evaluation\. It is not saved to your account yet/)).toBeTruthy();
    const busyBtn = screen.getByText(/Evaluating…/); fireEvent.click(busyBtn); fireEvent.click(busyBtn);
    expect(callLLM).toHaveBeenCalledTimes(2); // questions + one evaluation
    release(); await screen.findByLabelText('Answer score');
  });
});

describe('the results screen', () => {
  it('labels the average as an AI estimate, not verified evidence', async () => {
    ai(); setup(); await start(); typeAnswer(); submit(); await screen.findByLabelText('Answer score');
    fireEvent.click(screen.getByText(/Finish & see results/));
    expect(await screen.findByText(/An AI estimate from this interview, not verified evidence/)).toBeTruthy();
  });
});
