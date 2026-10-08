// Deterministic splitting of an "education" section into entries (degree, institution, year).
// Simpler than experience: education entries are usually short (1-3 lines) and a degree line is easy to
// recognise by keyword, so this is less heuristic-heavy and higher confidence than extractExperiences.
import { nonEmptyLines } from './patterns';
import { parseDate } from './dates';

const emptyFact = (source) => ({ value: null, normalized_value: null, source, evidence: null, confidence: 0, extraction_method: 'rule', requiresInterpretation: true });
const fact = (value, source, evidence, confidence, method = 'rule') =>
  ({ value, normalized_value: null, source, evidence, confidence, extraction_method: method, requiresInterpretation: false });

const DEGREE_RE = /\b(b\.?s\.?c?\.?|m\.?s\.?c?\.?|ph\.?d\.?|b\.?a\.?|m\.?a\.?|m\.?b\.?a\.?|bachelor'?s?|master'?s?|doctorate|associate'?s?|diploma|high school|a-level|cử nhân|thạc sĩ|tiến sĩ)\b/i;
const YEAR_RE = /(?<!\d)(19|20)\d{2}(?!\d)/g;

export function extractEducation(sectionText, source = 'education') {
  const lines = nonEmptyLines(sectionText);
  const degreeLineIdx = lines.map((l, i) => (DEGREE_RE.test(l) ? i : -1)).filter(i => i >= 0);
  if (!degreeLineIdx.length) return [];

  const entries = [];
  for (let k = 0; k < degreeLineIdx.length; k++) {
    const i = degreeLineIdx[k];
    const nextBoundary = k + 1 < degreeLineIdx.length ? degreeLineIdx[k + 1] : lines.length;
    const entrySource = `${source}[${entries.length}]`;

    const degree = fact(lines[i].trim(), `${entrySource}.degree`, lines[i], 0.85);

    // Institution: the non-degree line immediately before or after the degree line, within this entry's
    // span. Prefer the following line (common order: "BSc Computer Science" then "Example University"),
    // fall back to the preceding one.
    let institution = emptyFact(`${entrySource}.institution`);
    const after = lines[i + 1];
    const before = i > 0 ? lines[i - 1] : null;
    if (after && i + 1 < nextBoundary && !DEGREE_RE.test(after) && !YEAR_RE.test(after)) {
      institution = fact(after.trim(), `${entrySource}.institution`, after, 0.6);
      YEAR_RE.lastIndex = 0;
    } else if (before && !DEGREE_RE.test(before) && !degreeLineIdx.includes(i - 1)) {
      institution = fact(before.trim(), `${entrySource}.institution`, before, 0.5);
    }

    // Year: the latest (graduation) year found on the degree line or within this entry's span.
    let year = emptyFact(`${entrySource}.year`);
    const span = lines.slice(i, nextBoundary).join(' ');
    const years = [...span.matchAll(YEAR_RE)].map(m => m[0]);
    if (years.length) {
      const y = years[years.length - 1];
      year = { ...parseDate(y, `${entrySource}.year`), extraction_method: 'regex' };
    }

    entries.push({ degree, institution, year });
  }
  return entries;
}
