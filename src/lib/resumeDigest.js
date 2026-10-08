// Keeps what we send the AI bounded without silently dropping the end of a resume.
// Keyword presence is decided by code over the WHOLE text; the AI only reads a condensed, section-aware digest,
// and the user is told whenever that digest is shorter than what they provided.

export const RESUME_BUDGET = 6000;
export const JD_BUDGET = 4000;

const normalize = (text) => String(text || '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

const HEADING = /^\s*(summary|profile|objective|about me|experience|work experience|professional experience|employment(?: history)?|projects?|skills?|technical skills|core competencies|education|certifications?|licenses?|awards?|publications?|languages?|volunteer(?:ing)?(?: experience)?|interests|contact(?: info(?:rmation)?| details)?|personal (?:info(?:rmation)?|details))\s*:?\s*$/i;
const COMPACT = /^(skills?|technical skills|core competencies|education|certifications?|licenses?|languages?)$/;

// Split into [{ name, body }]. Text before the first heading is the "header" (name, contact, tagline).
export function splitSections(text) {
  const sections = [{ name: 'header', body: [] }];
  for (const line of normalize(text).split('\n')) {
    const m = line.match(HEADING);
    if (m) sections.push({ name: m[1].toLowerCase(), body: [] });
    else sections[sections.length - 1].body.push(line);
  }
  return sections.map(s => ({ name: s.name, body: s.body.join('\n').trim() }));
}

const cutAt = (text, max) => {
  if (text.length <= max) return text;
  const slice = text.slice(0, Math.max(0, max - 4));
  const nl = slice.lastIndexOf('\n');
  return `${(nl > max * 0.6 ? slice.slice(0, nl) : slice).trimEnd()} […]`;
};

const result = (original, out, budget) => {
  const text = out.length > budget ? out.slice(0, budget) : out;
  return { text, truncated: text.length < original.length, originalLength: original.length, sentLength: text.length };
};

// A resume that fits goes through whole. A longer one keeps its header, every compact section (skills, education…)
// and a share of each long section, so something from the end of the CV is always represented.
export function digestResume(text, budget = RESUME_BUDGET) {
  const t = normalize(text);
  if (t.length <= budget) return { text: t, truncated: false, originalLength: t.length, sentLength: t.length };

  const sections = splitSections(t);
  if (sections.length <= 1) {
    const head = Math.floor(budget * 0.65);
    const tail = Math.floor(budget * 0.3);
    return result(t, `${t.slice(0, head).trimEnd()}\n[…]\n${t.slice(-tail).trimStart()}`, budget);
  }

  const label = (s) => (s.name === 'header' ? '' : `## ${s.name.toUpperCase()}\n`);
  const kept = sections.map(s => {
    if (s.name === 'header') return { s, body: cutAt(s.body, 500), long: false };
    if (COMPACT.test(s.name)) return { s, body: cutAt(s.body, 1200), long: false };
    return { s, body: null, long: true };
  });
  const overhead = sections.reduce((n, s) => n + label(s).length + 1, 0);
  const used = kept.filter(k => !k.long).reduce((n, k) => n + k.body.length, 0);
  const longOnes = kept.filter(k => k.long);
  const room = Math.max(0, budget - used - overhead);
  const totalLong = longOnes.reduce((n, k) => n + k.s.body.length, 0) || 1;
  for (const k of longOnes) {
    k.body = cutAt(k.s.body, Math.max(150, Math.floor(room * (k.s.body.length / totalLong))));
  }
  return result(t, kept.filter(k => k.body).map(k => `${label(k.s)}${k.body}`).join('\n\n'), budget);
}

const JD_REQUIREMENTS = /(requirements?|qualifications?|what (?:you|we)(?:'ll| will)? (?:need|look)|must[- ]have|skills|experience required)/i;

// A job description keeps its opening (role, context) plus the requirements section, wherever it starts.
export function digestJd(text, budget = JD_BUDGET) {
  const t = normalize(text);
  if (t.length <= budget) return { text: t, truncated: false, originalLength: t.length, sentLength: t.length };
  const headLen = Math.floor(budget * 0.35);
  const rest = budget - headLen - 6;
  const m = JD_REQUIREMENTS.exec(t.slice(headLen));
  const from = m ? headLen + m.index : t.length - rest;
  return result(t, `${t.slice(0, headLen).trimEnd()}\n[…]\n${t.slice(from, from + rest).trim()}`, budget);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Whole-term match, case-insensitive: "SQL" is not in "MySQL", and "C++", "C#", "Node.js" and multi-word terms work.
export function termInText(text, term) {
  const t = String(term || '').trim();
  if (!t) return false;
  const pattern = t.split(/\s+/).map(escapeRe).join('\\s+');
  // A bare "C" must not match inside "C++" or "C#".
  const after = /[A-Za-z0-9]$/.test(t) ? '(?![A-Za-z0-9+#])' : '(?![A-Za-z0-9])';
  return new RegExp(`(?<![A-Za-z0-9])${pattern}${after}`, 'i').test(String(text || ''));
}

// The AI proposes terms from the JD; code decides. A term not in the JD is dropped (the model made it up),
// and "missing" means absent from the whole resume, not just the part the AI saw.
export function checkKeywords(candidates, resumeText, jdText) {
  const seen = new Set();
  const matched = [], missing = [], dropped = [];
  for (const raw of candidates || []) {
    const k = String(raw || '').trim();
    const key = k.toLowerCase();
    if (!k || seen.has(key)) continue;
    seen.add(key);
    if (!termInText(jdText, k)) dropped.push(k);
    else if (termInText(resumeText, k)) matched.push(k);
    else missing.push(k);
  }
  return { matched, missing, dropped };
}

const fmt = (n) => n.toLocaleString('en-US');

// One plain sentence for the user, or null when nothing was condensed.
export function describeCuts({ resume, jd }) {
  const parts = [];
  if (resume?.truncated) parts.push(`Your resume (${fmt(resume.originalLength)} characters) was condensed to its key sections (${fmt(resume.sentLength)}) before the AI read it`);
  if (jd?.truncated) parts.push(`the job description (${fmt(jd.originalLength)} characters) was condensed to its opening and requirements (${fmt(jd.sentLength)})`);
  if (!parts.length) return null;
  const s = parts.join(', and ');
  return `${s[0].toUpperCase()}${s.slice(1)}. Keyword matching still checked the full text.`;
}

export function prepareJdMatch(resumeText, jdText) {
  const resume = digestResume(resumeText);
  const jd = digestJd(jdText);
  return { resume: resume.text, jd: jd.text, notice: describeCuts({ resume, jd }) };
}
