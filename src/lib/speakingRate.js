// Estimated speaking rate for voice practice (user story D1). Pure and deterministic: words x 60 / seconds, from the raw transcript and the length of
// the whole recording. It is information only: it feeds no score, is never saved, and no model is involved. The duration includes silence and the
// transcript may miss words, so the screen calls it an estimate. Without a usable transcript and duration there is no number (never 0).
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export function countWords(text) {
  if (typeof text !== 'string') return 0;
  return text.split(/\s+/).filter(t => HAS_LETTER_OR_DIGIT.test(t)).length;
}

export function estimateWpm(input) {
  const { text, durationSec } = input && typeof input === 'object' ? input : {};
  const words = countWords(text);
  if (words === 0) return { state: 'unavailable', reason: 'no_transcript' };
  if (typeof durationSec !== 'number' || !Number.isFinite(durationSec) || durationSec <= 0) return { state: 'unavailable', reason: 'no_duration' };
  const wpm = Math.round(words * 60 / durationSec);
  if (!Number.isFinite(wpm)) return { state: 'unavailable', reason: 'no_duration' };
  return { state: 'ok', wpm, words, durationSec };
}
