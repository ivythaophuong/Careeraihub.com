// Guards AI-written resume text against numbers the candidate never supplied.
// A rewrite may only reuse figures that already appear in the resume; any other figure becomes a [X] blank
// the candidate has to fill with a real value. Scope or ownership inflation ("Owned", "automated") cannot be
// detected here, so the prompt carries that rule and the card shows an "AI draft" notice.

const NUMBER_WORDS = 'two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|thousand|million|billion|dozen';

// A figure: 40, 40%, 1,200, 2.5, $2M, 20+, 3x, or a spelled-out number. Digits glued to letters (Q4, H2, 5G) are not figures.
const TOKEN = new RegExp(
  `(?<![A-Za-z\\d])\\$?\\d[\\d,]*(?:\\.\\d+)?(?:%|[kKmMbB]\\b|\\+|[xX]\\b)?(?![A-Za-z\\d])|\\b(?:${NUMBER_WORDS})\\b`,
  'gi',
);

export const PLACEHOLDER = '[X]';
const PLACEHOLDER_RE = /\[[XY]\]/;

const isYear = (core) => /^(19|20)\d{2}$/.test(core);

// The comparable part of a figure: "$2M" -> "2", "1,200" -> "1200", "Five" -> "five".
const core = (token) => {
  const t = token.toLowerCase();
  if (/^[a-z]+$/.test(t)) return t;
  return t.replace(/[$,]/g, '').replace(/[^\d.]/g, '');
};

const sourceFigures = (source) => {
  const set = new Set();
  for (const m of String(source || '').matchAll(TOKEN)) set.add(core(m[0]));
  return set;
};

// Replace every figure in `text` that is not present in `source` with [X], keeping a leading $ and a trailing % or x.
export function neutralizeInventedFigures(text, source) {
  const known = sourceFigures(source);
  const replaced = [];
  const out = String(text || '').replace(TOKEN, (tok) => {
    const c = core(tok);
    if (known.has(c) || isYear(c)) return tok;
    replaced.push(tok);
    const prefix = tok.startsWith('$') ? '$' : '';
    const suffix = /[%xX]$/.test(tok) ? tok.slice(-1) : '';
    return `${prefix}${PLACEHOLDER}${suffix}`;
  });
  return { text: out, changed: replaced.length > 0, replaced };
}

export const hasPlaceholder = (text) => PLACEHOLDER_RE.test(String(text || ''));

// Put back the passage a fix replaced. Returns null when the inserted text can no longer be found
// (the candidate rewrote it by hand), so the caller can say so instead of claiming it was undone.
export function revertInsertion(text, record) {
  const pos = String(text || '').indexOf(record.inserted);
  if (pos === -1) return null;
  return text.slice(0, pos) + record.original + text.slice(pos + record.inserted.length);
}
