// Deterministic detection of quantified impact in resume bullets: percentages, money, counts with a
// unit/multiplier, and plain numbers. Used both as a fact list and to COUNT metrics for scoring (P4),
// which is why findMetrics returns one match per bullet rather than a yes/no.
const fact = (value, source, evidence, confidence, normalized_value) =>
  ({ value, normalized_value, source, evidence, confidence, extraction_method: 'regex', requiresInterpretation: false });

// Order matters: a currency+number ("$1.2M") must be tried before a bare number, and a percentage before
// a bare number, so the richer match wins when they overlap.
const PATTERNS = [
  { kind: 'percent', re: /[+-]?\d+(?:\.\d+)?\s?(?:%|per\s?cent\b|percent\b)/i, confidence: 0.95 },
  { kind: 'money', re: /(?:[$€£₫¥]\s?\d[\d,.]*\s?(?:[kKmMbB](?:n)?)?|\d[\d,.]*\s?(?:USD|EUR|GBP|VND|SGD))/, confidence: 0.9 },
  { kind: 'multiplier', re: /\b\d+(?:\.\d+)?\s?[xX]\b/, confidence: 0.85 },
  { kind: 'count_with_unit', re: /\b\d[\d,]*(?:\.\d+)?\s?(?:k|K|million|billion|hours?|days?|weeks?|months?|years?|users?|customers?|clients?|people|engineers?|members?|teams?|countries?|markets?|stores?|projects?)\b/, confidence: 0.75 },
  { kind: 'number', re: /(?<![\w.])\d{1,3}(?:,\d{3})*(?:\.\d+)?(?![\w%])/, confidence: 0.5 },
];

const normalizePercent = (s) => { const n = parseFloat(s); return Number.isFinite(n) ? n / 100 : null; };
const normalizeNumber = (s) => { const n = parseFloat(s.replace(/,/g, '')); return Number.isFinite(n) ? n : null; };

// A year (2021, 1999...) inside what otherwise looks like a date, not an achievement number, is excluded
// so experience dates are not double-counted as "metrics" when this runs over a whole bullet.
const LOOKS_LIKE_YEAR = /^(19|20)\d{2}$/;

export function findMetricsInText(text, source = 'metrics') {
  const t = String(text || '');
  const found = [];
  for (const { kind, re, confidence } of PATTERNS) {
    const g = new RegExp(re.source, 'g');
    let m;
    while ((m = g.exec(t))) {
      const v = m[0];
      if (kind === 'number' && LOOKS_LIKE_YEAR.test(v.trim())) continue;
      if (found.some(f => m.index >= f.start && m.index < f.end)) continue; // already covered by a richer pattern
      const normalized = kind === 'percent' ? normalizePercent(v) : (kind === 'number' ? normalizeNumber(v) : null);
      found.push({ start: m.index, end: m.index + v.length, fact: fact(v.trim(), `${source}[${found.length}]`, v.trim(), confidence, normalized), kind });
    }
  }
  found.sort((a, b) => a.start - b.start);
  return found.map(f => ({ ...f.fact, source: `${source}[${found.indexOf(f)}]` }));
}

// One bullet -> its best metric, or null. Used to count "bullets with a metric" without double-counting
// a bullet that happens to contain two numbers.
export function bulletHasMetric(bulletText) {
  const found = findMetricsInText(bulletText);
  return found.length > 0 ? found[0] : null;
}
