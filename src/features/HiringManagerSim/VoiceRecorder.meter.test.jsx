// The recorder with a working audio meter: live waveform, a quiet-microphone hint, and no upload of a recording with no sound.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';

vi.mock('../../lib/voice.js', async (orig) => ({ ...(await orig()), transcribeAudio: vi.fn() }));
const meter = { analyser: { fftSize: 1024, getByteTimeDomainData: (b) => b.fill(128) }, sample: vi.fn(() => 0), peak: vi.fn(() => 0.2), close: vi.fn() };
vi.mock('../../lib/audioMeter.js', async (orig) => ({ ...(await orig()), createAudioMeter: vi.fn(() => meter) }));
import { transcribeAudio } from '../../lib/voice.js';
import { createAudioMeter } from '../../lib/audioMeter.js';
import VoiceRecorder from './VoiceRecorder';

let tracks;
class FakeRecorder {
  static isTypeSupported() { return true; }
  constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm'; }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3])]) }); this.onstop?.(); }
}
beforeEach(() => {
  sessionStorage.setItem('voice-practice-consent', '1');
  tracks = [{ stop: vi.fn() }];
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn(async () => ({ getTracks: () => tracks })) }, configurable: true });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null); // jsdom has no canvas
  transcribeAudio.mockReset(); transcribeAudio.mockResolvedValue('Some words here.');
  meter.sample.mockReset(); meter.sample.mockReturnValue(0.2); meter.peak.mockReturnValue(0.2); meter.close.mockReset();
  createAudioMeter.mockClear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const startRecording = async () => {
  fireEvent.click(screen.getByRole('button', { name: /record your answer/i }));
  return screen.findByRole('button', { name: /stop recording/i });
};

describe('live waveform', () => {
  it('shows a labelled live-sound display only while recording', async () => {
    render(<VoiceRecorder onTranscript={vi.fn()} />);
    expect(screen.queryByRole('img', { name: /live sound/i })).toBeNull();
    await startRecording();
    expect(screen.getByRole('img', { name: /live sound/i })).toBeTruthy();
    expect(createAudioMeter).toHaveBeenCalledTimes(1);
  });
  it('shows a progress ring for the 3 minute limit with the elapsed seconds', async () => {
    vi.useFakeTimers();
    render(<VoiceRecorder onTranscript={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /record your answer/i }));
    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(45_000); });
    const bar = screen.getByRole('progressbar', { name: /recording time/i });
    expect(bar.getAttribute('aria-valuenow')).toBe('45');
    expect(bar.getAttribute('aria-valuemax')).toBe('180');
  });
  it('closes the meter when recording stops and when the component goes away', async () => {
    const { unmount } = render(<VoiceRecorder onTranscript={vi.fn()} />);
    fireEvent.click(await startRecording());
    await waitFor(() => expect(meter.close).toHaveBeenCalled());
    meter.close.mockClear();
    unmount();
    const r2 = render(<VoiceRecorder onTranscript={vi.fn()} />);
    await startRecording();
    r2.unmount();
    expect(meter.close).toHaveBeenCalled();
  });
});

describe('quiet microphone', () => {
  it('after a few seconds with no sound it says it cannot hear you', async () => {
    vi.useFakeTimers();
    meter.sample.mockReturnValue(0);
    render(<VoiceRecorder onTranscript={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /record your answer/i }));
    await act(async () => {});
    expect(screen.queryByText(/barely hear you/i)).toBeNull();
    await act(async () => { vi.advanceTimersByTime(4_000); });
    expect(screen.getByText(/barely hear you/i)).toBeTruthy();
  });
  it('the hint goes away when sound comes back', async () => {
    vi.useFakeTimers();
    meter.sample.mockReturnValue(0);
    render(<VoiceRecorder onTranscript={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /record your answer/i }));
    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(4_000); });
    meter.sample.mockReturnValue(0.3);
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(screen.queryByText(/barely hear you/i)).toBeNull();
  });
  it('a recording with no sound at all is not uploaded, and says why', async () => {
    meter.peak.mockReturnValue(0);
    const onTranscript = vi.fn();
    render(<VoiceRecorder onTranscript={onTranscript} />);
    fireEvent.click(await startRecording());
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not hear any sound/i);
    expect(transcribeAudio).not.toHaveBeenCalled();
    expect(onTranscript).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /record your answer/i })).toBeTruthy();
  });
  it('a recording with sound is uploaded as before', async () => {
    const onTranscript = vi.fn();
    render(<VoiceRecorder onTranscript={onTranscript} />);
    fireEvent.click(await startRecording());
    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('Some words here.', expect.any(Object)));
  });
});

describe('without Web Audio', () => {
  it('records and transcribes as before, with no waveform', async () => {
    createAudioMeter.mockReturnValueOnce(null);
    const onTranscript = vi.fn();
    render(<VoiceRecorder onTranscript={onTranscript} />);
    fireEvent.click(await startRecording());
    expect(screen.queryByRole('img', { name: /live sound/i })).toBeNull();
    await waitFor(() => expect(onTranscript).toHaveBeenCalled());
  });
});

describe('loudness levels handed to the parent (for the rhythm figures)', () => {
  it('passes one loudness number per 100 ms, and no sound', async () => {
    vi.useFakeTimers();
    let n = 0;
    meter.sample.mockImplementation(() => [0.3, 0.001][n++ % 2]);
    const onTranscript = vi.fn();
    render(<VoiceRecorder onTranscript={onTranscript} />);
    fireEvent.click(screen.getByRole('button', { name: /record your answer/i }));
    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1_000); });
    fireEvent.click(screen.getByRole('button', { name: /stop recording/i }));
    await act(async () => { vi.useRealTimers(); });
    await waitFor(() => expect(onTranscript).toHaveBeenCalled());
    const meta = onTranscript.mock.calls[0][1];
    expect(meta.stepMs).toBe(100);
    expect(meta.levels).toHaveLength(10);
    expect(meta.levels.slice(0, 4)).toEqual([0.3, 0.001, 0.3, 0.001]);
    expect(meta.levels.every(v => typeof v === 'number')).toBe(true);
  });
  it('passes an empty list when there is no meter', async () => {
    createAudioMeter.mockReturnValueOnce(null);
    const onTranscript = vi.fn();
    render(<VoiceRecorder onTranscript={onTranscript} />);
    fireEvent.click(await startRecording());
    await waitFor(() => expect(onTranscript).toHaveBeenCalled());
    expect(onTranscript.mock.calls[0][1].levels).toEqual([]);
  });
});

describe('live rhythm while recording', () => {
  const start = async () => {
    vi.useFakeTimers();
    return render(<VoiceRecorder onTranscript={vi.fn()} />);
  };
  const begin = async () => { fireEvent.click(screen.getByRole('button', { name: /record your answer/i })); await act(async () => {}); };
  const scripted = () => { let n = 0; meter.sample.mockImplementation(() => { n++; return n > 30 && n <= 50 ? 0.001 : 0.3; }); };

  it('shows a Rhythm panel marked Live while recording, with dashes until there is enough to measure', async () => {
    await start(); scripted(); await begin();
    const panel = screen.getByTestId('live-rhythm');
    expect(panel.textContent).toMatch(/Rhythm/);
    expect(panel.textContent).toMatch(/Live/);
    expect(panel.textContent).toMatch(/Speaking time\s*—/);
    expect(panel.textContent).toMatch(/Pauses of 1 second or more\s*—/);
  });
  it('then shows speaking time and long pauses as they happen, and the pace as after you stop', async () => {
    await start(); scripted(); await begin();
    await act(async () => { vi.advanceTimersByTime(8_000); });
    const t = screen.getByTestId('live-rhythm').textContent;
    expect(t).toMatch(/Speaking time\s*75%\s*6\.0 s of 8\.0 s so far/);
    expect(t).toMatch(/Pauses of 1 second or more\s*1/);
    expect(t).toMatch(/00:03\s*2\.0 s/);
    expect(t).toMatch(/Pace while speaking\s*—/);
    expect(t).toMatch(/after you stop/i);
    expect(screen.getAllByTestId('rhythm-long-pause')).toHaveLength(1);
  });
  it('says the figures are estimates that can change as the answer goes on', async () => {
    await start(); scripted(); await begin();
    await act(async () => { vi.advanceTimersByTime(5_000); });
    expect(screen.getByTestId('live-rhythm').textContent).toMatch(/can change as you keep speaking/i);
  });
  it('goes away when recording stops', async () => {
    await start(); scripted(); await begin();
    await act(async () => { vi.advanceTimersByTime(3_000); });
    fireEvent.click(screen.getByRole('button', { name: /stop recording/i }));
    await act(async () => {});
    expect(screen.queryByTestId('live-rhythm')).toBeNull();
  });
  it('is not shown without a working meter', async () => {
    createAudioMeter.mockReturnValueOnce(null);
    await start(); await begin();
    expect(screen.queryByTestId('live-rhythm')).toBeNull();
  });
});

describe('control from outside (the action bar)', () => {
  const mount = (props = {}) => { const ref = React.createRef(); const stages = []; render(<VoiceRecorder ref={ref} onTranscript={vi.fn()} onStage={(s) => stages.push(s)} {...props} />); return { ref, stages }; };
  it('reports its stage as it changes', async () => {
    const { ref, stages } = mount();
    expect(stages.at(-1)).toBe('idle');
    await act(async () => { ref.current.start(); });
    await screen.findByRole('button', { name: /stop recording/i });
    expect(stages).toContain('recording');
    let finish; transcribeAudio.mockImplementationOnce(() => new Promise((r) => { finish = r; })); // a real transcription takes seconds
    await act(async () => { ref.current.stop(); });
    await waitFor(() => expect(stages.at(-1)).toBe('transcribing'));
    await act(async () => { finish('Some words here.'); });
    await waitFor(() => expect(stages.at(-1)).toBe('idle'));
  });
  it('start() asks for consent first when it has not been given', async () => {
    sessionStorage.clear();
    const { ref, stages } = mount();
    await act(async () => { ref.current.start(); });
    expect(stages.at(-1)).toBe('consent');
    expect(screen.getByRole('dialog', { name: /consent/i })).toBeTruthy();
  });
  it('start() and stop() do nothing at the wrong time and never throw', async () => {
    const { ref } = mount({ disabled: true });
    expect(() => { ref.current.stop(); }).not.toThrow();
    await act(async () => { ref.current.start(); });
    expect(screen.queryByRole('button', { name: /stop recording/i })).toBeNull();
  });
});

