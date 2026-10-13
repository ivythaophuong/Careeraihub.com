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

// Periods that are on a resume but are not employment.
const NOT_A_JOB = /^(?:career (?:break|gap)|sabbatical|gap year|time off|(?:maternity|paternity|parental|family|medical|study) leave|leave of absence|break from work)\b/i;
// The header row of a table of jobs ("Role  Employer  Dates", "| Position | Company | Period |"): only column names, nothing else.
const TABLE_HEADER_ROW = /^(?:[|\s,/:]*(?:job title|role|title|position|employer|company|organi[sz]ation|dates?|period|duration|location|from|to)\b)+[|\s,/:]*$/i;
const BULLET_RE = /^[•\-*·►▪○●◦‣⁃§]\s*/;
const isBulletLine = (line) => BULLET_RE.test(line) || /^\t/.test(line) === false && /^\s*[•\-*·►▪○●◦‣⁃§]/.test(line);

// A bare "lead" is deliberately NOT in this list: it reads a title in "Team Lead" but just as often reads
// an unrelated business term in an achievement bullet ("increased lead qualification", "lead generation").
// Only the compound forms that are unambiguously a job title are matched instead.
const TITLE_WORDS = /\b(manager|engineer|developer|analyst|director|team lead|tech(?:nical)? lead|engineering lead|project lead|lead (?:engineer|developer|designer|analyst)|specialist|intern(?:ship)?|assistant|coordinator|designer|consultant|architect|scientist|founder|co-founder|officer|administrator|associate|executive|head of|vp |president|researcher|accountant|recruiter|strategist|copywriter|writer|editor|producer|supervisor|representative|technician|teacher|instructor|lecturer|clerk|cashier|auditor|advisor|adviser|planner|buyer|nurse|paralegal|attorney|trainer)\b/i;
// "<Area> Lead" at the end of a line ("Operations Lead") is a title; a bare "lead" in the middle of a sentence is not ("lead generation").
const LEAD_AT_END = /(?:^|\s)[A-Z][A-Za-z&]+ Lead$/;
const isTitleShaped = (line) => TITLE_WORDS.test(line) || LEAD_AT_END.test(String(line).trim());
// A line in ALL CAPS, or Title Case with no title-keyword and no digits, is more likely a company name.
const looksLikeCompany = (line) => !isTitleShaped(line) && (line === line.toUpperCase() || /^[\p{Lu}][\p{Ll}&.,'-]*(\s+[\p{Lu}&][\p{Ll}&.,'-]*)*$/u.test(line.replace(/\s*\(.*\)\s*$/, '')));

// Classifies the two header lines of one entry (order on the page unknown) into { title, company }.
// Confident only when exactly one line is title-shaped and the other is not (or looks company-shaped).
function classifyHeaderLines(lines, source) {
  if (lines.length === 0) return { title: emptyFact(`${source}.title`), company: emptyFact(`${source}.company`) };
  if (lines.length === 1) {
    // Single header line: "Title, Company", "Title at Company", "Title — Company" or "Company — Title".
    const m = lines[0].match(/^(.+?)(?:\s*,\s*|\s+at\s+|\s*[—–|]\s*|\s+-\s+)(.+)$/i);
    if (m) {
      const sep = lines[0].slice(m[1].length, lines[0].length - m[2].length);
      const isAt = /^\s+at\s+$/i.test(sep), isDash = /[—–|-]/.test(sep);
      const t1 = isTitleShaped(m[1]), t2 = isTitleShaped(m[2]);
      if (t1) return { title: fact(m[1].trim(), `${source}.title`, lines[0], 0.7), company: fact(m[2].trim(), `${source}.company`, lines[0], 0.6) };
      if (t2 && !isAt) return { title: fact(m[2].trim(), `${source}.title`, lines[0], 0.65), company: fact(m[1].trim(), `${source}.company`, lines[0], 0.6) };
      // Neither side is title-shaped. After a comma or "at" the usual order is "Title, Company"; after a dash either order is common, so do not guess.
      if (isDash) return { title: emptyFact(`${source}.title`), company: emptyFact(`${source}.company`) };
      return { title: fact(m[1].trim(), `${source}.title`, lines[0], 0.7), company: fact(m[2].trim(), `${source}.company`, lines[0], 0.6) };
    }
    return { title: fact(lines[0], `${source}.title`, lines[0], isTitleShaped(lines[0]) ? 0.6 : 0.4), company: emptyFact(`${source}.company`) };
  }
  const [a, b] = lines;
  const aTitle = isTitleShaped(a), bTitle = isTitleShaped(b);
  if (aTitle && !bTitle) return { title: fact(a, `${source}.title`, a, 0.85), company: fact(b, `${source}.company`, b, 0.7) };
  if (bTitle && !aTitle) return { title: fact(b, `${source}.title`, b, 0.85), company: fact(a, `${source}.company`, a, 0.7) };
  if (!aTitle && !bTitle && looksLikeCompany(a) && !looksLikeCompany(b)) return { title: fact(b, `${source}.title`, b, 0.5), company: fact(a, `${source}.company`, a, 0.5) };
  if (!aTitle && !bTitle && looksLikeCompany(b) && !looksLikeCompany(a)) return { title: fact(a, `${source}.title`, a, 0.5), company: fact(b, `${source}.company`, b, 0.5) };
  // Both or neither look like a title: genuinely ambiguous, do not guess which is which.
  return { title: emptyFact(`${source}.title`), company: emptyFact(`${source}.company`) };
}

// A line that continues the line above it (a bullet wrapped by the page width): it starts in lower case. A header or a new
// achievement starts with a capital. A brand such as "eBay" or "iRobot" starts in lower case too and is not a continuation.
const startsLowercase = (line) => /^\p{Ll}/u.test(line.trim()) && !/^\p{Ll}+\p{Lu}/u.test(line.trim());

// A line that cannot be the end of a sentence: it stops on a comma, a dash, or a word that always needs a next word. The next line continues it.
const DANGLING = /(?:[,;:/&-]|\b(?:by|and|or|of|to|in|on|for|with|the|a|an|as|at|from|into|using|via|across|through|than|that|which|while|per|over|under|between|among|including|its|their|our))$/i;

// "Title | Company" and "Company | Title" on one line: the first two parts become the two header lines.
const splitPipes = (line) => (line.includes('|') ? line.split(/\s*\|\s*/).map(t => t.trim()).filter(Boolean).slice(0, 2) : [line]);

// A line that reads as the title/company of a job rather than as content: short, no sentence ending, no figures, and either
// title-shaped, company-shaped, or "X, Y" / "X at Y" / "X — Y" with a title word in it.
const isHeaderShaped = (line) => {
  const t = line.trim();
  if (!t || isBulletLine(t) || t.length > 70 || /[.!?]$/.test(t) || /[\d%$]/.test(t) || t.split(/\s+/).length > 8) return false;
  return TITLE_WORDS.test(t) || looksLikeCompany(t);
};

// The header lines (at most 2) that sit directly before a job's date line. The existing header logic below already reads them as that
// job's title/company, so the previous job must not also count them as its own bullets. The line right after the previous date is never
// taken (it can be that job's own company line), so a job always keeps at least that line.
function headerRunBefore(lines, dateIdx, floor) {
  let start = dateIdx;
  while (start - 1 > floor + 1 && dateIdx - (start - 1) <= 2 && isHeaderShaped(lines[start - 1])) start--;
  return start;
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
    // A bullet that merely mentions a year ("... in new contracts in 2021") is content, not the header of a new entry;
    // a bullet counts as a header only when it holds a full range with an end.
    if (d && (!isBulletLine(line) || d.range?.end?.value != null)) { dateLineIdx.push(i); dateByLine[i] = d; }
  });
  if (!dateLineIdx.length) return [];

  const entries = [];
  let employerAbove = null; // the company line that sat above the previous entry's title line, if any
  for (let k = 0; k < dateLineIdx.length; k++) {
    const i = dateLineIdx[k];
    const prevBoundary = k > 0 ? dateLineIdx[k - 1] + 1 : 0;
    const nextBoundary = k + 1 < dateLineIdx.length ? headerRunBefore(lines, dateLineIdx[k + 1], i) : lines.length;
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
    const dateLineClean = lines[i].replace(dateByLine[i].matchedText, '').replace(/\t/g, ' ').replace(/\(\s*\)/g, '').replace(/^[\s|,;:–—-]+|[\s|,;:–—-]+$/g, '').trim();
    let bulletsStart = -1;
    for (let j = i + 1; j < nextBoundary; j++) if (isBulletLine(lines[j])) { bulletsStart = j; break; }
    if (bulletsStart === -1) {
      // No bullet glyph anywhere in this entry: the line right after the date is taken as a header
      // continuation (e.g. a company name on its own line) only when it actually looks like one — short,
      // not ending in sentence punctuation, and title- or company-shaped. Otherwise it is content like
      // any other, so a plain achievement sentence is never mistaken for a company name.
      const next = i + 1 < nextBoundary ? lines[i + 1] : null;
      // A line that sits directly before the NEXT entry's date line is that entry's header, not a continuation of this one.
      const beforeNextDate = i + 2 === nextBoundary && nextBoundary < lines.length;
      const looksHeaderish = next && !beforeNextDate && next.length <= 50 && !/[.!?]$/.test(next.trim()) && (isTitleShaped(next) || looksLikeCompany(next));
      bulletsStart = looksHeaderish ? i + 2 : i + 1;
    }

    // Header lines before the date: when header-shaped lines sit right before it, those are the header, not the previous job's last content line.
    const runStart = k > 0 ? headerRunBefore(lines, i, dateLineIdx[k - 1]) : i;
    const headerFrom = runStart < i ? runStart : prevBoundary;
    const headerLines = [];
    for (let j = headerFrom; j < bulletsStart; j++) {
      if (j === i) { if (dateLineClean) headerLines.push(...splitPipes(dateLineClean)); }
      // A wrapped line of the previous job's last bullet is not a header line; neither is the column-name row of a table of jobs.
      else if (!isBulletLine(lines[j]) && !TABLE_HEADER_ROW.test(lines[j].trim()) && !(j < i && startsLowercase(lines[j]))) headerLines.push(...splitPipes(lines[j]));
    }
    // A table row ("Title<TAB>Company<TAB>dates" or "| Title | Company | dates |"): the first two cells are the title and company, whatever stood above.
    const cells = lines[i].replace(dateByLine[i].matchedText, '').split(/\t+|\|/).map(c => c.trim()).filter(Boolean);
    const header = cells.length >= 2 ? cells.slice(0, 2) : headerLines.slice(-2);
    let { title, company } = classifyHeaderLines(header, entrySource);
    // A second role under the same employer heading: a lone title line with no separator takes the employer that stood
    // on its own line above the previous role's title. Lower confidence than a company read from the entry itself.
    const lone = header.length === 1 && !/[,—–]|\s-\s|\sat\s/i.test(header[0]);
    let inherited = false;
    if (!company.value && title.value && lone && isTitleShaped(header[0]) && employerAbove) {
      company = fact(employerAbove.value, `${entrySource}.company`, employerAbove.evidence, 0.5);
      inherited = true;
    }
    employerAbove = !inherited && header.length === 2 && company.value && company.evidence === header[0]
      ? { value: company.value, evidence: company.evidence } : (inherited ? employerAbove : null);

    // A line without a marker continues the bullet above when that bullet is unfinished (no sentence end) and one of these holds: the line
    // starts in lower case, the bullet above stops on a word that needs a next word, or the bullets of this job carry markers (so an
    // unmarked line is far more likely a wrapped line than a new bullet). A marker always starts a new bullet. No single signal decides.
    const bullets = [];
    let lastMarked = false;
    for (let j = bulletsStart; j < nextBoundary; j++) {
      const marked = isBulletLine(lines[j]);
      const text = lines[j].replace(BULLET_RE, '').trim();
      if (!text) continue;
      const last = bullets[bullets.length - 1];
      if (last && !marked && !/[.!?]$/.test(last.value) && (startsLowercase(text) || DANGLING.test(last.value) || lastMarked)) {
        last.value = `${last.value} ${text}`; // the same bullet, wrapped onto a second line
        last.evidence = `${last.evidence}\n${lines[j]}`;
        continue;
      }
      bullets.push(fact(text, `${entrySource}.bullets[${bullets.length}]`, lines[j], 0.8, 'structure'));
      lastMarked = marked;
    }

    // A career break, sabbatical or leave is a period without an employer, not a job: leaving it out keeps the gap visible to the
    // chronology checks instead of hiding it as work history.
    if (NOT_A_JOB.test(String(title.value || '').trim())) continue;

    entries.push({
      title, company,
      start: { ...dateByLine[i].range.start, source: `${entrySource}.start` },
      end: { ...dateByLine[i].range.end, source: `${entrySource}.end` },
      bullets,
    });
  }
  return entries;
}
