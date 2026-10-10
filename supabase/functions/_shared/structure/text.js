// Text helpers for the structure scores. Pure and deterministic: the same string always gives the same tokens.
import { EN } from './lexicon.en.js';
import { VI } from './lexicon.vi.js';

const LEX = { en: EN, vi: VI };
export const lexiconFor = (lang) => LEX[lang];

// Unicode-normalised (NFC, so "ế" is one form however it was typed), lower-cased.
export const norm = (s) => String(s ?? '').normalize('NFC').toLowerCase();
export const tokenize = (s) => norm(s).split(/[^\p{L}\p{N}%$₫]+/u).filter(Boolean);

// "ummmm" and "umm" both become "um"; used only to compare filler words.
export const squeeze = (w) => w.replace(/(.)\1+/gu, '$1');

// Counts non-overlapping occurrences of the phrases (longest first) in a token array. Returns { count, used } where used flags consumed tokens.
export function countPhrases(tokens, phrases, used = new Array(tokens.length).fill(false)) {
  const list = phrases.map((p) => tokenize(p)).filter((p) => p.length).sort((a, b) => b.length - a.length);
  let count = 0;
  for (const p of list) {
    for (let i = 0; i + p.length <= tokens.length; i++) {
      if (used.slice(i, i + p.length).some(Boolean)) continue;
      if (p.every((w, k) => tokens[i + k] === w)) { count++; for (let k = 0; k < p.length; k++) used[i + k] = true; i += p.length - 1; }
    }
  }
  return { count, used };
}

export const hasPhrase = (tokens, phrases) => countPhrases(tokens, phrases).count > 0;

// ── Language ────────────────────────────────────────────────────────────────────────────────────────────────────────
const VI_MARKS = /[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/u;
const EN_STOP = new Set(EN.stop);
const VI_STOP = new Set(VI.stop);
export const MIN_TOKENS_FOR_LANGUAGE = 4;
export const LANGUAGE_RULES = Object.freeze({ minFunctionWordShare: 0.15, dominantShare: 0.7, minLatinLetterShare: 0.5, minLettersForScript: 4 });

// True when the letters are mostly not Latin script (Chinese, Thai, Arabic...). Such text is unsupported whatever its length: it must not fall into
// 'too short' just because it has no spaces between words.
export function usesUnsupportedScript(text) {
  const letters = String(text ?? '').normalize('NFC').match(/\p{L}/gu) || [];
  if (letters.length < LANGUAGE_RULES.minLettersForScript) return false;
  const latin = letters.filter((c) => /\p{Script=Latin}/u.test(c)).length;
  return latin / letters.length < LANGUAGE_RULES.minLatinLetterShare;
}

// Returns { language: 'en' | 'vi' | 'mixed' | 'other' | 'unknown', evidence }.
//   unknown : too short to tell (not an error: the caller reports insufficient data)
//   other   : not enough English or Vietnamese function words (another language, or random text)
//   mixed   : both present and neither clearly dominant (code-switching between full sentences)
// English technical words inside a Vietnamese sentence do not matter: only function words (and, the, và, của...) are counted.
export function detectLanguage(text) {
  const tokens = tokenize(text);
  const evidence = { tokens: tokens.length, enHits: 0, viHits: 0, viMarked: 0 };
  if (usesUnsupportedScript(text)) return { language: 'other', evidence };
  if (tokens.length < MIN_TOKENS_FOR_LANGUAGE) return { language: 'unknown', evidence };
  for (const t of tokens) {
    if (EN_STOP.has(t)) evidence.enHits++;
    if (VI_STOP.has(t)) evidence.viHits++;
    if (VI_MARKS.test(t)) evidence.viMarked++;
  }
  const en = evidence.enHits;
  const vi = evidence.viHits + evidence.viMarked * 0.5;
  const total = en + vi;
  if (total / tokens.length < LANGUAGE_RULES.minFunctionWordShare) return { language: 'other', evidence };
  const share = Math.max(en, vi) / total;
  if (share < LANGUAGE_RULES.dominantShare) return { language: 'mixed', evidence };
  return { language: vi > en ? 'vi' : 'en', evidence };
}

// ── Numbers and names ───────────────────────────────────────────────────────────────────────────────────────────────
const STRONG = [
  /\d[\d.,]*\s?(?:%|percent|per cent|phần trăm|x\b)/giu,
  /[$€£₫]\s?\d[\d.,]*/giu,
  /\d[\d.,]*\s?(?:usd|vnd|eur|dollars?|đô|đồng|triệu|tỷ|nghìn|ngàn|million|billion|thousand)\b/giu,
  /\d[\d.,]*\s?(?:users?|customers?|clients?|people|members?|employees?|hours?|days?|weeks?|months?|years?|minutes?|projects?|tickets?|orders?|leads?|sales|requests?|người|khách hàng|nhân viên|thành viên|giờ|ngày|tuần|tháng|năm|phút|dự án|đơn|lượt)(?![\p{L}])/giu,
];
const BARE = /(?<![\p{L}\p{N}.,])\d[\d.,]*(?![\p{L}\p{N}])/gu;

// Quantity signals. A 4-digit year is not a quantity. A number is a structural signal, never proof that the claim is true.
export function metricSignals(text) {
  const s = String(text ?? '');
  const strong = new Set();
  for (const re of STRONG) for (const m of s.matchAll(re)) strong.add(m[0].toLowerCase().replace(/\s+/g, ''));
  const covered = [...s.matchAll(new RegExp(STRONG.map((r) => r.source).join('|'), 'giu'))].map((m) => [m.index, m.index + m[0].length]);
  const weak = new Set();
  for (const m of s.matchAll(BARE)) {
    const n = Number(m[0].replace(/[.,]/g, ''));
    const isYear = /^(19|20)\d\d$/.test(m[0]);
    const inside = covered.some(([a, b]) => m.index >= a && m.index < b);
    if (!isYear && !inside && Number.isFinite(n)) weak.add(m[0]);
  }
  return { strong: strong.size, weak: weak.size };
}

const IGNORE_CAPS = new Set(['OK', 'I', 'A', 'AM', 'PM']);
// Proper nouns and tool names: capitalised words that do not start a sentence, plus ALL-CAPS words (SQL, KPI, AWS). Distinct, case-insensitive.
export function namedThings(text) {
  const s = String(text ?? '').normalize('NFC');
  const found = new Set();
  for (const m of s.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’+#.-]*/gu)) {
    const w = m[0].replace(/[.'’-]+$/u, '');
    if (w.length < 2 || IGNORE_CAPS.has(w)) continue;
    const before = s.slice(0, m.index).trimEnd();
    const sentenceStart = before === '' || /[.!?:;\n]$/u.test(before);
    const allCaps = /^[\p{Lu}\p{N}+#]+$/u.test(w) && /\p{Lu}/u.test(w);
    const camel = /^\p{Ll}+\p{Lu}/u.test(w);
    const capital = /^\p{Lu}/u.test(w) && !sentenceStart;
    if (allCaps || camel || capital) found.add(w.toLowerCase());
  }
  return found;
}

export const wordCount = (text) => tokenize(text).length;
