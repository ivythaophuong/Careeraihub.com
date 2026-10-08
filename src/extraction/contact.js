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

// Looks at the first 3 candidate lines of the header: a name sits at the very top of a resume, and a line
// further down is more likely a job title or a quote. Returns null (requiresInterpretation) rather than
// guess when no line looks like a name, or when the top candidate does not (so a line 2-3 is not promoted
// past a top candidate that simply isn't name-shaped).
export function extractName(headerText, source = 'contact.name') {
  const lines = nonEmptyLines(headerText).filter(l => !NOT_CANDIDATE_CONTENT(l)).slice(0, 3);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!nameShaped(line)) { if (i === 0) return empty(source); continue; }
    const confidence = i === 0 ? 0.85 : 0.55;
    return found(line, source, line, confidence, 'rule');
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
