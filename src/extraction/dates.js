// Deterministic parsing of resume dates and date ranges. No AI. Normalised form is "YYYY-MM" when a
// month is known, "YYYY" when only a year is known, or "present" for an ongoing role.
const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11,
  november: 11, dec: 12, december: 12,
};
const PRESENT = /^(present|current|now|ongoing|hiện tại|hien tai|đang làm|dang lam)$/i;
// Built from MONTHS so "a real month name" means the same thing everywhere it is checked, instead of
// accepting any run of letters before a 4-digit number (which used to also match "Ltd\t2021").
const MONTH_NAME_SRC = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const MONTH_YEAR_RE = new RegExp(`(?:${MONTH_NAME_SRC})\\.?\\s+\\d{4}`, 'i');

const fact = (value, source, evidence, confidence, normalized_value) =>
  ({ value, normalized_value, source, evidence, confidence, extraction_method: 'regex', requiresInterpretation: false });
const empty = (source) => ({ value: null, normalized_value: null, source, evidence: null, confidence: 0, extraction_method: 'regex', requiresInterpretation: true });

// Parses ONE date token (not a range). Returns a Fact.
export function parseDate(token, source = 'date') {
  const t = String(token || '').trim();
  if (!t) return empty(source);
  if (PRESENT.test(t)) return fact(t, source, t, 0.95, 'present');

  // "January 2020", "Jan 2020", "Jan. 2020" (optional trailing '.'); the month must be a real month name.
  let m = t.match(/^([A-Za-zÀ-ỹ]+)\.?\s+(\d{4})$/);
  if (m && MONTHS[m[1].toLowerCase()]) {
    const mo = MONTHS[m[1].toLowerCase()];
    return fact(t, source, t, 0.95, `${m[2]}-${String(mo).padStart(2, '0')}`);
  }
  // "2020 January" / "2020, Jan" (less common, some non-English resumes)
  m = t.match(/^(\d{4})[,\s]+([A-Za-zÀ-ỹ]+)\.?$/);
  if (m && MONTHS[m[2].toLowerCase()]) {
    const mo = MONTHS[m[2].toLowerCase()];
    return fact(t, source, t, 0.9, `${m[1]}-${String(mo).padStart(2, '0')}`);
  }
  // "01/2020", "1-2020", "2020/01", "2020-01" (MM/YYYY or YYYY/MM; ambiguous DD/MM vs MM/DD is not at
  // stake here since the second group is a 4-digit year, not a day)
  m = t.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return fact(t, source, t, 0.85, `${m[2]}-${m[1].padStart(2, '0')}`);
  m = t.match(/^(\d{4})[/.-](\d{1,2})$/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return fact(t, source, t, 0.85, `${m[1]}-${m[2].padStart(2, '0')}`);
  // Year only
  m = t.match(/^(19|20)\d{2}$/);
  if (m) return fact(t, source, t, 0.75, t);

  return empty(source);
}

// A dash followed by whitespace is a range separator in a resume; a bare hyphen inside one date token
// ("03-2020") must not be mistaken for one, so ranges are only split on a dash with space on both sides,
// or an en/em dash with or without spaces (restoreSoftHyphens in P1 produces "... - ..." with spaces).
const RANGE_SPLIT = /\s+[-–—]\s+|[–—]/;

// Parses "Jan 2020 - Mar 2024", "2021 – Present", a single date (end left empty, requiresInterpretation),
// or nothing found. Returns { start: Fact, end: Fact }.
export function parseDateRange(text, source = 'dates') {
  const t = String(text || '').trim();
  if (!t) return { start: empty(`${source}.start`), end: empty(`${source}.end`) };
  const parts = t.split(RANGE_SPLIT).map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { start: parseDate(parts[0], `${source}.start`), end: parseDate(parts[parts.length - 1], `${source}.end`) };
  }
  const start = parseDate(t, `${source}.start`);
  return { start, end: empty(`${source}.end`) };
}

// Finds the first date-range-shaped run in a line of text (e.g. a tab-separated trailing date on an
// experience line) and returns { range: {start,end}, matchedText } or null if nothing looks like a date.
const DATE_TOKEN_SRC = `${MONTH_YEAR_RE.source}|(?:\\d{1,2}[/.-])?\\d{4}|present|current|now|hiện tại`;
const SCAN_RE = new RegExp(`((?:${DATE_TOKEN_SRC})\\s*[-–—]\\s*(?:${DATE_TOKEN_SRC}))|((?<!\\d)(?:19|20)\\d{2}(?!\\d))`, 'i');
export function findDateRangeInLine(line, source = 'dates') {
  const m = SCAN_RE.exec(String(line || ''));
  if (!m) return null;
  const matchedText = m[0];
  return { range: parseDateRange(matchedText, source), matchedText };
}
