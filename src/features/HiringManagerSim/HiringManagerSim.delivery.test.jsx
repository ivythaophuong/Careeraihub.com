// Delivery coaching in the answer feedback: a spoken answer sends its rhythm figures (numbers only) and shows the AI's delivery text in its own section.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({ callLLM: vi.fn(), extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } } }));
const evaluateAnswerOnServer = vi.fn();
vi.mock('../../lib/serverScoring', () => ({ serverScoringOn: () => true, evaluateAnswerOnServer: (...a) => evaluateAnswerOnServer(...a), saveInterviewOnServer: vi.fn() }));
let handOver;
vi.mock('./VoiceRecorder', () => ({ default: ({ onTranscript }) => <button type="button" onClick={() => onTranscript(handOver.text, handOver.meta)}>fake record</button> }));
import { callLLM } from '../../lib/ai.jsx';
import HiringManagerSim from './HiringManagerSim';

const QUESTIONS = { questions: [1, 2, 3, 4, 5].map(n => ({ question: `Interview question number ${n}, tell me more?`, focus: `Focus ${n}`, why: `Why ${n}` })) };
const resumeText = { type: 'text', content: 'Product manager at Acme. '.repeat(10), fileName: 'cv' };
const setup = () => render(<HiringManagerSim resumeText={resumeText} form={{ role: '' }} memory={{}} updateMemory={vi.fn()} setAuthModal={vi.fn()} setActiveModule={vi.fn()} user={{ id: 'u1' }} />);
const run = (n, v) => new Array(n).fill(v);
const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
const FB = { score: 70, verdict: 'Acceptable', worked: 'Clear structure.', missed: 'No numbers.', tip: 'Quantify.', betterAnswerOutline: ['a', 'b', 'c'] };
const DELIVERY = 'You kept speaking for 22 s of 35.3 s. If you felt pressure, try reading the question twice first.';

beforeEach(() => {
  vi.stubEnv('VITE_VOICE_PRACTICE', 'true');
  sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks();
  localStorage.setItem('careerai_mock_voice:u1', '1');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  callLLM.mockImplementation(async () => JSON.stringify(QUESTIONS));
  evaluateAnswerOnServer.mockResolvedValue({ feedback: { ...FB, delivery: DELIVERY }, receipt: { ts: 1, sig: 'x' } });
  handOver = { text: words(30), meta: { durationSec: 8, stepMs: 100, levels: [...run(30, 0.3), ...run(20, 0.001), ...run(30, 0.3)] } };
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

const toQuestion = async (voice = true) => {
  if (voice) fireEvent.click(screen.getByRole('button', { name: /voice practice/i }));
  fireEvent.click(screen.getByText(/Series B/)); await screen.findByText(/Question 1\/5/);
};

describe('delivery coaching', () => {
  it('sends only the six rhythm figures with a spoken answer, and shows the delivery text in its own section', async () => {
    setup(); await toQuestion();
    fireEvent.click(screen.getByText('fake record'));
    await screen.findByTestId('rhythm');
    fireEvent.click(screen.getByRole('button', { name: /Get AI Feedback/ }));
    await screen.findByLabelText('Answer score');
    const sent = evaluateAnswerOnServer.mock.calls[0][0];
    expect(Object.keys(sent.delivery).sort()).toEqual(['longPauses', 'longestPauseSec', 'paceWhileSpeakingWpm', 'speechPercent', 'speechSec', 'totalSec']);
    expect(Object.values(sent.delivery).every(v => typeof v === 'number')).toBe(true);
    expect(sent.delivery.speechSec).toBe(6);
    const section = await screen.findByTestId('delivery-feedback');
    expect(section.textContent).toMatch(/How you delivered it/);
    expect(section.textContent).toContain(DELIVERY);
    expect(section.textContent).toMatch(/AI-generated from the figures in your Rhythm box/);
  });
  it('sends no figures for a typed answer, and shows no delivery section', async () => {
    evaluateAnswerOnServer.mockResolvedValue({ feedback: FB, receipt: { ts: 1, sig: 'x' } });
    setup(); await toQuestion(false);
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: words(30) } });
    fireEvent.click(screen.getByRole('button', { name: /Get AI Feedback/ }));
    await screen.findByLabelText('Answer score');
    expect(evaluateAnswerOnServer.mock.calls[0][0].delivery).toBeFalsy();
    expect(screen.queryByTestId('delivery-feedback')).toBeNull();
  });
  it('sends no figures when the recording was too short for rhythm', async () => {
    handOver.meta = { durationSec: 1, stepMs: 100, levels: run(5, 0.3) };
    setup(); await toQuestion();
    fireEvent.click(screen.getByText('fake record'));
    fireEvent.click(screen.getByRole('button', { name: /Get AI Feedback/ }));
    await screen.findByLabelText('Answer score');
    expect(evaluateAnswerOnServer.mock.calls[0][0].delivery).toBeFalsy();
  });
  it('shows no delivery section when the server returned none (checked text dropped), and the score is unchanged', async () => {
    evaluateAnswerOnServer.mockResolvedValue({ feedback: FB, receipt: { ts: 1, sig: 'x' } });
    setup(); await toQuestion();
    fireEvent.click(screen.getByText('fake record'));
    fireEvent.click(screen.getByRole('button', { name: /Get AI Feedback/ }));
    await screen.findByLabelText('Answer score');
    expect(screen.queryByTestId('delivery-feedback')).toBeNull();
    expect(screen.getByLabelText('Answer score').textContent).toBe('70%');
  });
});
