// Speech rhythm for voice practice, worked out in the browser from how loud each moment of the recording was (one number per 100 ms).
// It never sees the sound itself. Pure and deterministic. The thresholds below are PROPOSED starting values, not yet tuned on real microphones or checked against hand-timed samples.
import { SILENT_PEAK } from './audioMeter.js';
import { countWords } from './speakingRate.js';

const MIN_FRAMES = 20;      // under about 2 seconds there is too little to say anything about rhythm
const BRIDGE_FRAMES = 3;    // a dip shorter than 300 ms between two sounds is part of speech (consonants, breathing in a word), not a pause
const LONG_PAUSE_SEC = 1;   // a "long pause" is one second or more
const round1 = (x) => Math.round(x * 10) / 10;

// Loudness tiers: colour for the timeline, relative to the speaker's own voice in the same recording. The range of the speaking stretches is cut into thirds:
// softer, steady, louder. If the voice stayed about the same (under 5% of the loudest), nothing is softer or louder: no contrast is invented. Information only, never a grade.
// The 5% and the thirds are PROPOSED starting values.
export function tierCutoffs(values) {
  const v = (Array.isArray(values) ? values : []).filter(x => typeof x === 'number' && Number.isFinite(x) && x > 0);
  if (v.length < 2) return null;
  const mn = Math.min(...v); const mx = Math.max(...v);
  if (mx - mn < 0.05 * mx) return null;
  return { soft: mn + (mx - mn) / 3, loud: mn + 2 * (mx - mn) / 3 };
}
export const tierOf = (x, cut) => (!cut ? 'steady' : x < cut.soft ? 'soft' : x > cut.loud ? 'loud' : 'steady');

export function analyzeRhythm(input) {
  const { levels, stepMs, text } = input && typeof input === 'object' ? input : {};
  if (!Array.isArray(levels) || levels.length < MIN_FRAMES || typeof stepMs !== 'number' || !Number.isFinite(stepMs) || stepMs <= 0) return { state: 'unavailable', reason: 'too_short' };
  const lv = levels.map(v => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0));
  const sorted = [...lv].sort((a, b) => a - b);
  const floor = sorted[Math.floor(0.2 * lv.length)];
  const ref = sorted[Math.floor(0.9 * lv.length)];
  if (ref < SILENT_PEAK) return { state: 'unavailable', reason: 'no_sound' };
  const thr = Math.max(SILENT_PEAK / 2, floor + 0.25 * (ref - floor));
  const speech = lv.map(v => v >= thr);

  // Join speech across dips shorter than BRIDGE_FRAMES.
  for (let i = 0; i < speech.length;) {
    if (speech[i]) { i++; continue; }
    let j = i; while (j < speech.length && !speech[j]) j++;
    if (i > 0 && j < speech.length && j - i < BRIDGE_FRAMES) for (let k = i; k < j; k++) speech[k] = true;
    i = j;
  }
  const first = speech.indexOf(true);
  const last = speech.lastIndexOf(true);
  if (first === -1) return { state: 'unavailable', reason: 'no_sound' };

  let speechFrames = 0; let pauseFrames = 0; let longest = 0; let longPauses = 0;
  const segments = []; // the stretches in order, for the timeline on screen
  const sec2 = (frames) => Math.round(frames * stepMs / 10) / 100;
  const meanLevel = [];
  for (let i = first; i <= last;) {
    let j = i; while (j <= last && speech[j] === speech[i]) j++;
    const len = j - i;
    const startSec = sec2(i - first);
    if (speech[i]) {
      speechFrames += len;
      let sum = 0; for (let k = i; k < j; k++) sum += lv[k];
      meanLevel.push(sum / len);
      segments.push({ type: 'speech', sec: sec2(len), startSec });
    } else {
      pauseFrames += len; longest = Math.max(longest, len);
      const long = len * stepMs / 1000 >= LONG_PAUSE_SEC;
      if (long) longPauses++;
      segments.push({ type: 'pause', sec: sec2(len), startSec, long });
    }
    i = j;
  }
  const cut = tierCutoffs(meanLevel);
  let n = 0;
  for (const g of segments) if (g.type === 'speech') g.tier = tierOf(meanLevel[n++], cut);
  const total = last - first + 1;
  const sec = (frames) => round1(frames * stepMs / 1000);
  const out = {
    state: 'ok',
    totalSec: sec(total), speechSec: sec(speechFrames), pauseSec: sec(pauseFrames),
    speechPercent: Math.round(speechFrames / total * 100),
    longPauses, longestPauseSec: sec(longest), segments,
  };
  const words = countWords(text);
  if (words > 0 && speechFrames > 0) out.paceWhileSpeakingWpm = Math.round(words * 60 / (speechFrames * stepMs / 1000));
  return out;
}
