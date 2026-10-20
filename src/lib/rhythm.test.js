// Speech rhythm from the loudness of the recording (voice practice). Pure and deterministic; levels are numbers, not sound.
import { describe, it, expect } from 'vitest';
import { analyzeRhythm } from './rhythm.js';

const run = (n, v) => new Array(n).fill(v);
const STEP = 100;
const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

describe('analyzeRhythm', () => {
  it('splits speaking time from pauses and counts the long pauses', () => {
    const levels = [...run(30, 0.3), ...run(20, 0.001), ...run(30, 0.3)];
    const r = analyzeRhythm({ levels, stepMs: STEP, text: words(20) });
    expect(r.state).toBe('ok');
    expect(r.totalSec).toBe(8);
    expect(r.speechSec).toBe(6);
    expect(r.pauseSec).toBe(2);
    expect(r.speechPercent).toBe(75);
    expect(r.longPauses).toBe(1);
    expect(r.longestPauseSec).toBe(2);
    expect(r.paceWhileSpeakingWpm).toBe(200); // 20 words in 6 s of speech
  });
  it('leaves out silence before the first word and after the last', () => {
    const levels = [...run(10, 0.001), ...run(30, 0.3), ...run(10, 0.001), ...run(30, 0.3), ...run(15, 0.001)];
    const r = analyzeRhythm({ levels, stepMs: STEP, text: words(10) });
    expect(r.totalSec).toBe(7);
    expect(r.speechSec).toBe(6);
    expect(r.pauseSec).toBe(1);
  });
  it('does not count a very short dip between sounds as a pause', () => {
    const levels = [...run(30, 0.3), ...run(2, 0.001), ...run(30, 0.3), ...run(20, 0.3)];
    const r = analyzeRhythm({ levels, stepMs: STEP, text: words(10) });
    expect(r.longPauses).toBe(0);
    expect(r.pauseSec).toBe(0);
    expect(r.speechPercent).toBe(100);
  });
  it('a pause under one second is a pause but not a long pause', () => {
    const levels = [...run(30, 0.3), ...run(6, 0.001), ...run(30, 0.3)];
    const r = analyzeRhythm({ levels, stepMs: STEP, text: words(10) });
    expect(r.pauseSec).toBe(0.6);
    expect(r.longPauses).toBe(0);
    expect(r.longestPauseSec).toBe(0.6);
  });
  it('gives the same answer for the same input', () => {
    const levels = [...run(30, 0.3), ...run(20, 0.001), ...run(30, 0.3)];
    const a = analyzeRhythm({ levels, stepMs: STEP, text: words(20) });
    expect(analyzeRhythm({ levels: [...levels], stepMs: STEP, text: words(20) })).toEqual(a);
  });
  it('leaves out the pace while speaking when there is no transcript, but keeps the rest', () => {
    const levels = [...run(30, 0.3), ...run(20, 0.001), ...run(30, 0.3)];
    const r = analyzeRhythm({ levels, stepMs: STEP, text: '' });
    expect(r.state).toBe('ok');
    expect('paceWhileSpeakingWpm' in r).toBe(false);
  });
  it.each([
    ['no levels', { levels: [], stepMs: STEP }, 'too_short'],
    ['missing levels', { stepMs: STEP }, 'too_short'],
    ['under two seconds', { levels: run(15, 0.3), stepMs: STEP }, 'too_short'],
    ['a recording with no sound', { levels: run(60, 0.001), stepMs: STEP }, 'no_sound'],
    ['a bad step', { levels: run(60, 0.3), stepMs: 0 }, 'too_short'],
  ])('shows no figures for %s', (_n, input, reason) => {
    expect(analyzeRhythm(input)).toEqual({ state: 'unavailable', reason });
  });
  it('never throws on odd input', () => {
    for (const v of [undefined, null, 5, 'x', { levels: 'abc' }, { levels: [NaN, NaN, NaN], stepMs: STEP }]) expect(() => analyzeRhythm(v)).not.toThrow();
  });
});

describe('segments (for the timeline on screen)', () => {
  const levels = [...run(10, 0.001), ...run(30, 0.3), ...run(20, 0.001), ...run(30, 0.3), ...run(6, 0.001), ...run(15, 0.3), ...run(10, 0.001)];
  const r = analyzeRhythm({ levels, stepMs: STEP, text: words(30) });
  it('lists the speaking and pausing stretches in order, from the first sound to the last', () => {
    expect(r.segments.map(x => x.type)).toEqual(['speech', 'pause', 'speech', 'pause', 'speech']);
    expect(r.segments.map(x => x.sec)).toEqual([3, 2, 3, 0.6, 1.5]);
  });
  it('adds up to the total, and the pause stretches add up to the pause time', () => {
    expect(r.segments.reduce((n, x) => n + x.sec, 0)).toBeCloseTo(r.totalSec, 1);
    expect(r.segments.filter(x => x.type === 'pause').reduce((n, x) => n + x.sec, 0)).toBeCloseTo(r.pauseSec, 1);
  });
  it('marks a pause of one second or more as long, and a shorter one as not', () => {
    const pauses = r.segments.filter(x => x.type === 'pause');
    expect(pauses.map(x => x.long)).toEqual([true, false]);
    expect(r.longPauses).toBe(1);
  });
  it('speech stretches are never marked long', () => {
    expect(r.segments.filter(x => x.type === 'speech').every(x => !x.long)).toBe(true);
  });
});

