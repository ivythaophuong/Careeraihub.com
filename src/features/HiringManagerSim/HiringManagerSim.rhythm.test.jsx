// The rhythm figures on the interview screen (voice practice). The recorder is replaced by a stub that hands back a transcript and loudness levels.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({ callLLM: vi.fn(), extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } } }));
vi.mock('../../lib/serverScoring', () => ({ serverScoringOn: () => false, evaluateAnswerOnServer: vi.fn(), saveInterviewOnServer: vi.fn() }));
let handOver;
vi.mock('./VoiceRecorder', () => ({ default: ({ onTranscript }) => <button type="button" onClick={() => onTranscript(handOver.text, handOver.meta)}>fake record</button> }));
import { callLLM } from '../../lib/ai.jsx';
import HiringManagerSim from './HiringManagerSim';

const QUESTIONS = { questions: [1, 2, 3, 4, 5].map(n => ({ question: `Interview question number ${n}, tell me more?`, focus: `Focus ${n}`, why: `Why ${n}` })) };
const resumeText = { type: 'text', content: 'Product manager at Acme. '.repeat(10), fileName: 'cv' };
const setup = () => render(<HiringManagerSim resumeText={resumeText} form={{ role: '' }} memory={{}} updateMemory={vi.fn()} setAuthModal={vi.fn()} setActiveModule={vi.fn()} user={{ id: 'u1' }} />);
const run = (n, v) => new Array(n).fill(v);
const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

beforeEach(() => {
  vi.stubEnv('VITE_VOICE_PRACTICE', 'true');
  sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks();
  localStorage.setItem('careerai_mock_voice:u1', '1'); // voice already unlocked; the unlock rule has its own tests
  vi.spyOn(console, 'error').mockImplementation(() => {});
  callLLM.mockImplementation(async () => JSON.stringify(QUESTIONS));
  handOver = { text: words(20), meta: { durationSec: 8, stepMs: 100, levels: [...run(30, 0.3), ...run(20, 0.001), ...run(30, 0.3)] } };
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

const toQuestion = async () => { fireEvent.click(screen.getByRole('button', { name: /voice practice/i })); fireEvent.click(screen.getByText(/Series B/)); await screen.findByText(/Question 1\/5/); };

describe('rhythm figures', () => {
  it('shows speaking time, long pauses and pace while speaking, with where they come from and no judgement', async () => {
    setup(); await toQuestion();
    fireEvent.click(screen.getByText('fake record'));
    const note = await screen.findByTestId('rhythm');
    expect(note.textContent).toMatch(/Rhythm/);
    expect(note.textContent).toMatch(/6\.0 s of 8\.0 s \(75%\)/);
    expect(note.textContent).toMatch(/Pauses of 1 second or more: 1/);
    expect(note.textContent).toMatch(/longest 2\.0 s/);
    expect(note.textContent).toMatch(/200 WPM/);
    expect(note.textContent).toMatch(/Measured on your device from how loud your voice was/);
    expect(note.textContent).not.toMatch(/good|bad|pass|fail|fluent|too fast|too slow|score|\/100/i);
  });
  it('shows nothing when there are no levels (no Web Audio), and the speaking-rate note still shows', async () => {
    handOver.meta = { durationSec: 30, stepMs: 100, levels: [] };
    setup(); await toQuestion();
    fireEvent.click(screen.getByText('fake record'));
    await screen.findByTestId('speaking-rate');
    expect(screen.queryByTestId('rhythm')).toBeNull();
  });
  it('does not reach the grading prompt', async () => {
    setup(); await toQuestion();
    fireEvent.click(screen.getByText('fake record'));
    await screen.findByTestId('rhythm');
    expect(JSON.stringify(callLLM.mock.calls)).not.toMatch(/pause|rhythm|speaking time/i);
  });
  it('is cleared when the next question opens', async () => {
    setup(); await toQuestion();
    fireEvent.click(screen.getByText('fake record'));
    await screen.findByTestId('rhythm');
    fireEvent.click(screen.getByRole('button', { name: /Skip/ }));
    await screen.findByText(/Question 2\/5/);
    expect(screen.queryByTestId('rhythm')).toBeNull();
  });
});
