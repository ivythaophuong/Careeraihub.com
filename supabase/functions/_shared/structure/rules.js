// Versioned rules of the structure scores: weights, length bands, thresholds. Changing ANY of these, or any word list, tokenisation or
// language rule, changes scores: bump the matching version below and update RULES_FINGERPRINTS (rules.test.js fails otherwise).
import { EN } from './lexicon.en.js';
import { VI } from './lexicon.vi.js';
import { LANGUAGE_RULES, MIN_TOKENS_FOR_LANGUAGE } from './text.js';

export const SCORE_VERSIONS = Object.freeze({
  star_structure: '1.0.0',
  interview_answer_structure: '1.0.0',
  interview_session_structure: '1.0.0',
});

// STAR section weights (same as src/features/STARBuilder/star.js; a test compares them).
export const STAR_WEIGHTS = Object.freeze({ situation: 0.15, task: 0.15, action: 0.4, result: 0.3 });
export const STAR_SECTIONS = Object.freeze(['situation', 'task', 'action', 'result']);
export const MIN_SECTION_TOKENS = 3;

// Weights of the checks inside a STAR section (sum to 1 per section).
export const STAR_CHECK_WEIGHTS = Object.freeze({
  situation: { length: 0.4, context: 0.4, vague: 0.2 },
  task: { length: 0.5, responsibility: 0.3, vague: 0.2 },
  action: { length: 0.35, ownership: 0.35, vague: 0.3 },
  result: { length: 0.3, concrete: 0.5, vague: 0.2 },
});

// Ideal word range per STAR section, English. Vietnamese is written in syllable-words, so its range is multiplied by VI_LENGTH_FACTOR.
export const STAR_BANDS = Object.freeze({ situation: [10, 60], task: [8, 50], action: [20, 150], result: [8, 80] });
export const VI_LENGTH_FACTOR = 1.4;

export const INTERVIEW_WEIGHTS = Object.freeze({ length: 0.1, relevance: 0.2, specificity: 0.25, ownership: 0.15, starCues: 0.15, hedging: 0.15 });
export const INTERVIEW_BAND = Object.freeze([20, 250]); // ideal word range of an answer (English); a short relevant answer is not failed for length alone
export const INTERVIEW_MIN_TOKENS = 5;
export const RELEVANCE_MIN_NEW_WORDS = 5; // an answer that adds fewer new content words than this cannot score high on overlap (parroting guard)

export const DENSITY_BANDS = Object.freeze([[2, 100], [5, 70], [8, 40]]); // words per 100: up to 2 => 100, up to 5 => 70, up to 8 => 40, else 15
export const DENSITY_FLOOR = 15;

const fp = (o) => {
  const s = JSON.stringify(o);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
};
const asJson = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v instanceof RegExp ? v.source : v)));

// What each score type depends on. The fingerprint changes if any of it changes.
export const rulesOf = (scoreType) => {
  const shared = { EN: asJson(EN), VI: asJson(VI), LANGUAGE_RULES, MIN_TOKENS_FOR_LANGUAGE, DENSITY_BANDS, DENSITY_FLOOR, VI_LENGTH_FACTOR };
  if (scoreType === 'star_structure') return { shared, STAR_WEIGHTS, STAR_CHECK_WEIGHTS, STAR_BANDS, MIN_SECTION_TOKENS };
  return { shared, INTERVIEW_WEIGHTS, INTERVIEW_BAND, INTERVIEW_MIN_TOKENS, RELEVANCE_MIN_NEW_WORDS };
};
export const rulesFingerprint = (scoreType) => fp(rulesOf(scoreType));
