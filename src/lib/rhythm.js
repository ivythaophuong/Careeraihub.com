// Speech rhythm for voice practice, worked out in the browser from how loud each moment of the recording was (one number per 100 ms).
// It never sees the sound itself. Pure and deterministic. The thresholds below are PROPOSED starting values, not yet tuned on real microphones or checked against hand-timed samples.
import { SILENT_PEAK } from './audioMeter.js';
import { countWords } from './speakingRate.js';

const MIN_FRAMES = 20;      // under about 2 seconds there is too little to say anything about rhythm
const BRIDGE_FRAMES = 3;    // a dip shorter than 300 ms between two sounds is part of speech (consonants, breathing in a word), not a pause
const LONG_PAUSE_SEC = 1;   // a "long pause" is one second or more
const round1 = (x) => Math.round(x * 10) / 10;

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
  for (let i = first; i <= last;) {
    if (speech[i]) { speechFrames++; i++; continue; }
    let j = i; while (j <= last && !speech[j]) j++;
    const len = j - i;
    pauseFrames += len; longest = Math.max(longest, len);
    if (len * stepMs / 1000 >= LONG_PAUSE_SEC) longPauses++;
    i = j;
  }
  const total = last - first + 1;
  const sec = (frames) => round1(frames * stepMs / 1000);
  const out = {
    state: 'ok',
    totalSec: sec(total), speechSec: sec(speechFrames), pauseSec: sec(pauseFrames),
    speechPercent: Math.round(speechFrames / total * 100),
    longPauses, longestPauseSec: sec(longest),
  };
  const words = countWords(text);
  if (words > 0 && speechFrames > 0) out.paceWhileSpeakingWpm = Math.round(words * 60 / (speechFrames * stepMs / 1000));
  return out;
}
