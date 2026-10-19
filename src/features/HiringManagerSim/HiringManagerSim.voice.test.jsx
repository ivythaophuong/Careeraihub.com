import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({
  callLLM: vi.fn(),
  extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } },
}));
vi.mock('../../lib/serverScoring', () => ({ serverScoringOn: () => false, evaluateAnswerOnServer: vi.fn(), saveInterviewOnServer: vi.fn() }));
const SEVENTY_FIVE = Array.from({ length: 75 }, (_, i) => `word${i}`).join(' ');
let transcript = 'I led the migration of our checkout service.';
vi.mock('../../lib/voice.js', async (orig) => ({ ...(await orig()), transcribeAudio: vi.fn(async () => transcript) }));
import { callLLM } from '../../lib/ai.jsx';
import HiringManagerSim from './HiringManagerSim';

const QUESTIONS = { questions: [1, 2, 3, 4, 5].map(n => ({ question: `Interview question number ${n}, tell me more?`, focus: `Focus ${n}`, why: `Why ${n}` })) };
const resumeText = { type: 'text', content: 'Product manager at Acme. '.repeat(10), fileName: 'cv' };
const setup = () => render(<HiringManagerSim resumeText={resumeText} form={{ role: '' }} memory={{}} updateMemory={vi.fn()} setAuthModal={vi.fn()} setActiveModule={vi.fn()} user={{ id: 'u1' }} />);

class FakeRecorder {
  static isTypeSupported() { return true; }
  constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm'; }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array([1])]) }); this.onstop?.(); }
}

beforeEach(() => {
  transcript = 'I led the migration of our checkout service.';
  sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  callLLM.mockImplementation(async () => JSON.stringify(QUESTIONS));
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop() {} }] })) }, configurable: true });
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const toQuestion = async () => { fireEvent.click(screen.getByText(/Series B/)); await screen.findByText(/Question 1\/5/); };

describe('voice practice flag', () => {
  it('is off by default: no recorder, and the screen still says voice is not available', async () => {
    setup();
    expect(screen.getByText(/Voice practice is not available yet/)).toBeTruthy();
    await toQuestion();
    expect(screen.queryByRole('button', { name: /record your answer/i })).toBeNull();
  });

  it('with the flag on the practice-mode note changes and a recorder sits under the answer box', async () => {
    vi.stubEnv('VITE_VOICE_PRACTICE', 'true');
    setup();
    expect(screen.queryByText(/Voice practice is not available yet/)).toBeNull();
    expect(screen.getByText(/Voice practice \(preview\)/)).toBeTruthy();
    await toQuestion();
    expect(screen.getByRole('button', { name: /record your answer/i })).toBeTruthy();
  });

  it('puts the transcript into the answer box, after what is already typed, so it can be corrected before feedback', async () => {
    vi.stubEnv('VITE_VOICE_PRACTICE', 'true');
    setup(); await toQuestion();
    const box = screen.getByLabelText('Your answer');
    fireEvent.change(box, { target: { value: 'Context first.' } });
    fireEvent.click(screen.getByRole('button', { name: /record your answer/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /stop recording/i }));
    await waitFor(() => expect(box.value).toBe('Context first. I led the migration of our checkout service.'));
    expect(callLLM).toHaveBeenCalledTimes(1); // only the question call: nothing is graded until the user asks
  });
});

describe('estimated speaking rate (user story D1)', () => {
  const record = async (seconds) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(0);
    fireEvent.click(screen.getByRole('button', { name: /record your answer/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    const stopBtn = await screen.findByRole('button', { name: /stop recording/i });
    vi.setSystemTime(seconds * 1000);
    fireEvent.click(stopBtn);
  };
  afterEach(() => { vi.useRealTimers(); });

  it('shows words x 60 / seconds with the estimate wording and no judgement', async () => {
    vi.stubEnv('VITE_VOICE_PRACTICE', 'true');
    transcript = SEVENTY_FIVE;
    setup(); await toQuestion();
    await record(30);
    const note = await screen.findByTestId('speaking-rate');
    expect(note.textContent).toMatch(/Estimated Speaking Rate/);
    expect(note.textContent).toMatch(/150 WPM/);
    expect(note.textContent).toMatch(/Estimated from your transcript and total recording duration\. Transcription errors and pauses may affect this result\./);
    expect(note.textContent).not.toMatch(/good|bad|pass|fail|fluent|too fast|too slow|score|\/100/i);
  });

  it('is computed from the recording, not from the text after the user edits it', async () => {
    vi.stubEnv('VITE_VOICE_PRACTICE', 'true');
    transcript = SEVENTY_FIVE;
    setup(); await toQuestion();
    await record(30);
    await screen.findByTestId('speaking-rate');
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'short' } });
    expect(screen.getByTestId('speaking-rate').textContent).toMatch(/150 WPM/);
  });

  it('shows no number when the recording length is zero, and the practice goes on', async () => {
    vi.stubEnv('VITE_VOICE_PRACTICE', 'true');
    transcript = SEVENTY_FIVE;
    setup(); await toQuestion();
    await record(0);
    await waitFor(() => expect(screen.getByLabelText('Your answer').value).toContain('word0'));
    expect(screen.queryByTestId('speaking-rate')).toBeNull();
    expect(screen.getByRole('button', { name: /Get AI Feedback/ })).toBeTruthy();
  });

  it('is cleared when the next question opens', async () => {
    vi.stubEnv('VITE_VOICE_PRACTICE', 'true');
    transcript = SEVENTY_FIVE;
    setup(); await toQuestion();
    await record(30);
    await screen.findByTestId('speaking-rate');
    vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: /Skip/ }));
    await screen.findByText(/Question 2\/5/);
    expect(screen.queryByTestId('speaking-rate')).toBeNull();
  });

  it('is never shown with the flag off, and never reaches the grading prompt or the saved results', async () => {
    setup(); await toQuestion();
    expect(screen.queryByTestId('speaking-rate')).toBeNull();
    const sent = JSON.stringify(callLLM.mock.calls);
    expect(sent).not.toMatch(/wpm|speaking rate/i);
  });
});

