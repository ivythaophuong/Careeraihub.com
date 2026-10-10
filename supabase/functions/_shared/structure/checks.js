// The individual checks. Each returns { score: 0-100 | null, value: counts, note }. Pure and deterministic.
import { countPhrases, hasPhrase, lexiconFor, metricSignals, namedThings, squeeze, tokenize } from './text.js';
import { DENSITY_BANDS, DENSITY_FLOOR, VI_LENGTH_FACTOR } from './rules.js';

// Length: a range, not "longer is better". Padding (many repeated words) caps the score.
export function lengthCheck(tokens, [min, max], lang) {
  const f = lang === 'vi' ? VI_LENGTH_FACTOR : 1;
  const lo = Math.round(min * f), hi = Math.round(max * f);
  const w = tokens.length;
  let score = w < lo * 0.5 ? 20 : w < lo ? 60 : w <= hi ? 100 : w <= hi * 1.5 ? 70 : 40;
  let note = '';
  const unique = new Set(tokens).size;
  if (w >= 30 && unique / w < 0.4) { score = Math.min(score, 40); note = 'many repeated words'; }
  return { score, value: { words: w, idealMin: lo, idealMax: hi, uniqueWordShare: w ? Math.round((unique / w) * 100) / 100 : null }, note };
}

// Density of vague, hedging or filler wording per 100 words.
export function densityScore(count, words) {
  if (!words) return null;
  const per100 = (count * 100) / words;
  const hit = DENSITY_BANDS.find(([limit]) => per100 <= limit);
  return hit ? hit[1] : DENSITY_FLOOR;
}

export function vagueCheck(tokens, lang) {
  const { count } = countPhrases(tokens, lexiconFor(lang).vague);
  return { score: densityScore(count, tokens.length), value: { vagueWords: count, per100: Math.round((count * 1000) / Math.max(1, tokens.length)) / 10 }, note: '' };
}

// Who acts: first-person singular against team wording. This is wording, not proof of who really did the work.
export function ownershipCheck(tokens, lang) {
  const lex = lexiconFor(lang);
  const { count: team, used } = countPhrases(tokens, lex.team);
  const singular = tokens.reduce((n, t, i) => n + (!used[i] && lex.firstSingular.includes(t) ? 1 : 0), 0);
  if (singular + team === 0) return { score: 40, value: { singular, team }, note: 'no explicit actor' };
  const share = singular / (singular + team);
  return { score: Math.round(35 + 65 * share), value: { singular, team }, note: singular === 0 ? 'team wording only' : '' };
}

// A number is a structural signal ("there is something countable"), never proof that it is true or meaningful.
export function concreteCheck(text) {
  const m = metricSignals(text);
  return { score: m.strong > 0 ? 100 : m.weak > 0 ? 60 : 40, value: m, note: '' };
}

const MONTHS_NO_MAY = ['january','february','march','april','june','july','august','september','october','november','december'];
export function contextCheck(text, tokens, lang) {
  const lex = lexiconFor(lang);
  const time = /\b(?:19|20)\d\d\b/.test(text) || /(?:năm|tháng|quý)\s*\d+/iu.test(text) || tokens.some((t) => MONTHS_NO_MAY.includes(t)) || hasPhrase(tokens, lex.context.time);
  const place = hasPhrase(tokens, lex.context.place);
  const scale = metricSignals(text).strong > 0;
  const present = [time, place, scale].filter(Boolean).length;
  return { score: present === 0 ? 30 : present === 1 ? 65 : 100, value: { time, place, scale }, note: '' };
}

export const responsibilityCheck = (tokens, lang) => {
  const ok = hasPhrase(tokens, lexiconFor(lang).responsibility);
  return { score: ok ? 100 : 40, value: { cuePresent: ok }, note: '' };
};

// Which of the four STAR cue groups appear in an answer.
export function starCueCheck(tokens, lang) {
  const lex = lexiconFor(lang);
  const text = tokens.join(' ');
  const action = lang === 'en'
    ? lex.actionPattern.test(text)
    : hasPhrase(tokens, lex.actors.flatMap((a) => lex.actionVerbs.map((v) => `${a} ${v}`)));
  const present = {
    situation: hasPhrase(tokens, lex.starCues.situation),
    task: hasPhrase(tokens, lex.starCues.task),
    action,
    result: hasPhrase(tokens, lex.starCues.result),
  };
  const n = Object.values(present).filter(Boolean).length;
  return { score: [20, 40, 65, 85, 100][n], value: present, note: 'cue phrases only; an answer can be relevant without following STAR' };
}

// Hedging and filler words per 100 words. Variants such as "ummm" count as "um".
export function hedgingCheck(tokens, lang) {
  const lex = lexiconFor(lang);
  const sq = tokens.map(squeeze);
  const phrases = [...lex.hedge, ...lex.filler].map(squeeze);
  const { count } = countPhrases(sq, phrases);
  return { score: densityScore(count, tokens.length), value: { hedgeOrFiller: count, per100: Math.round((count * 1000) / Math.max(1, tokens.length)) / 10 }, note: '' };
}

export function specificityCheck(text) {
  const m = metricSignals(text);
  const names = namedThings(text);
  const items = m.strong + m.weak + names.size;
  return { score: items === 0 ? 20 : items === 1 ? 50 : items === 2 ? 75 : 100, value: { numbers: m.strong + m.weak, namedThings: names.size }, note: 'names and numbers show detail, not correctness' };
}

// Weak relevance signal: shared content words between question and answer. Parroting the question without adding words cannot score high.
export function relevanceCheck(questionText, answerTokens, lang, minNewWords) {
  const stop = new Set(lexiconFor(lang).stop);
  const content = (ts) => [...new Set(ts.filter((t) => t.length >= 2 && !stop.has(t) && !/^\d+$/.test(t)))];
  const q = content(tokenize(questionText));
  if (!q.length) return { score: null, value: { questionWords: 0 }, note: 'no question words to compare' };
  const a = new Set(content(answerTokens));
  const shared = q.filter((w) => a.has(w)).length;
  const novel = [...a].filter((w) => !q.includes(w)).length;
  let score = Math.max(20, Math.min(100, Math.round((shared / q.length) * 200)));
  let note = 'lexical overlap is a weak signal';
  if (novel < minNewWords) { score = Math.min(score, 30); note = 'few words beyond the question'; }
  return { score, value: { questionWords: q.length, sharedWords: shared, newWords: novel }, note };
}
