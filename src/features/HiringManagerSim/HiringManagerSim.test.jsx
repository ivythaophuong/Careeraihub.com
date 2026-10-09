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
const EVAL = (score, extra = {}) => ({ score, worked: 'Clear structure.', missed: 'No measurable result.', tip: `Tip for ${score}`, betterAnswerOutline: ['Open with context', 'State the result'], ...extra });
const ANSWER = 'I led the migration of our checkout service and coordinated three teams to deliver it.';
const resumeText = { type: 'text', content: 'Product manager at Acme. '.repeat(10), fileName: 'cv' };

// Route by prompt: question generation vs evaluation, so tests stay order-independent.
const ai = (evals = [EVAL(70)]) => {
  let i = 0;
  callLLM.mockImplementation(async (msgs) => {
    const p = msgs[0].content;
    if (p.includes('Write 5 interview questions')) return JSON.stringify(QUESTIONS);
    const e = evals[Math.min(i++, evals.length - 1)];
    if (e instanceof Error) throw e;
    return JSON.stringify(e);
  });
};

const setup = (props = {}) => {
  const p = { resumeText, form: { role: '' }, memory: {}, updateMemory: vi.fn(), setAuthModal: vi.fn(), setActiveModule: vi.fn(), ...props };
  render(<HiringManagerSim {...p} />);
  return p;
};
const start = async (persona = /Series B/) => { fireEvent.click(screen.getByText(persona)); await screen.findByText(/Question 1\/5/); };
const answer = (text = ANSWER) => fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: text } });
const submit = () => fireEvent.click(screen.getByText(/Get AI Feedback/));

beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(cleanup);

describe('selecting and starting', () => {
  it('has no Preview banner, no hardcoded question, and lists all four personas', () => {
    setup();
    expect(screen.queryByText(/Preview/)).toBeNull();
    expect(screen.queryByText(/checkout migration/i)).toBeNull();
    for (const l of ['Seed Startup', 'Series B', 'Fortune 500', 'Tech Lead']) expect(screen.getByText(l)).toBeTruthy();
  });

  it('needs a role or a resume before starting, without calling the AI', () => {
    setup({ resumeText: null });
    fireEvent.click(screen.getByText(/Series B/));
    expect(screen.getByRole('alert').textContent).toMatch(/Enter the role/);
    expect(callLLM).not.toHaveBeenCalled();
  });

  it('can start from a role alone, with general questions', async () => {
    ai();
    setup({ resumeText: null });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'Data Analyst' } });
    await start();
    const prompt = callLLM.mock.calls[0][0][0].content;
    expect(prompt).toContain('for the role: Data Analyst');
    expect(prompt).toContain('No resume was provided.');
  });

  it('writes the questions from the resume and persona, and shows them one at a time', async () => {
    ai();
    setup();
    await start(/Tech Lead/);
    const prompt = callLLM.mock.calls[0][0][0].content;
    expect(prompt).toContain('Product manager at Acme.');
    expect(prompt).toContain('staff engineer or tech lead');
    expect(screen.getByText(/Interview question number 1/)).toBeTruthy();
    expect(screen.getByText(/Testing: Focus 1/)).toBeTruthy();
    expect(screen.getByText(/looking for: Why 1/)).toBeTruthy();
    expect(screen.queryByText(/Interview question number 2/)).toBeNull();
  });

  it('opens sign-up for guests (401) and stays on the picker', async () => {
    callLLM.mockRejectedValue(Object.assign(new Error('Please sign in'), { status: 401 }));
    const p = setup();
    fireEvent.click(screen.getByText(/Series B/));
    await waitFor(() => expect(p.setAuthModal).toHaveBeenCalledWith('register'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Create a free account/);
    expect(screen.queryByText(/Question 1\/5/)).toBeNull();
  });

  it('shows an error when the questions are unusable', async () => {
    callLLM.mockResolvedValue('not json');
    setup();
    fireEvent.click(screen.getByText(/Series B/));
    expect((await screen.findByRole('alert')).textContent).toMatch(/unreadable interview questions/);
  });
});

describe('answering', () => {
  it('rejects a too-short answer without calling the AI for feedback', async () => {
    ai(); setup(); await start();
    answer('idk');
    submit();
    expect(screen.getByRole('alert').textContent).toMatch(/at least 40 characters/);
    expect(callLLM).toHaveBeenCalledTimes(1); // only the question generation
  });

  it('sends the question and answer and shows the real feedback', async () => {
    ai([EVAL(72)]); setup(); await start();
    answer(); submit();
    await screen.findByLabelText('Answer score');
    expect(screen.getByLabelText('Answer score').textContent).toBe('72%');
    expect(screen.getByText('Acceptable')).toBeTruthy();
    expect(screen.getByText('Clear structure.')).toBeTruthy();
    expect(screen.getByText('No measurable result.')).toBeTruthy();
    expect(screen.getByText('Tip for 72')).toBeTruthy();
    expect(screen.getByText('• State the result')).toBeTruthy();
    const evalPrompt = callLLM.mock.calls[1][0][0].content;
    expect(evalPrompt).toContain('Interview question number 1');
    expect(evalPrompt).toContain(ANSWER);
  });

  it('keeps the typed answer and allows a retry when feedback fails', async () => {
    ai([new Error('Network error'), EVAL(65)]); setup(); await start();
    answer(); submit();
    expect((await screen.findByRole('alert')).textContent).toMatch(/Network error/);
    expect(screen.getByLabelText('Your answer').value).toBe(ANSWER);
    submit();
    await screen.findByLabelText('Answer score');
    expect(screen.getByLabelText('Answer score').textContent).toBe('65%');
  });

  it('warns about money figures in the suggestions that the candidate never mentioned', async () => {
    ai([EVAL(70, { tip: 'Say it saved $200k.' })]); setup(); await start();
    answer(); submit();
    const warn = await screen.findByText('⚠️ Check these numbers');
    expect(warn.parentElement.textContent).toContain('$200k');
  });

  it('opens sign-up on a 401 during feedback', async () => {
    ai([Object.assign(new Error('Please sign in'), { status: 401 })]);
    const p = setup(); await start();
    answer(); submit();
    await waitFor(() => expect(p.setAuthModal).toHaveBeenCalledWith('register'));
  });
});

describe('a full session', () => {
  const runAll = async (scores) => {
    for (let i = 0; i < 5; i++) {
      if (i > 0) await screen.findByText(new RegExp(`Question ${i + 1}/5`));
      answer(); submit();
      await screen.findByLabelText('Answer score');
      fireEvent.click(screen.getByText(i === 4 ? /See Results/ : /Next Question/));
    }
  };

  it('asks five different questions, then summarises and saves the session', async () => {
    ai([EVAL(80), EVAL(40), EVAL(60), EVAL(90), EVAL(55)]);
    const p = setup(); await start();
    await runAll();
    await screen.findByText(/Interview Results/);
    expect(screen.getByLabelText('Average score').textContent).toBe('65%'); // (80+40+60+90+55)/5
    expect(screen.getByText('Acceptable')).toBeTruthy();
    expect(screen.getByText(/5 answered/)).toBeTruthy();
    expect(screen.getByText(/Saved to your history/)).toBeTruthy();
    // practise-first tips come from the two lowest scores (40 and 55)
    expect(screen.getByText('1. Tip for 40')).toBeTruthy();
    expect(screen.getByText('2. Tip for 55')).toBeTruthy();

    expect(p.updateMemory).toHaveBeenCalledTimes(1);
    // The mock_sessions row feeds the server-side interview_score, so it must be written too.
    expect(p.updateMemory.mock.calls[0][1]).toEqual({
      table: 'mock_sessions',
      data: { avg_score: 65, questions_count: 5, mode: 'seriesb' },
    });
    const next = p.updateMemory.mock.calls[0][0]({ mockSessions: Array.from({ length: 25 }, (_, i) => ({ id: i })) });
    expect(next.mockSessions).toHaveLength(20);
    expect(next.mockSessions[0]).toMatchObject({ persona: 'seriesb', personaLabel: 'Series B', questionsCount: 5, avgScore: 65, skipped: 0 });
    expect(next.mockSessions[0].questions).toHaveLength(5);
    expect(next.mockSessions[1].id).toBe(0);
    expect(Object.keys(next)).toEqual(['mockSessions']);
  });

  it('skips a question without scoring it and excludes it from the average', async () => {
    ai([EVAL(80), EVAL(60)]);
    const p = setup(); await start();
    answer(); submit(); await screen.findByLabelText('Answer score'); fireEvent.click(screen.getByText(/Next Question/));
    await screen.findByText(/Question 2\/5/);
    fireEvent.click(screen.getByText(/Skip/));
    await screen.findByText(/Question 3\/5/);
    answer(); submit(); await screen.findByLabelText('Answer score');
    fireEvent.click(screen.getByText(/Finish & see results/));
    await screen.findByText(/Interview Results/);
    expect(screen.getByLabelText('Average score').textContent).toBe('70%'); // (80+60)/2, skip ignored
    expect(screen.getByText(/2 answered · 1 skipped/)).toBeTruthy();
    expect(screen.getByText('Skipped')).toBeTruthy();
    expect(p.updateMemory.mock.calls[0][0]({}).mockSessions[0]).toMatchObject({ questionsCount: 2, skipped: 1, avgScore: 70 });
  });

  it('saves nothing when every question is skipped', async () => {
    ai();
    const p = setup(); await start();
    for (let i = 1; i <= 5; i++) { await screen.findByText(new RegExp(`Question ${i}/5`)); fireEvent.click(screen.getByText(/Skip/)); }
    await screen.findByText(/nothing to score and nothing was saved/);
    expect(p.updateMemory).not.toHaveBeenCalled();
  });

  it('exiting mid-interview needs confirmation once something was answered, and saves nothing', async () => {
    ai(); const p = setup(); await start();
    answer(); submit(); await screen.findByLabelText('Answer score');
    fireEvent.click(screen.getByText('← Exit'));
    expect(screen.getByText('Exit without saving')).toBeTruthy();
    fireEvent.click(screen.getByText('Keep going'));
    expect(screen.queryByText('Exit without saving')).toBeNull();
    fireEvent.click(screen.getByText('← Exit'));
    fireEvent.click(screen.getByText('Exit without saving'));
    expect(screen.getByText('Hiring Manager Simulator')).toBeTruthy();
    expect(p.updateMemory).not.toHaveBeenCalled();
  });

  it('exits immediately when nothing has been answered yet', async () => {
    ai(); setup(); await start();
    fireEvent.click(screen.getByText('← Exit'));
    expect(screen.getByText('Hiring Manager Simulator')).toBeTruthy();
  });

  it('starts a fresh interview with the same persona from the summary', async () => {
    ai([EVAL(70)]); setup(); await start();
    answer(); submit(); await screen.findByLabelText('Answer score');
    fireEvent.click(screen.getByText(/Finish & see results/));
    await screen.findByText(/Interview Results/);
    fireEvent.click(screen.getByText(/New Interview, Same Persona/));
    await screen.findByText(/Question 1\/5/);
    expect(screen.getByText(/Series B/)).toBeTruthy();
  });
});

describe('recent sessions', () => {
  it('lists saved sessions, including legacy entries without details', () => {
    setup({ memory: { mockSessions: [
      { id: 1, personaLabel: 'Series B', role: 'PM', avgScore: 72, questionsCount: 5, date: '2026-01-02T00:00:00Z' },
      { id: 2, date: '2026-01-01T00:00:00Z' },
    ] } });
    expect(screen.getByText(/Recent Sessions/)).toBeTruthy();
    expect(screen.getByText('72%')).toBeTruthy();
    expect(screen.getByText('Series B · PM')).toBeTruthy();
    expect(screen.getByText('Mock interview')).toBeTruthy();
    expect(screen.getByText('–')).toBeTruthy();
  });
});

describe('server scoring (F-1): the browser never sends a score to be stored', () => {
  beforeEach(() => { globalThis.__serverScoring = true; });
  afterEach(() => { globalThis.__serverScoring = false; });

  const serverEval = (score, n) => ({ feedback: EVAL(score, { verdict: 'x' }), receipt: { ts: n, sig: `sig${n}` } });

  it('grades through the server, saves through the server and writes no mock_sessions row from the browser', async () => {
    callLLM.mockImplementation(async () => JSON.stringify(QUESTIONS));
    let n = 0;
    evaluateAnswerOnServer.mockImplementation(async () => serverEval([80, 60][n], ++n));
    saveInterviewOnServer.mockResolvedValue({ saved: true, avgScore: 70, questionsCount: 2 });
    const p = setup(); await start();
    answer(); submit(); await screen.findByLabelText('Answer score'); fireEvent.click(screen.getByText(/Next Question/));
    await screen.findByText(/Question 2\/5/);
    answer(); submit(); await screen.findByLabelText('Answer score');
    fireEvent.click(screen.getByText(/Finish & see results/));
    await screen.findByText(/Interview Results/);

    // only the question-writing call goes to the model directly; grading went to the server
    expect(callLLM).toHaveBeenCalledTimes(1);
    expect(saveInterviewOnServer).toHaveBeenCalledWith('seriesb', '', [
      expect.objectContaining({ score: 80, ts: 1, sig: 'sig1' }),
      expect.objectContaining({ score: 60, ts: 2, sig: 'sig2' }),
    ]);
    expect(p.updateMemory).toHaveBeenCalledTimes(1);
    expect(p.updateMemory.mock.calls[0][1]).toBeUndefined();
    expect(p.updateMemory.mock.calls[0][0]({}).mockSessions[0]).toMatchObject({ questionsCount: 2, avgScore: 70 });
    expect(screen.getByText(/Saved to your history/)).toBeTruthy();
  });

  it('says the session was not saved when the server refuses', async () => {
    callLLM.mockImplementation(async () => JSON.stringify(QUESTIONS));
    evaluateAnswerOnServer.mockResolvedValue(serverEval(75, 1));
    saveInterviewOnServer.mockRejectedValue(new Error('Daily limit of saved interview sessions reached.'));
    const p = setup(); await start();
    answer(); submit(); await screen.findByLabelText('Answer score');
    fireEvent.click(screen.getByText(/Finish & see results/));
    expect((await screen.findByText(/Not saved to your history/)).textContent).toMatch(/Daily limit/);
    expect(p.updateMemory).not.toHaveBeenCalled();
  });
});
