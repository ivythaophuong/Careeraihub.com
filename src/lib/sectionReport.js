// Which sections the reader recognised in a resume, and which lines look like headings but were not recognised. Pure.
// Used to tell the user (and whoever helps them) why a part of the score could not be assessed.
import { splitSections } from './resumeDigest';

const EXPERIENCE = /^(experience|work experience|professional experience|employment|employment history)$/;
const TITLE = { 'work experience': 'Experience', experience: 'Experience', 'professional experience': 'Experience', employment: 'Experience', 'employment history': 'Experience', 'technical skills': 'Skills', 'core competencies': 'Skills', education: 'Education', skills: 'Skills', summary: 'Summary', certifications: 'Certifications', projects: 'Projects', awards: 'Awards', languages: 'Languages', interests: 'Interests', contact: 'Contact' };
const pretty = (name) => TITLE[name] || (name.charAt(0).toUpperCase() + name.slice(1));

// A line that looks like a heading: short, no sentence punctuation, and either ALL CAPS or ending with a colon.
function looksLikeHeading(line) {
  const t = line.trim();
  if (t.length < 3 || t.length > 48) return false;
  const words = t.replace(/:$/, '').split(/\s+/);
  if (words.length > 6) return false;
  if (/[.!?@]|https?:|\d{4}/.test(t) || /\d/.test(t)) return false;
  const letters = t.replace(/[^\p{L}]/gu, '');
  if (letters.length < 3) return false;
  const allCaps = letters === letters.toUpperCase();
  if (words.length === 1 && letters.length <= 5 && !t.endsWith(':')) return false; // SQL, AWS, KPI: a skill, not a heading
  return allCaps || t.endsWith(':');
}

export function sectionReport(text) {
  const sections = splitSections(text);
  const recognised = sections.filter((s) => s.name !== 'header' && s.body).map((s) => pretty(s.name));
  const known = new Set(sections.map((s) => s.name));
  const unrecognised = [];
  // Lines inside short list-like sections (skills, education...) are items or sub-headings, not top-level headings.
  const LIST_LIKE = new Set(['skills', 'education', 'certifications', 'languages', 'interests', 'awards']);
  for (const s of sections) {
    if (LIST_LIKE.has(s.name)) continue;
    for (const line of s.body.split('\n')) {
      if (looksLikeHeading(line) && !unrecognised.includes(line.trim())) unrecognised.push(line.trim());
    }
  }
  // The name at the top of a resume is often in capitals; a one-line header is not a heading.
  const header = sections[0]?.body.split('\n')[0]?.trim();
  return { recognised: [...new Set(recognised)], unrecognisedHeadings: unrecognised.filter((l) => l !== header).slice(0, 6), hasExperience: [...known].some((n) => EXPERIENCE.test(n)) };
}
