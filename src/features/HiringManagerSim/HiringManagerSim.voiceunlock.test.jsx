// Voice practice listed next to text practice in "Practice mode": locked until a timed round is done.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({ callLLM: vi.fn(), extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } } }));
vi.mock('../../lib/serverScoring', () => ({ serverScoringOn: () => false, evaluateAnswerOnServer: vi.fn(), saveInterviewOnServer: vi.fn() }));
vi.mock('./VoiceRecorder', () => ({ default: () => <div data-testid="recorder">recorder</div> }));
import { callLLM } from '../../lib/ai.jsx';
import HiringManagerSim from './HiringManagerSim';

const QUESTIONS = { questions: [1, 2, 3, 4, 5].map(n => ({ question: `Interview question number ${n}, tell me more?`, focus: `Focus ${n}`, why: `Why ${n}` })) };
const EVAL = { score: 70, worked: 'Clear structure.', missed: 'No measurable result.', tip: 'A tip.', betterAnswerOutline: ['Open with context'] };
const ANSWER = 'I led the migration of our checkout service and coordinated three teams to deliver it on time.';
const resumeText = { type: 'text', content: 'Product manager at Acme. '.repeat(10), fileName: 'cv' };
const setup = (user = { id: 'u1' }) => render(<HiringManagerSim resumeText={resumeText} form={{ role: '' }} memory={{}} updateMemory={vi.fn()} setAuthModal={vi.fn()} setActiveModule={vi.fn()} user={user} />);

beforeEach(() => {
  vi.stubEnv('VITE_VOICE_PRACTICE', undefined); // a developer's .env.local must not change what these tests check
  sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  callLLM.mockImplementation(async (msgs) => (msgs[0].content.includes('Write 5 interview questions') ? JSON.stringify(QUESTIONS) : JSON.stringify(EVAL)));
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

const voiceBtn = () => screen.getByRole('button', { name: /voice practice/i });

describe('Practice mode list', () => {
  it('lists Text practice and Voice practice together, text selected', () => {
    vi.stubEnv('VITE_VOICE_PRACTICE', 'true'); setup();
    expect(screen.getByRole('button', { name: /text practice/i }).getAttribute('aria-pressed')).toBe('true');
    expect(voiceBtn().getAttribute('aria-pressed')).toBe('false');
  });
  it('is locked at first, says how to unlock it, and offers no recorder', async () => {
    vi.stubEnv('VITE_VOICE_PRACTICE', 'true'); setup();
    expect(voiceBtn().getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText(/unlocks after you finish one timed round and answer at least 4 of 5 questions/i)).toBeTruthy();
    fireEvent.click(voiceBtn());
    fireEvent.click(screen.getByText(/Series B/)); await screen.findByText(/Question 1\/5/);
    expect(screen.queryByTestId('recorder')).toBeNull();
  });
  it('for a user who may not use voice at all it stays the old "not available yet" button', () => {
    setup(); // no flag, not on the preview list
    expect(screen.getByText(/Voice practice is not available yet/)).toBeTruthy();
    expect(screen.queryByText(/unlocks after/i)).toBeNull();
  });
});

describe('unlocking', () => {
  it('a timed round with 4 of 5 answered unlocks voice; the recorder shows only in voice mode', async () => {
    vi.stubEnv('VITE_VOICE_PRACTICE', 'true'); setup();
    fireEvent.click(screen.getByRole('button', { name: /^Timed: 3 minutes/ }));
    fireEvent.click(screen.getByText(/Series B/)); await screen.findByText(/Question 1\/5/);
    for (let i = 0; i < 4; i++) {
      fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: ANSWER } });
      fireEvent.click(screen.getByRole('button', { name: /Get AI Feedback/ }));
      await screen.findByLabelText('Answer score');
      fireEvent.click(await screen.findByRole('button', { name: /Next question|See my results/i }));
      await waitFor(() => expect(screen.queryByLabelText('Answer score')).toBeNull());
    }
    // the fifth question: skip it, then the round finishes with 4 answered
    fireEvent.click(await screen.findByRole('button', { name: /Skip/ }));
    await screen.findByText(/session|summary|results/i);
    expect(localStorage.getItem('careerai_mock_voice:u1')).toBeTruthy();
  }, 30000);
  it('3 of 5 answered, or an untimed round, leaves it locked', async () => {
    vi.stubEnv('VITE_VOICE_PRACTICE', 'true'); setup();
    fireEvent.click(screen.getByText(/Series B/)); await screen.findByText(/Question 1\/5/);
    for (let i = 0; i < 5; i++) fireEvent.click(await screen.findByRole('button', { name: /Skip/ }));
    expect(localStorage.getItem('careerai_mock_voice:u1')).toBeNull();
  });
  it('once unlocked, choosing Voice practice shows the recorder under the answer box and Text practice hides it', async () => {
    vi.stubEnv('VITE_VOICE_PRACTICE', 'true');
    localStorage.setItem('careerai_mock_voice:u1', '1');
    setup();
    expect(voiceBtn().getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.click(voiceBtn());
    expect(voiceBtn().getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByText(/Series B/)); await screen.findByText(/Question 1\/5/);
    expect(screen.getByTestId('recorder')).toBeTruthy();
  });
  it('unlocked but still on Text practice: no recorder', async () => {
    vi.stubEnv('VITE_VOICE_PRACTICE', 'true');
    localStorage.setItem('careerai_mock_voice:u1', '1');
    setup();
    fireEvent.click(screen.getByText(/Series B/)); await screen.findByText(/Question 1\/5/);
    expect(screen.queryByTestId('recorder')).toBeNull();
  });
  it('a preview account can unlock it for testing, and it is said to be for testing', async () => {
    setup({ id: '669f63cb-02f8-4eb9-9cd1-2f6015f6a4fd' });
    fireEvent.click(screen.getByRole('button', { name: /unlock for testing/i }));
    expect(voiceBtn().getAttribute('aria-disabled')).not.toBe('true');
    expect(localStorage.getItem('careerai_mock_voice:669f63cb-02f8-4eb9-9cd1-2f6015f6a4fd')).toBeTruthy();
  });
  it('another account never sees the testing shortcut', () => {
    vi.stubEnv('VITE_VOICE_PRACTICE', 'true'); setup();
    expect(screen.queryByRole('button', { name: /unlock for testing/i })).toBeNull();
  });
});
