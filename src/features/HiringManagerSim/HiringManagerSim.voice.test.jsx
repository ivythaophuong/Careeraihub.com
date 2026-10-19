import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({
  callLLM: vi.fn(),
  extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } },
}));
vi.mock('../../lib/serverScoring', () => ({ serverScoringOn: () => false, evaluateAnswerOnServer: vi.fn(), saveInterviewOnServer: vi.fn() }));
vi.mock('../../lib/voice.js', async (orig) => ({ ...(await orig()), transcribeAudio: vi.fn(async () => 'I led the migration of our checkout service.') }));
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
