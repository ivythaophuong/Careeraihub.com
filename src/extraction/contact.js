// Deterministic extraction of contact facts from the header of a resume (the text splitSections puts
// before the first recognised section heading: name, contact line, sometimes a tagline).
// Every return value is a Fact (see src/contracts/resumeFacts.js). Nothing here calls AI.
import { EMAIL_RE, URL_RE, PHONE_CANDIDATE_RE, looksLikePhone, trimTrailingPunct, nonEmptyLines } from './patterns';

const empty = (source) => ({ value: null, normalized_value: null, source, evidence: null, confidence: 0, extraction_method: 'rule', requiresInterpretation: true });
const found = (value, source, evidence, confidence, method = 'regex', normalized_value = null) =>
  ({ value, normalized_value, source, evidence, confidence, extraction_method: method, requiresInterpretation: false });

export function extractEmail(headerText, source = 'contact.email') {
  const m = (headerText.match(EMAIL_RE) || [])[0];
  if (!m) return empty(source);
  const v = trimTrailingPunct(m);
  return found(v, source, v, 0.97, 'regex', v.toLowerCase());
}

export function extractPhone(headerText, source = 'contact.phone') {
  const candidates = (headerText.match(PHONE_CANDIDATE_RE) || []).filter(looksLikePhone);
  if (!candidates.length) return empty(source);
  // Prefer a candidate with a leading '+' (an explicit country code) when there is one.
  const v = candidates.find(c => c.trim().startsWith('+')) || candidates[0];
  const normalized = v.replace(/[^\d+]/g, '');
  const confidence = v.trim().startsWith('+') ? 0.9 : 0.75;
  return found(v.trim(), source, v.trim(), confidence, 'regex', normalized);
}

export function extractLinks(headerText, source = 'contact.links') {
  const raw = headerText.match(URL_RE) || [];
  const seen = new Set();
  const links = [];
  for (const m of raw) {
    const v = trimTrailingPunct(m);
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    links.push(found(v, `${source}[${links.length}]`, v, 0.95, 'regex'));
  }
  return links;
}

// A line is "name-shaped" if it is short, has 1-6 space-separated words, is mostly letters (incl.
// accented letters, for Vietnamese and other diacritics), and contains no digit, '@' or URL scheme.
const WORD = /^[\p{L}][\p{L}'.-]*$/u;
function nameShaped(line) {
  if (!line || line.length > 60) return false;
  if (/[@\d]/.test(line) || /https?:|www\./i.test(line)) return false;
  const words = line.split(/\s+/);
  if (words.length < 1 || words.length > 6) return false;
  return words.every(w => WORD.test(w));
}
const NOT_A_NAME = /^(resume|cv|curriculum vitae|cover letter|biography|r[ée]sum[ée])$/i;

// A banner label, a lone page icon, or an artifact of a decorative header shape can land as its own very
// short line before the real name (seen in a real two-column template: a "CV" banner tag, then two
// single-character fragments, then the name on line 5). Neither that noise nor a generic document-title
// line ("Resume", "Curriculum Vitae") is real candidate content, so neither consumes one of the first-3
// position slots below; without this, the real name right after one of them would be scored as if it were
// the second or third candidate rather than the first.
const NOT_CANDIDATE_CONTENT = (line) => line.length < 3 || NOT_A_NAME.test(line);

// Job-title words and degree/credential suffixes are WEAK signals: a segment made of (or containing) a title word is not taken as the name,
// and a trailing degree is dropped from it. Neither list is complete, so they never decide alone: with no other candidate the answer is
// "unknown", not a guess, and a title that is missing from the list can only cost a wrong name when nothing else is name-shaped.
const TITLE_WORDS = new Set(['analyst', 'engineer', 'manager', 'developer', 'designer', 'director', 'consultant', 'specialist', 'coordinator', 'executive',
  'officer', 'scientist', 'architect', 'lead', 'head', 'associate', 'intern', 'administrator', 'accountant', 'assistant', 'writer', 'strategist',
  'researcher', 'technician', 'supervisor', 'president', 'founder', 'ceo', 'cto', 'cfo', 'coo', 'vp', 'principal', 'senior', 'junior', 'staff',
  'product', 'marketing', 'sales', 'data', 'software', 'operations', 'finance', 'recruiter', 'trainer', 'teacher', 'lecturer', 'professor',
  'nurse', 'lawyer', 'attorney', 'editor', 'producer', 'planner', 'buyer', 'auditor', 'controller', 'owner']);
const DEGREE_WORDS = new Set(['mba', 'phd', 'dphil', 'msc', 'bsc', 'ma', 'ba', 'bs', 'ms', 'md', 'cpa', 'cfa', 'pmp', 'meng', 'beng', 'llb', 'llm', 'mphil',
  'mpa', 'mph', 'rn', 'pe', 'cissp', 'acca', 'frm', 'esq']);
const LABEL_RE = /^(?:full\s+name|name|candidate|họ\s+(?:và\s+)?tên)\s*[:\-–]\s*/iu;
const SEGMENT_SPLIT = /\s*[|·•]\s*|\s+[–—-]\s+|\t+|\s{3,}/;
const CONTACTISH = /[@\d]|https?:|www\.|linkedin|github/i;

const bare = (w) => w.replace(/[.,]/g, '').toLowerCase();

// What a header line says about the name, using only its FIRST segment (a name leads; what follows a separator is a title, a city or contact info).
//   { kind: 'contact' }   the first segment is contact information
//   { kind: 'location' }  a place ("City, Country (note)", "City, TX"): skipped like contact information
//   { kind: 'name', value, label }
//   { kind: 'title' }     name-shaped words that are a job title
//   { kind: 'other' }     not name-shaped
function readLine(line) {
  let text = line;
  const label = LABEL_RE.test(text);
  text = text.replace(LABEL_RE, '');
  let first = text.split(SEGMENT_SPLIT)[0].trim();
  if (!first || CONTACTISH.test(first)) return { kind: 'contact' };
  // "Jordan A. Lee, MBA": after the first comma only degrees may follow; otherwise the comma form is not read ("Lee, Jordan" stays unknown).
  if (first.includes(',')) {
    const [head, ...rest] = first.split(',').map((x) => x.trim());
    if (!rest.every((r) => r.split(/\s+/).every((w) => DEGREE_WORDS.has(bare(w))))) {
      // "Ho Chi Minh City, Vietnam (Open to relocation)" and "Austin, TX" are places, not a name and not noise: skipped like contact info.
      // Only the two forms that cannot be a person are read this way (a note in brackets, a two-letter state). "Lee, Jordan" and
      // "Austin, Texas" look the same as each other, so they stay unknown.
      const tail = rest.join(',').trim();
      const placeHead = /^\p{Lu}[\p{L}.'-]*(?:\s+\p{Lu}?[\p{L}.'-]+)*$/u.test(head);
      if (placeHead && (/\(.+\)/.test(tail) || /^\p{Lu}{2}$/u.test(tail))) return { kind: 'location' };
      return { kind: 'other' };
    }
    first = head;
  }
  const words = first.split(/\s+/).filter(Boolean);
  while (words.length > 1 && DEGREE_WORDS.has(bare(words[words.length - 1]))) words.pop();
  const value = words.join(' ');
  if (!nameShaped(value)) return { kind: 'other' };
  if (words.some((w) => TITLE_WORDS.has(bare(w)))) return { kind: 'title' };
  return { kind: 'name', value, label, words: words.length };
}

// A name sits at the top of a resume, so only the first few lines are read. Lines that are only contact information are skipped. A job-title
// line is skipped too (a tagline often precedes or follows the name). The first line that is neither contact, title nor name-shaped makes the
// answer "unknown" rather than promoting something further down (as before). A name found after other lines is accepted only if it is the
// only candidate in the next two lines; two equally good candidates mean "unknown", not a pick.
export function extractName(headerText, source = 'contact.name') {
  const lines = nonEmptyLines(headerText).filter((l) => !NOT_CANDIDATE_CONTENT(l)).slice(0, 5);
  const read = lines.map(readLine);
  let skipped = 0, sawTitle = false;
  for (let i = 0; i < read.length; i++) {
    const r = read[i];
    if (r.kind === 'contact' || r.kind === 'location') { skipped++; continue; }
    if (r.kind === 'title') { sawTitle = true; skipped++; continue; }
    if (r.kind === 'other') return empty(source);
    // r.kind === 'name'. Below the first line a single word is not enough ("Singapore"), so two words are required there.
    if (i > 0 && r.words < 2) return empty(source);
    if (i > 0) {
      const rivals = read.slice(i + 1, i + 3).filter((x) => x.kind === 'name' && x.words >= 2);
      if (rivals.length) return empty(source);
    }
    const confidence = i === 0 ? (r.label ? 0.9 : 0.85) : sawTitle ? 0.55 : 0.7;
    return found(r.value, source, lines[i], confidence, 'rule');
  }
  return empty(source);
}

// "City, Country" / "City, State" shaped: two comma-separated Title-Case-ish segments, no digits. Only
// trusted within the header (location elsewhere, e.g. inside an experience entry, is an employer's
// location, not the candidate's).
const LOCATION_RE = /^[\p{Lu}][\p{L}.'-]*(?:\s+[\p{Lu}][\p{L}.'-]*)*,\s*[\p{Lu}][\p{L}.'-]*(?:\s+[\p{L}.'-]*)*$/u;
export function extractLocation(headerText, source = 'contact.location') {
  for (const line of nonEmptyLines(headerText).slice(0, 5)) {
    const parts = line.split(/\s{2,}|\||·|•/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (/[@\d]/.test(part) || /https?:|www\./i.test(part)) continue;
      if (LOCATION_RE.test(part) && part.length <= 60) return found(part, source, part, 0.6, 'rule');
    }
  }
  return empty(source);
}

// `narrowText` is where a NAME or LOCATION may be trusted (the header, plus a "Contact"-labelled section
// if the resume has one): a name-shaped or location-shaped line found elsewhere could just as easily be
// someone else's name (a reference) or an employer's city. `wideText` defaults to the whole resume and is
// where EMAIL, PHONE and LINKS are searched: an '@' or a recognisable URL is strong, nearly unambiguous
// evidence wherever it appears, and real resumes do put the contact block in an unlabelled icon-only
// section the heading-based split cannot find (found in a real two-column template that uses icons with
// no "Contact" heading text at all).
export function extractContact(narrowText, wideText = narrowText) {
  const narrow = String(narrowText || '');
  const wide = String(wideText || '');
  return {
    name: extractName(narrow),
    email: extractEmail(wide),
    phone: extractPhone(wide),
    location: extractLocation(narrow),
    links: extractLinks(wide),
  };
}
