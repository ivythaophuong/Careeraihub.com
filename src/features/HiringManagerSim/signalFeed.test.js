import { describe, it, expect } from 'vitest';
import { signalFeed } from './signalFeed';

const seg = (type, sec, startSec, extra = {}) => ({ type, sec, startSec, ...extra });
const done = {
  state: 'ok', totalSec: 25, speechSec: 16.7, longPauses: 2,
  segments: [seg('speech', 5.6, 0), seg('pause', 1.9, 5.6, { long: true }), seg('speech', 6.7, 7.5), seg('pause', 1.8, 14.2, { long: true }), seg('speech', 9, 16)],
};

describe('signalFeed', () => {
  it('lists the measured events of a finished answer, newest first, with the time each started', () => {
    const rows = signalFeed(done);
    expect(rows.map(r => `${r.at} ${r.what} ${r.note}`)).toEqual([
      '00:25 Speaking ended 25.0 s',
      '00:16 Longest speaking run 9.0 s',
      '00:14 Pause 1.8 s',
      '00:05 Pause 1.9 s',
      '00:00 Speaking started ',
    ]);
  });
  it('shows only what has happened so far while recording: no end row, no longest run', () => {
    const rows = signalFeed({ ...done, segments: done.segments.slice(0, 3) }, { live: true });
    expect(rows.map(r => r.what)).toEqual(['Pause', 'Speaking started']);
  });
  it('is empty without a measured rhythm, never an invented row', () => {
    expect(signalFeed(null)).toEqual([]);
    expect(signalFeed({ state: 'unavailable', reason: 'too_short' })).toEqual([]);
  });
  it('ignores pauses shorter than one second', () => {
    const r = { ...done, segments: [seg('speech', 4, 0), seg('pause', 0.5, 4, { long: false }), seg('speech', 4, 4.5)] };
    expect(signalFeed(r).some(x => x.what === 'Pause')).toBe(false);
  });
});
