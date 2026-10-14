// Recognises section headings written in wordings the exact table in resumeDigest.js does not list ("Technical Skills & Tools", "Areas of
// Expertise", "Licenses & Certifications"). It is a FALLBACK: a line the exact table already knows keeps the name it always had, so nothing
// that was read before changes. A line is a heading only if it is short, has no digits or sentence punctuation, and every word belongs to
// the word group of ONE section (a head noun plus modifiers and "and"/"of"). Lines that mix two sections ("Skills and Experience"), a lone
// generic word ("Tools") or anything sentence-like are NOT headings: unknown stays unknown, and the line stays body text. English only.
const GROUPS = {
  skills: {
    canonical: 'skills',
    strong: ['skills', 'skill'],
    weak: ['competencies', 'competency', 'expertise', 'proficiencies', 'proficiency', 'technologies', 'technology', 'tools', 'strengths', 'abilities', 'capabilities', 'stack'],
    mods: ['technical', 'core', 'key', 'professional', 'relevant', 'additional', 'soft', 'hard', 'personal', 'areas', 'tech', 'other', 'main', 'software', 'computer', 'it', 'digital'],
  },
  experience: {
    canonical: 'work experience',
    strong: ['experience', 'experiences', 'employment'],
    weak: ['history'],
    mods: ['work', 'working', 'professional', 'relevant', 'related', 'career', 'industry', 'recent', 'selected', 'previous', 'prior', 'internship', 'internships', 'research', 'other'],
  },
  education: {
    canonical: 'education',
    strong: ['education'],
    weak: ['qualifications', 'qualification', 'studies', 'academics', 'schooling'],
    mods: ['academic', 'educational', 'formal', 'higher', 'background', 'training', 'courses'],
  },
  certifications: {
    canonical: 'certifications',
    strong: ['certifications', 'certification', 'certificates', 'certificate', 'licenses', 'licences', 'license', 'licence'],
    weak: ['accreditations', 'credentials'],
    mods: ['professional', 'relevant', 'additional', 'training', 'courses', 'industry', 'technical'],
  },
  projects: {
    canonical: 'projects',
    strong: ['projects', 'project'],
    weak: ['portfolio'],
    mods: ['selected', 'key', 'personal', 'side', 'notable', 'academic', 'relevant', 'open', 'source', 'technical', 'featured', 'recent'],
  },
  languages: {
    canonical: 'languages',
    strong: ['languages', 'language'],
    weak: [],
    mods: ['spoken', 'foreign', 'programming', 'coding'],
  },
  summary: {
    canonical: 'summary',
    strong: ['summary', 'objective', 'overview'],
    weak: ['profile'],
    mods: ['professional', 'career', 'personal', 'executive', 'brief'],
  },
};
const CONNECTORS = new Set(['and', 'of']);
const MAX_WORDS = 5, MAX_CHARS = 50;

export function classifyHeading(line) {
  if (typeof line !== 'string') return null;
  let s = line.normalize('NFC').trim().replace(/^[\s:\-–—_=*#~•·|]+|[\s:\-–—_=*#~•·|]+$/g, '');
  if (!s || s.length > MAX_CHARS) return null;
  if (/[\d@.,;!?()]|https?:|www\./i.test(s)) return null;
  s = s.toLowerCase().replace(/[&/]/g, ' and ');
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > MAX_WORDS) return null;
  if (CONNECTORS.has(words[0]) || CONNECTORS.has(words[words.length - 1])) return null;

  const content = words.filter((w) => !CONNECTORS.has(w));
  const headSections = new Set();
  for (const w of content) for (const [key, g] of Object.entries(GROUPS)) if (g.strong.includes(w) || g.weak.includes(w)) headSections.add(key);
  // "Languages and Skills" / "Programming Languages" are skills headings: the section holds the skills (and any languages are skills too).
  // Any other mix of two sections ("Skills and Experience") is ambiguous, so it is not a heading.
  const isSkillsAndLanguages = headSections.size === 2 && headSections.has('skills') && headSections.has('languages');
  const programmingLanguages = headSections.size === 1 && headSections.has('languages') && content.some((w) => w === 'programming' || w === 'coding');
  if (headSections.size !== 1 && !isSkillsAndLanguages) return null; // no head noun, or heads of two different sections
  const key = isSkillsAndLanguages || programmingLanguages ? 'skills' : [...headSections][0];
  const g = GROUPS[key];
  const allowed = new Set(isSkillsAndLanguages || programmingLanguages
    ? [...GROUPS.skills.strong, ...GROUPS.skills.weak, ...GROUPS.skills.mods, ...GROUPS.languages.strong, ...GROUPS.languages.mods]
    : [...g.strong, ...g.weak, ...g.mods]);
  if (!content.every((w) => allowed.has(w))) return null;
  const hasStrong = content.some((w) => g.strong.includes(w));
  if (!hasStrong && content.length < 2) return null; // a lone generic word ("Tools") is a label inside a list, not a section
  return { canonical: g.canonical, section: key };
}
