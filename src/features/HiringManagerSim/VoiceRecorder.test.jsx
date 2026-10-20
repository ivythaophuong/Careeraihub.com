import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';

vi.mock('../../lib/voice.js', async (orig) => ({ ...(await orig()), transcribeAudio: vi.fn() }));
import { transcribeAudio, VoiceError } from '../../lib/voice.js';
import VoiceRecorder from './VoiceRecorder';

let tracks, recorders;
class FakeRecorder {
  static isTypeSupported(t) { return t === 'audio/webm;codecs=opus'; }
  constructor(stream, opts) { this.stream = stream; this.mimeType = opts?.mimeType || 'audio/webm'; this.state = 'inactive'; recorders.push(this); }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3])], { type: this.mimeType }) });
    this.onstop?.();
  }
}
const grant = () => { tracks = [{ stop: vi.fn() }]; navigator.mediaDevices.getUserMedia = vi.fn(async () => ({ getTracks: () => tracks })); };

beforeEach(() => {
  sessionStorage.clear(); recorders = [];
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
  grant();
  transcribeAudio.mockReset();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const start = async () => {
  fireEvent.click(screen.getByRole('button', { name: /record your answer/i }));
};
const consent = async () => { fireEvent.click(screen.getByRole('button', { name: /^continue$/i })); await screen.findByRole('button', { name: /stop recording/i }); };

describe('consent and permission', () => {
  it('asks for consent before the microphone is requested, and says the recording is not kept', async () => {
    render(<VoiceRecorder onTranscript={vi.fn()} />);
    await start();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByText(/sent to our speech provider/i)).toBeTruthy();
    expect(screen.getByText(/do not keep it/i)).toBeTruthy();
    await consent();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
  });
  it('cancel leaves everything as it was and never asks for the microphone', async () => {
    render(<VoiceRecorder onTranscript={vi.fn()} />);
    await start();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /record your answer/i })).toBeTruthy();
  });
  it('does not ask for consent again in the same tab', async () => {
    const { unmount } = render(<VoiceRecorder onTranscript={vi.fn()} />);
    await start(); await consent(); unmount();
    render(<VoiceRecorder onTranscript={vi.fn()} />);
    await start();
    await screen.findByRole('button', { name: /stop recording/i });
  });
  it('a blocked microphone shows a plain message and keeps typing available', async () => {
    navigator.mediaDevices.getUserMedia = vi.fn(async () => { throw new DOMException('no', 'NotAllowedError'); });
    render(<VoiceRecorder onTranscript={vi.fn()} />);
    await start();
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/blocked.*type/i);
    expect(screen.getByRole('button', { name: /record your answer/i })).toBeTruthy();
  });
  it('says so when the browser cannot record, and offers no button', () => {
    vi.stubGlobal('MediaRecorder', undefined);
    render(<VoiceRecorder onTranscript={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /record your answer/i })).toBeNull();
    expect(screen.getByText(/cannot record/i)).toBeTruthy();
  });
});

describe('recording and transcript', () => {
  it('stops the microphone, sends the recording once and hands the text back to be corrected', async () => {
    transcribeAudio.mockResolvedValue('I led the migration.');
    const onTranscript = vi.fn();
    render(<VoiceRecorder onTranscript={onTranscript} />);
    await start(); await consent();
    fireEvent.click(screen.getByRole('button', { name: /stop recording/i }));
    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('I led the migration.', { durationSec: expect.any(Number) }));
    expect(tracks[0].stop).toHaveBeenCalled();
    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    expect(transcribeAudio.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(screen.getByText(/check and correct/i)).toBeTruthy();
  });
  it('stops by itself at 3 minutes', async () => {
    vi.useFakeTimers();
    transcribeAudio.mockResolvedValue('Done.');
    const onTranscript = vi.fn();
    render(<VoiceRecorder onTranscript={onTranscript} />);
    await start();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^continue$/i })); });
    expect(recorders[0].state).toBe('recording');
    await act(async () => { vi.advanceTimersByTime(179_000); });
    expect(recorders[0].state).toBe('recording');
    await act(async () => { vi.advanceTimersByTime(2_000); });
    expect(recorders[0].state).toBe('inactive');
    expect(onTranscript).toHaveBeenCalledWith('Done.', { durationSec: expect.any(Number) });
  });
  it('a failed transcription shows the reason, hands back nothing and lets the user record again', async () => {
    transcribeAudio.mockRejectedValue(new VoiceError('We could not hear any speech.', { status: 422 }));
    const onTranscript = vi.fn();
    render(<VoiceRecorder onTranscript={onTranscript} />);
    await start(); await consent();
    fireEvent.click(screen.getByRole('button', { name: /stop recording/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not hear any speech/i);
    expect(onTranscript).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /record your answer/i })).toBeTruthy();
  });
  it('writes nothing to localStorage and only the consent flag to sessionStorage', async () => {
    transcribeAudio.mockResolvedValue('Text.');
    const local = vi.spyOn(Storage.prototype, 'setItem');
    render(<VoiceRecorder onTranscript={vi.fn()} />);
    await start(); await consent();
    fireEvent.click(screen.getByRole('button', { name: /stop recording/i }));
    await waitFor(() => expect(transcribeAudio).toHaveBeenCalled());
    const keys = local.mock.calls.map(c => c[0]);
    expect(keys.every(k => /consent/i.test(k))).toBe(true);
    expect(JSON.stringify(local.mock.calls)).not.toMatch(/audio|AQID/i);
  });
  it('is disabled while the parent is busy', () => {
    render(<VoiceRecorder onTranscript={vi.fn()} disabled />);
    expect(screen.getByRole('button', { name: /record your answer/i }).disabled).toBe(true);
  });
  it('stops the microphone if the component goes away mid-recording', async () => {
    const { unmount } = render(<VoiceRecorder onTranscript={vi.fn()} />);
    await start(); await consent();
    unmount();
    expect(tracks[0].stop).toHaveBeenCalled();
  });
});

describe('recording length handed to the parent (for the speaking-rate estimate)', () => {
  it('passes the measured length of the whole recording in seconds with the transcript', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(0);
    transcribeAudio.mockResolvedValue('Some words here.');
    const onTranscript = vi.fn();
    render(<VoiceRecorder onTranscript={onTranscript} />);
    await start();
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /stop recording/i }));
    // the recorder stopped at once in the test; now check the number that was measured
    await waitFor(() => expect(onTranscript).toHaveBeenCalled());
    expect(onTranscript.mock.calls[0][0]).toBe('Some words here.');
    expect(onTranscript.mock.calls[0][1]).toEqual({ durationSec: 0 });
  });
  it('measures with the clock, not by counting ticks', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(0);
    transcribeAudio.mockResolvedValue('Some words here.');
    const onTranscript = vi.fn();
    render(<VoiceRecorder onTranscript={onTranscript} />);
    await start();
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    const stopBtn = await screen.findByRole('button', { name: /stop recording/i });
    vi.setSystemTime(30_400);
    fireEvent.click(stopBtn);
    await waitFor(() => expect(onTranscript).toHaveBeenCalled());
    expect(onTranscript.mock.calls[0][1]).toEqual({ durationSec: 30.4 });
  });
});

