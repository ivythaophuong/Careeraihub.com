// Shared "did the AI add numbers the user never gave it?" guard (STAR Builder, Salary Coach, ...).
// Pure functions, no UI.

const MULT = { k: 1e3, thousand: 1e3, m: 1e6, mm: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 };
// Thousands groups must be exactly three digits, so "$120,000, a 12%" does not swallow the trailing comma.
const NUM_RE = /\$?\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s?(%|(?:percent|pct|thousand|million|billion|bn|mm|k|m|b)\b))?/gi;
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };

// Canonical keys for every number in a text: "15 percent" and "15%" both → "15%", "2M" and
// "2,000,000" and "2 million" all → "2000000".
export function numberKeys(text) {
  const keys = new Set();
  for (const m of String(text).matchAll(NUM_RE)) {
    const base = parseFloat(m[1].replace(/,/g, ''));
    if (!Number.isFinite(base)) continue;
    const unit = (m[2] || '').toLowerCase();
    if (unit === '%' || unit === 'percent' || unit === 'pct') keys.add(`${base}%`);
    else keys.add(String(base * (MULT[unit] || 1)));
  }
  // "three" in the candidate's text should make "3" acceptable in the rewrite.
  for (const w of String(text).toLowerCase().match(/\b[a-z]+\b/g) || []) if (WORDS[w]) keys.add(String(WORDS[w]));
  return keys;
}

// Numbers that appear in `outputText` but not in `sourceText` (the facts the user supplied).
// Returns the offending strings as written, each once.
//
// moneyOnly: ignore plain small numbers like "48 hours" or "step 2" and years like 2025; only
// check amounts that look like money or rates (currency symbol, %, k/m/b, or 1,000 and up).
export function findUnsupportedNumbers(sourceText, outputText, { moneyOnly = false } = {}) {
  const allowed = numberKeys(sourceText);
  const out = new Set();
  for (const m of String(outputText).matchAll(NUM_RE)) {
    const base = parseFloat(m[1].replace(/,/g, ''));
    if (!Number.isFinite(base)) continue;
    const unit = (m[2] || '').toLowerCase();
    if (moneyOnly) {
      const looksLikeMoney = unit !== '' || /^\$/.test(m[0]) || base >= 1000;
      const looksLikeYear = unit === '' && !m[1].includes(',') && /^(19|20)\d\d$/.test(m[1]);
      if (!looksLikeMoney || looksLikeYear) continue;
    }
    const key = unit === '%' || unit === 'percent' || unit === 'pct' ? `${base}%` : String(base * (MULT[unit] || 1));
    if (!allowed.has(key)) out.add(m[0].trim());
  }
  return [...out];
}
