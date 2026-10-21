// The practice screen: tabs, the action bar that drives the recorder, the transcript box and the speaking insights.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, within, waitFor, act } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({ calls: { start: 0, stop: 0 }, stage: null, transcript: null, props: null }));
vi.mock('../../lib/ai.jsx', () => ({ callLLM: vi.fn(), extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } } }));
vi.mock('../../lib/serverScoring', () => ({ serverScoringOn: () => false, evaluateAnswerOnServer: vi.fn(), saveInterviewOnServer: vi.fn() }));
vi.mock('./VoiceRecorder', async () => {
  const R = await import('react');
  return { default: R.forwardRef(function Fake(props, ref) {
    const { onStage, onTranscript } = props;
    hoisted.stage = onStage; hoisted.transcript = onTranscript; hoisted.props = props;
    R.useImperativeHandle(ref, () => ({ start: () => { hoisted.calls.start++; onStage('recording'); }, stop: () => { hoisted.calls.stop++; onStage('transcribing'); } }), [onStage]);
    return <div data-testid="recorder" />;
  }) };
});
import { callLLM } from '../../lib/ai.jsx';
import HiringManagerSim from './HiringManagerSim';

const QUESTIONS = { questions: [1, 2, 3, 4, 5].map(n => ({ question: `Interview question number ${n}, tell me more?`, focus: `Focus ${n}`, why: `Why ${n}` })) };
const EVAL = { score: 70, worked: 'Clear.', missed: 'No numbers.', tip: 'A tip.', betterAnswerOutline: ['Open with context'] };
const ANSWER = 'I led the migration of our checkout service and coordinated three teams to deliver it.';
const resumeText = { type: 'text', content: 'Product manager at Acme. '.repeat(10), fileName: 'cv' };
const setup = () => render(<HiringManagerSim resumeText={resumeText} form={{ role: '' }} memory={{}} updateMemory={vi.fn()} setAuthModal={vi.fn()} setActiveModule={vi.fn()} user={{ id: 'u1' }} />);
const run = (n, v) => new Array(n).fill(v);

beforeEach(() => {
  vi.stubEnv('VITE_VOICE_PRACTICE', undefined);
  sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks(); hoisted.calls.start = 0; hoisted.calls.stop = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  callLLM.mockImplementation(async (msgs) => (msgs[0].content.includes('Write 5 interview questions') ? JSON.stringify(QUESTIONS) : JSON.stringify(EVAL)));
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

const open = async () => { fireEvent.click(screen.getByText(/Series B/)); await screen.findByText(/Question 1\/5/); };
const bar = () => within(screen.getByRole('group', { name: /actions/i }));
const voiceSetup = async ({ unlocked = true } = {}) => {
  vi.stubEnv('VITE_VOICE_PRACTICE', 'true');
  if (unlocked) localStorage.setItem('careerai_mock_voice:u1', '1');
  setup(); await open();
  if (unlocked) fireEvent.click(screen.getByRole('tab', { name: /voice answer/i }));
};

describe('text answers', () => {
  it('for a user without voice there are no tabs, one primary action and Skip in the action bar', async () => {
    setup(); await open();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(bar().getByRole('button', { name: /Get AI Feedback/ })).toBeTruthy();
    expect(bar().getByRole('button', { name: /Skip/ })).toBeTruthy();
    expect(screen.queryByTestId('speaking-insights')).toBeNull();
  });
  it('after feedback the action bar offers trying again and the next question', async () => {
    setup(); await open();
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: ANSWER } });
    fireEvent.click(bar().getByRole('button', { name: /Get AI Feedback/ }));
    await screen.findByLabelText('Answer score');
    expect(bar().getByRole('button', { name: /Try this answer again/ })).toBeTruthy();
    expect(bar().getByRole('button', { name: /Next Question/ })).toBeTruthy();
    expect(bar().getByText('Feedback is ready')).toBeTruthy();
  });
});

describe('the score of one answer', () => {
  const feedback = async () => {
    setup(); await open();
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: ANSWER } });
    fireEvent.click(bar().getByRole('button', { name: /Get AI Feedback/ }));
    await screen.findByLabelText('Answer score');
  };
  it('says right under the number that it is an AI estimate and not verified evidence', async () => {
    await feedback();
    const score = screen.getByLabelText('Answer score');
    expect(score.parentElement.textContent).toMatch(/AI estimate/i);
    expect(score.parentElement.textContent).toMatch(/not verified evidence/i);
  });
  it('keeps saying so on a practice retry, next to the practice label', async () => {
    await feedback();
    fireEvent.click(bar().getByRole('button', { name: /Try this answer again/ }));
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: ANSWER + ' I also reported progress every week.' } });
    fireEvent.click(bar().getByRole('button', { name: /Get AI Feedback/ }));
    await waitFor(() => expect(screen.getByText(/Practice score \(not counted\)/)).toBeTruthy());
    expect(screen.getByLabelText('Answer score').parentElement.textContent).toMatch(/AI estimate/i);
  });
});

describe('voice answers', () => {
  it('shows the tabs with Voice answer locked until the unlock, and the typed box still works', async () => {
    await voiceSetup({ unlocked: false });
    expect(screen.getByRole('tab', { name: /voice answer/i }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: /voice answer/i }));
    expect(screen.queryByTestId('recorder')).toBeNull();
    expect(screen.getByLabelText('Your answer')).toBeTruthy();
  });
  it('choosing the Voice tab shows the recorder and the transcript box, but no empty insights card before there is a recording', async () => {
    await voiceSetup();
    expect(screen.getByTestId('recorder')).toBeTruthy();
    expect(screen.getByText('Transcript')).toBeTruthy();
    expect(screen.queryByTestId('speaking-insights')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /type answer/i }));
    expect(screen.queryByTestId('recorder')).toBeNull();
    expect(screen.queryByTestId('speaking-insights')).toBeNull();
  });
  it('the action bar starts and stops the recorder, and waits while the voice is turned into text', async () => {
    await voiceSetup();
    expect(bar().getByText('Ready to record')).toBeTruthy();
    fireEvent.click(bar().getByRole('button', { name: 'Start recording' }));
    expect(hoisted.calls.start).toBe(1);
    expect(bar().getByText('Recording in progress')).toBeTruthy();
    expect(screen.queryByTestId('speaking-insights')).toBeNull(); // the live panel of the recorder takes its place
    fireEvent.click(bar().getByRole('button', { name: 'Finish recording' }));
    expect(hoisted.calls.stop).toBe(1);
    expect(bar().getByRole('button', { name: /Please wait/ }).disabled).toBe(true);
    expect(bar().getByRole('button', { name: /Skip/ }).disabled).toBe(true);
  });
  it('once there is a transcript the primary action is Get AI Feedback, and the insights show the figures', async () => {
    await voiceSetup();
    act(() => { hoisted.stage('idle'); hoisted.transcript(Array.from({ length: 30 }, (_, i) => `word${i}`).join(' '), { durationSec: 8, stepMs: 100, levels: [...run(30, 0.3), ...run(20, 0.001), ...run(30, 0.3)] }); });
    await waitFor(() => expect(bar().getByRole('button', { name: /Get AI Feedback/ })).toBeTruthy());
    const ins = within(screen.getByTestId('speaking-insights'));
    expect(ins.getByText('75')).toBeTruthy(); // speaking time is the big figure now: 6.0 s of 8.0 s is 75%
    expect(ins.getByTestId('insight-time').textContent).toMatch(/6\.0 s of 8\.0 s/);
    expect(ins.getByText('225')).toBeTruthy(); // 30 words in 8 s of recording is 225 per minute; shown as a figure, with no verdict
  });
  it('puts the Delivery rail beside the answer area in voice mode only, and the figures after a recording go into it', async () => {
    await voiceSetup();
    const layout = screen.getByTestId('voice-layout');
    expect(within(layout).getByRole('region', { name: 'Answer area' })).toBeTruthy();
    const rail = within(layout).getByTestId('delivery-rail');
    expect(rail.textContent).toMatch(/Delivery/);
    expect(within(rail).queryByTestId('speaking-insights')).toBeNull();
    act(() => { hoisted.stage('idle'); hoisted.transcript(Array.from({ length: 30 }, (_, i) => `word${i}`).join(' '), { durationSec: 8, stepMs: 100, levels: [...run(30, 0.3), ...run(20, 0.001), ...run(30, 0.3)] }); });
    await waitFor(() => expect(within(rail).getByTestId('speaking-insights')).toBeTruthy());
    expect(within(rail).getByTestId('signal-feed')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /type answer/i }));
    expect(screen.queryByTestId('delivery-rail')).toBeNull();
  });
  it('hands the recorder a slot in the rail for the live figures, and the length and rhythm of the last recording for its Recorded card', async () => {
    await voiceSetup();
    const rail = screen.getByTestId('delivery-rail');
    expect(hoisted.props.liveTarget).toBeTruthy();
    expect(rail.contains(hoisted.props.liveTarget)).toBe(true);
    expect(hoisted.props.recorded).toBeNull();
    act(() => { hoisted.stage('idle'); hoisted.transcript(Array.from({ length: 30 }, (_, i) => `word${i}`).join(' '), { durationSec: 8, stepMs: 100, levels: [...run(30, 0.3), ...run(20, 0.001), ...run(30, 0.3)] }); });
    await waitFor(() => expect(hoisted.props.recorded?.durationSec).toBe(8));
    expect(hoisted.props.recorded.rhythm.state).toBe('ok');
  });
  it('the transcript box can be folded away without losing what is in it', async () => {
    await voiceSetup();
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: ANSWER } });
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.getByLabelText('Your answer').style.display).toBe('none');
    expect(screen.getByLabelText('Your answer').value).toBe(ANSWER);
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getByLabelText('Your answer').style.display).not.toBe('none');
  });
});
