// Live sound level for the voice recorder: pure helpers plus a thin Web Audio wrapper. Nothing here stores or sends audio.
import { describe, it, expect, vi } from 'vitest';
import { levelOf, barsOf, isSilent, SILENT_PEAK, createAudioMeter } from './audioMeter.js';

const flat = (n, v = 128) => new Uint8Array(n).fill(v);
const square = (n, amp) => Uint8Array.from({ length: n }, (_, i) => 128 + (i % 2 ? amp : -amp));

describe('levelOf', () => {
  it('is 0 for silence and for empty or missing input', () => {
    expect(levelOf(flat(256))).toBe(0);
    expect(levelOf(new Uint8Array(0))).toBe(0);
    expect(levelOf(null)).toBe(0);
  });
  it('is the RMS of the samples around the centre, between 0 and 1', () => {
    expect(levelOf(square(256, 64))).toBeCloseTo(0.5, 2);
    expect(levelOf(square(256, 127))).toBeGreaterThan(0.99);
    expect(levelOf(square(256, 127))).toBeLessThanOrEqual(1);
  });
});

describe('barsOf', () => {
  it('splits the samples into the requested number of bars, each its own level', () => {
    const data = new Uint8Array([...flat(100), ...square(100, 64)]);
    const bars = barsOf(data, 2);
    expect(bars).toHaveLength(2);
    expect(bars[0]).toBe(0);
    expect(bars[1]).toBeCloseTo(0.5, 2);
  });
  it('returns zeros for no data and never a different length', () => {
    expect(barsOf(null, 5)).toEqual([0, 0, 0, 0, 0]);
    expect(barsOf(flat(3), 8)).toHaveLength(8);
  });
});

describe('isSilent', () => {
  it('is true only for a known peak below the threshold', () => {
    expect(isSilent(0)).toBe(true);
    expect(isSilent(SILENT_PEAK / 2)).toBe(true);
    expect(isSilent(SILENT_PEAK)).toBe(false);
    expect(isSilent(0.3)).toBe(false);
  });
  it('is false when the peak is unknown, so a broken meter never blocks a recording', () => {
    for (const v of [undefined, null, NaN, '0']) expect(isSilent(v)).toBe(false);
  });
});

describe('createAudioMeter', () => {
  const fakeCtx = (bytes) => {
    const closes = vi.fn(async () => {});
    const analyser = { fftSize: 0, getByteTimeDomainData: (buf) => buf.set(bytes.slice(0, buf.length)) };
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    class Ctx { createMediaStreamSource() { return source; } createAnalyser() { return analyser; } resume() { return Promise.resolve(); } close() { return closes(); } }
    return { Ctx, closes, source, analyser };
  };
  it('returns null when the browser has no Web Audio or there is no stream', () => {
    expect(createAudioMeter({}, null)).toBeNull();
    expect(createAudioMeter(null, class {})).toBeNull();
  });
  it('returns null instead of throwing when Web Audio fails', () => {
    class Bad { constructor() { throw new Error('nope'); } }
    expect(createAudioMeter({}, Bad)).toBeNull();
  });
  it('samples the level, remembers the loudest one, and closes cleanly', () => {
    const f = fakeCtx(new Uint8Array(1024).fill(128));
    const meter = createAudioMeter({}, f.Ctx);
    expect(meter.peak()).toBe(0);
    expect(meter.sample()).toBe(0);
    f.analyser.getByteTimeDomainData = (buf) => buf.set(square(buf.length, 64));
    expect(meter.sample()).toBeCloseTo(0.5, 2);
    f.analyser.getByteTimeDomainData = (buf) => buf.set(flat(buf.length));
    meter.sample();
    expect(meter.peak()).toBeCloseTo(0.5, 2);
    meter.close();
    expect(f.source.disconnect).toHaveBeenCalled();
    expect(f.closes).toHaveBeenCalled();
  });
});
