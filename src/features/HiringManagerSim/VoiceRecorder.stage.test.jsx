// The designed recording screen: a stage card (Recording clock, mic level, timeline with the present moment, colour legend) and a "Recorded" card afterwards.
// The live figures can be handed to the Delivery rail through a portal target; without one they stay inside the recorder.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';

vi.mock('../../lib/voice.js', async (orig) => ({ ...(await orig()), transcribeAudio: vi.fn() }));
const meter = { analyser: { fftSize: 1024, getByteTimeDomainData: (b) => b.fill(128) }, sample: vi.fn(() => 0), peak: vi.fn(() => 0.2), close: vi.fn() };
vi.mock('../../lib/audioMeter.js', async (orig) => ({ ...(await orig()), createAudioMeter: vi.fn(() => meter) }));
import VoiceRecorder from './VoiceRecorder';

class FakeRecorder {
  static isTypeSupported() { return true; }
  constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm'; }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array([1])]) }); this.onstop?.(); }
}
beforeEach(() => {
  sessionStorage.setItem('voice-practice-consent', '1');
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) }, configurable: true });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
  meter.sample.mockReset(); meter.sample.mockReturnValue(0.3); meter.peak.mockReturnValue(0.3); meter.close.mockReset();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const begin = async () => { fireEvent.click(screen.getByRole('button', { name: /record your answer/i })); await act(async () => {}); };
const scripted = () => { let n = 0; meter.sample.mockImplementation(() => { n++; return n > 30 && n <= 50 ? 0.001 : 0.3; }); };

describe('the recording stage', () => {
  it('shows the clock, the mic level, the timeline of the answer so far and the colour legend while recording', async () => {
    vi.useFakeTimers(); scripted();
    render(<VoiceRecorder onTranscript={vi.fn()} />);
    await begin();
    await act(async () => { vi.advanceTimersByTime(8_000); });
    const stage = screen.getByTestId('recording-stage');
    expect(stage.textContent).toMatch(/Recording/);
    expect(stage.textContent).toMatch(/0:08 of 3:00/);
    expect(within(stage).getByRole('meter', { name: /mic level/i })).toBeTruthy();
    expect(within(stage).getByRole('img', { name: /timeline of your answer so far/i })).toBeTruthy();
    expect(within(stage).getAllByTestId('rhythm-long-pause')).toHaveLength(1);
    expect(stage.textContent).toMatch(/Colour shows loudness compared with your own voice\. It is not a grade\./);
  });
  it('names the mic level in words (no sound, softer, steady or louder), never a grade', async () => {
    vi.useFakeTimers(); meter.sample.mockReturnValue(0.3);
    render(<VoiceRecorder onTranscript={vi.fn()} />);
    await begin();
    await act(async () => { vi.advanceTimersByTime(1_000); });
    const m = screen.getByRole('meter', { name: /mic level/i });
    expect(m.getAttribute('aria-valuetext')).toMatch(/^(No sound|Softer|Steady|Louder)$/);
  });
});

describe('the live figures and the Delivery rail', () => {
  it('stay inside the recorder when there is no target', async () => {
    vi.useFakeTimers(); scripted();
    render(<VoiceRecorder onTranscript={vi.fn()} />);
    await begin();
    await act(async () => { vi.advanceTimersByTime(8_000); });
    expect(screen.getByTestId('live-rhythm')).toBeTruthy();
  });
  it('appear in the target element when one is given, and the signal feed lists the pause as it happened', async () => {
    vi.useFakeTimers(); scripted();
    const target = document.createElement('div'); document.body.appendChild(target);
    render(<VoiceRecorder onTranscript={vi.fn()} liveTarget={target} />);
    await begin();
    await act(async () => { vi.advanceTimersByTime(8_000); });
    const panel = within(target).getByTestId('live-rhythm');
    expect(panel.textContent).toMatch(/Speaking time/);
    expect(panel.textContent).toMatch(/Pace/);
    expect(panel.textContent).toMatch(/after you stop/i);
    expect(within(panel).getAllByTestId('feed-row').map(r => r.textContent).join('|')).toMatch(/Pause2\.0 s/);
    expect(screen.getByTestId('recording-stage').contains(panel)).toBe(false);
    target.remove();
  });
});

describe('the recorded card', () => {
  it('after a recording shows how long it was, the timeline, the legend and how to record again', () => {
    const rhythm = { state: 'ok', totalSec: 25, speechSec: 16.7, speechPercent: 67, longPauses: 1, longestPauseSec: 1.9,
      segments: [{ type: 'speech', sec: 10, startSec: 0, tier: 'steady' }, { type: 'pause', sec: 1.9, startSec: 10, long: true }, { type: 'speech', sec: 13, startSec: 11.9, tier: 'loud' }] };
    render(<VoiceRecorder onTranscript={vi.fn()} recorded={{ durationSec: 25, rhythm }} />);
    const card = screen.getByTestId('recorded-card');
    expect(card.textContent).toMatch(/Recorded, 25\.0 s/);
    expect(card.textContent).toMatch(/Tap the microphone to record this answer again/);
    expect(within(card).getByRole('img', { name: /timeline of your answer/i })).toBeTruthy();
    expect(within(card).getByRole('button', { name: /record your answer/i })).toBeTruthy();
  });
  it('is not shown before a recording exists', () => {
    render(<VoiceRecorder onTranscript={vi.fn()} />);
    expect(screen.queryByTestId('recorded-card')).toBeNull();
  });
});
