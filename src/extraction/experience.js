// Deterministic splitting of an "experience" section into entries (title, company, dates, bullets).
// This is the riskiest extractor in P2: real resumes order title/company either way, on one line or two,
// with the date on either line or its own. Conservative by design: a field is only filled when a rule is
// confident, otherwise it is null with requiresInterpretation = true rather than guessed (see
// docs/AI_ARCHITECTURE_CONTRACT.md and the architecture review in this project's history).
import { nonEmptyLines } from './patterns';
import { findDateRangeInLine } from './dates';

const emptyFact = (source) => ({ value: null, normalized_value: null, source, evidence: null, confidence: 0, extraction_method: 'rule', requiresInterpretation: true });
const fact = (value, source, evidence, confidence, method = 'rule') =>
  ({ value, normalized_value: null, source, evidence, confidence, extraction_method: method, requiresInterpretation: false });

const BULLET_RE = /^[•\-*·►▪○●◦‣⁃§]\s*/;
const isBulletLine = (line) => BULLET_RE.test(line) || /^\t/.test(line) === false && /^\s*[•\-*·►▪○●◦‣⁃§]/.test(line);

// A bare "lead" is deliberately NOT in this list: it reads a title in "Team Lead" but just as often reads
// an unrelated business term in an achievement bullet ("increased lead qualification", "lead generation").
// Only the compound forms that are unambiguously a job title are matched instead.
const TITLE_WORDS = /\b(manager|engineer|developer|analyst|director|team lead|tech(?:nical)? lead|engineering lead|project lead|lead (?:engineer|developer|designer|analyst)|specialist|intern(?:ship)?|assistant|coordinator|designer|consultant|architect|scientist|founder|co-founder|officer|administrator|associate|executive|head of|vp |president|researcher|accountant|recruiter|strategist)\b/i;
// A line in ALL CAPS, or Title Case with no title-keyword and no digits, is more likely a company name.
const looksLikeCompany = (line) => !TITLE_WORDS.test(line) && (line === line.toUpperCase() || /^[\p{Lu}][\p{Ll}&.,'-]*(\s+[\p{Lu}&][\p{Ll}&.,'-]*)*$/u.test(line.replace(/\s*\(.*\)\s*$/, '')));

// Classifies the two header lines of one entry (order on the page unknown) into { title, company }.
// Confident only when exactly one line is title-shaped and the other is not (or looks company-shaped).
function classifyHeaderLines(lines, source) {
  if (lines.length === 0) return { title: emptyFact(`${source}.title`), company: emptyFact(`${source}.company`) };
  if (lines.length === 1) {
    // Single header line: "Title, Company" or "Title at Company" or "Title — Company" are common.
    const m = lines[0].match(/^(.+?)\s*(?:,|\bat\b|[—–-])\s*(.+)$/i);
    if (m && (TITLE_WORDS.test(m[1]) || !TITLE_WORDS.test(m[2]))) {
      return { title: fact(m[1].trim(), `${source}.title`, lines[0], 0.7), company: fact(m[2].trim(), `${source}.company`, lines[0], 0.6) };
    }
    return { title: fact(lines[0], `${source}.title`, lines[0], 0.4), company: emptyFact(`${source}.company`) };
  }
  const [a, b] = lines;
  const aTitle = TITLE_WORDS.test(a), bTitle = TITLE_WORDS.test(b);
  if (aTitle && !bTitle) return { title: fact(a, `${source}.title`, a, 0.85), company: fact(b, `${source}.company`, b, 0.7) };
  if (bTitle && !aTitle) return { title: fact(b, `${source}.title`, b, 0.85), company: fact(a, `${source}.company`, a, 0.7) };
  if (!aTitle && !bTitle && looksLikeCompany(a) && !looksLikeCompany(b)) return { title: fact(b, `${source}.title`, b, 0.5), company: fact(a, `${source}.company`, a, 0.5) };
  if (!aTitle && !bTitle && looksLikeCompany(b) && !looksLikeCompany(a)) return { title: fact(a, `${source}.title`, a, 0.5), company: fact(b, `${source}.company`, b, 0.5) };
  // Both or neither look like a title: genuinely ambiguous, do not guess which is which.
  return { title: emptyFact(`${source}.title`), company: emptyFact(`${source}.company`) };
}

// sectionText is the body of the "experience" section (from splitSections). An entry starts at a line
// that contains a date range (the strongest, most reliable signal a resume line is an entry's header);
// the 1-2 non-bullet lines immediately before it (since P1 often tabs the date onto the SAME line as the
// title/company, or the date sits on the line right after) are its title/company candidates.
export function extractExperiences(sectionText, source = 'experiences') {
  const lines = nonEmptyLines(sectionText);
  const dateLineIdx = [];
  const dateByLine = [];
  lines.forEach((line, i) => {
    const d = findDateRangeInLine(line);
    if (d) { dateLineIdx.push(i); dateByLine[i] = d; }
  });
  if (!dateLineIdx.length) return [];

  const entries = [];
  for (let k = 0; k < dateLineIdx.length; k++) {
    const i = dateLineIdx[k];
    const prevBoundary = k > 0 ? dateLineIdx[k - 1] + 1 : 0;
    const nextBoundary = k + 1 < dateLineIdx.length ? dateLineIdx[k + 1] : lines.length;
    const entrySource = `${source}[${entries.length}]`;

    // Header candidates: non-bullet lines around the date line, on EITHER side (title/company land
    // before it, after it, or share its line with a tab, depending on the resume's own order). The date
    // text itself is stripped from its line (it may share the line with a title/company, joined by a tab
    // from P1's wide-gap handling); a parenthesis left empty by that removal, e.g. "Acme Ltd ()", is
    // cleaned up too.
    //
    // Where bullets start: if ANY line after the date has a bullet glyph, that is a reliable boundary —
    // everything before it (and not itself a bullet line) is a header candidate. Some resumes format
    // achievements as plain indented lines with NO bullet glyph at all (seen in a real Canva-style
    // export): there, a glyph-based search finds nothing and must not be allowed to swallow the whole
    // entry as "header". In that case at most ONE line right after the date counts as a header
    // continuation (e.g. a company name on its own line); everything else is content.
    const dateLineClean = lines[i].replace(dateByLine[i].matchedText, '').replace(/\t/g, ' ').replace(/\(\s*\)/g, '').trim();
    let bulletsStart = -1;
    for (let j = i + 1; j < nextBoundary; j++) if (isBulletLine(lines[j])) { bulletsStart = j; break; }
    if (bulletsStart === -1) {
      // No bullet glyph anywhere in this entry: the line right after the date is taken as a header
      // continuation (e.g. a company name on its own line) only when it actually looks like one — short,
      // not ending in sentence punctuation, and title- or company-shaped. Otherwise it is content like
      // any other, so a plain achievement sentence is never mistaken for a company name.
      const next = i + 1 < nextBoundary ? lines[i + 1] : null;
      const looksHeaderish = next && next.length <= 50 && !/[.!?]$/.test(next.trim()) && (TITLE_WORDS.test(next) || looksLikeCompany(next));
      bulletsStart = looksHeaderish ? i + 2 : i + 1;
    }

    const headerLines = [];
    for (let j = prevBoundary; j < bulletsStart; j++) {
      if (j === i) { if (dateLineClean) headerLines.push(dateLineClean); }
      else if (!isBulletLine(lines[j])) headerLines.push(lines[j]);
    }
    const { title, company } = classifyHeaderLines(headerLines.slice(-2), entrySource);

    const bullets = [];
    for (let j = bulletsStart; j < nextBoundary; j++) {
      const text = lines[j].replace(BULLET_RE, '').trim();
      if (text) bullets.push(fact(text, `${entrySource}.bullets[${bullets.length}]`, lines[j], 0.8, 'structure'));
    }

    entries.push({
      title, company,
      start: { ...dateByLine[i].range.start, source: `${entrySource}.start` },
      end: { ...dateByLine[i].range.end, source: `${entrySource}.end` },
      bullets,
    });
  }
  return entries;
}
