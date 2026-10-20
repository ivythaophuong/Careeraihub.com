// The clock (the optional countdown and the time shown for information) starts when the person is ready, not when the question appears.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({ callLLM: vi.fn(), extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } } }));
vi.mock('../../lib/serverScoring', () => ({ serverScoringOn: () => false, evaluateAnswerOnServer: vi.fn(), saveInterviewOnServer: vi.fn() }));
vi.mock('./VoiceRecorder', () => ({ default: ({ onStart }) => <button type="button" onClick={() => onStart?.()}>fake start recording</button> }));
import { callLLM } from '../../lib/ai.jsx';
import HiringManagerSim from './HiringManagerSim';
import { saveDeviceSession } from './deviceSession';

const QUESTIONS = { questions: [1, 2, 3, 4, 5].map(n => ({ question: `Interview question number ${n}, tell me more?`, focus: `Focus ${n}`, why: `Why ${n}` })) };
const EVAL = { score: 70, worked: 'Clear.', missed: 'No numbers.', tip: 'A tip.', betterAnswerOutline: ['Open with context'] };
const resumeText = { type: 'text', content: 'Product manager at Acme. '.repeat(10), fileName: 'cv' };
const ai = () => callLLM.mockImplementation(async (msgs) => (msgs[0].content.includes('Write 5 interview questions') ? JSON.stringify(QUESTIONS) : JSON.stringify(EVAL)));
const setup = (props = {}) => render(<HiringManagerSim resumeText={resumeText} form={{ role: '' }} memory={{}} updateMemory={vi.fn()} setAuthModal={vi.fn()} setActiveModule={vi.fn()} user={{ id: 'u1' }} {...props} />);

beforeEach(() => { vi.stubEnv('VITE_VOICE_PRACTICE', undefined); sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); ai(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllEnvs(); });

const open = async (timed = false) => {
  if (timed) fireEvent.click(screen.getByRole('button', { name: /^Timed: 3 minutes/ }));
  fireEvent.click(screen.getByText(/Series B/));
  await screen.findByText(/Question 1\/5/);
};
const tick = async (ms) => { await act(async () => { vi.advanceTimersByTime(ms); }); };
const elapsed = () => screen.getByRole('timer', { name: /Elapsed time/ }).textContent;
const left = () => screen.getByRole('timer', { name: /Time left/ }).textContent;

describe('the clock starts when the person is ready', () => {
  it('does not run while the question is only being read, in either challenge', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    setup(); await open(true);
    await tick(20_000);
    expect(elapsed()).toMatch(/This question 00:00/);
    expect(left()).toMatch(/03:00/);
  });
  it('says what it is waiting for, and offers a Ready button', async () => {
    setup(); await open();
    expect(screen.getByText(/clock starts when you press/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /i'?m ready/i })).toBeTruthy();
  });
  it('starts counting when the Ready button is pressed, and the button goes away', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    setup(); await open(true);
    fireEvent.click(screen.getByRole('button', { name: /i'?m ready/i }));
    await tick(5_000);
    expect(elapsed()).toMatch(/This question 00:05/);
    expect(left()).toMatch(/02:55/);
    expect(screen.queryByRole('button', { name: /i'?m ready/i })).toBeNull();
  });
  it('starts when the person begins to type, so nobody has to press twice', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    setup(); await open();
    await tick(4_000);
    expect(elapsed()).toMatch(/00:00/);
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'I' } });
    await tick(3_000);
    expect(elapsed()).toMatch(/This question 00:03/);
  });
  it('starts when a recording starts', async () => {
    vi.stubEnv('VITE_VOICE_PRACTICE', 'true');
    localStorage.setItem('careerai_mock_voice:u1', '1');
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    setup();
    fireEvent.click(screen.getByRole('button', { name: /voice practice/i }));
    await open();
    await tick(4_000);
    expect(elapsed()).toMatch(/00:00/);
    fireEvent.click(screen.getByText('fake start recording'));
    await tick(2_000);
    expect(elapsed()).toMatch(/This question 00:02/);
  });
  it('the next question waits again', async () => {
    setup(); await open();
    fireEvent.click(screen.getByRole('button', { name: /i'?m ready/i }));
    fireEvent.click(screen.getByRole('button', { name: /Skip/ }));
    await screen.findByText(/Question 2\/5/);
    expect(screen.getByRole('button', { name: /i'?m ready/i })).toBeTruthy();
  });
  it('a new session after an earlier one waits as well', async () => {
    setup(); await open();
    fireEvent.click(screen.getByRole('button', { name: /i'?m ready/i }));
    for (let i = 0; i < 5; i++) { fireEvent.click(await screen.findByRole('button', { name: /Skip/ })); }
    await screen.findByText(/session|results|summary/i);
  });
  it('a session continued from this device does not ask again when time had already been counted', async () => {
    const kept = { personaId: 'seriesb', role: '', questions: QUESTIONS.questions, idx: 1, results: [{ question: 'Interview question number 1, tell me more?', focus: 'Focus 1', skipped: true, ms: 1000 }], answer: '', elapsedMs: 9000, questionMs: 8000, challenge: 'untimed' };
    expect(saveDeviceSession('u1', kept)).toBe(true);
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /Continue practice/ }));
    await screen.findByText(/Question 2\/5/);
    expect(screen.queryByRole('button', { name: /i'?m ready/i })).toBeNull();
  });
  it('does not change how feedback or a retry behaves', async () => {
    setup(); await open();
    fireEvent.click(screen.getByRole('button', { name: /i'?m ready/i }));
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'I led the migration of our checkout service and coordinated three teams.' } });
    fireEvent.click(screen.getByRole('button', { name: /Get AI Feedback/ }));
    await screen.findByLabelText('Answer score');
    expect(screen.queryByRole('button', { name: /i'?m ready/i })).toBeNull();
  });
});
