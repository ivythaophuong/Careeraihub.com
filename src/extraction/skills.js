// Deterministic extraction of a skills list from a resume's "skills" section. No AI.
import { nonEmptyLines } from './patterns';

const fact = (value, source, evidence, confidence = 0.85, method = 'rule') =>
  ({ value, normalized_value: value.toLowerCase(), source, evidence, confidence, extraction_method: method, requiresInterpretation: false });

const BULLET_PREFIX = /^[•\-*·►▪○●◦‣⁃§]\s*/;
const CATEGORY_LABEL = /^[\p{L} ]{2,30}:\s*/u; // "Languages: ", "Frameworks: "

// A skills section can be: one item per line, bullet lines, or a comma/pipe/middledot-separated list
// (with or without a leading "Category: " label, which is dropped rather than treated as a skill).
export function extractSkills(sectionText, source = 'skills') {
  const items = [];
  const seen = new Set();
  const add = (raw, evidenceLine) => {
    const v = raw.trim().replace(/[.,;]+$/, '');
    if (!v || v.length > 60) return;
    const key = v.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push(fact(v, `${source}[${items.length}]`, evidenceLine));
  };
  for (const rawLine of nonEmptyLines(sectionText)) {
    const line = rawLine.replace(BULLET_PREFIX, '').replace(CATEGORY_LABEL, '');
    if (!line) continue;
    const pieces = line.split(/,|\||·|•/).map(s => s.trim()).filter(Boolean);
    if (pieces.length > 1) pieces.forEach(p => add(p, rawLine));
    else add(line, rawLine);
  }
  return items;
}
