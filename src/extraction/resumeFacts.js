// Orchestrator: plain resume text -> a ResumeFacts object matching src/contracts/resumeFacts.js. No AI.
// Reuses the section split already used for the AI digest (src/lib/resumeDigest.js) so the two layers
// agree on where "experience" or "skills" starts, instead of re-implementing section detection twice.
import { splitSections } from '../lib/resumeDigest';
import { RESUME_FACTS_VERSION, validateResumeFacts } from '../contracts/resumeFacts';
import { contentHash } from './hash';
import { extractContact } from './contact';
import { extractExperiences } from './experience';
import { extractEducation } from './education';
import { extractSkills } from './skills';
import { findMetricsInText } from './metrics';

const EXPERIENCE_SECTION = /^(experience|work experience|professional experience|employment|employment history)$/i;
const EDUCATION_SECTION = /^education$/i;
const SKILLS_SECTION = /^(skills|technical skills|core competencies)$/i;
const CERTS_SECTION = /^(certifications?|licenses?)$/i;
// Some layouts put the contact block in the top preamble (the "header" splitSections produces); others
// give it its own heading, often placed well after Education/Experience in reading order (seen in a
// real two-column template: the sidebar's contact block sits right before Skills). Both are checked.
const CONTACT_SECTION = /^(contact(?: info(?:rmation)?| details)?|personal (?:info(?:rmation)?|details))$/i;

const bySectionName = (sections, re) => sections.filter(s => re.test(s.name));

export function extractResumeFacts(text) {
  const raw = String(text || '');
  const sections = splitSections(raw);
  const header = sections.find(s => s.name === 'header');
  const contactSections = bySectionName(sections, CONTACT_SECTION);
  const contactText = [header?.body, ...contactSections.map(s => s.body)].filter(Boolean).join('\n');

  const experiences = bySectionName(sections, EXPERIENCE_SECTION).flatMap(s => extractExperiences(s.body));
  const education = bySectionName(sections, EDUCATION_SECTION).flatMap(s => extractEducation(s.body));
  const skills = bySectionName(sections, SKILLS_SECTION).flatMap((s, si) =>
    extractSkills(s.body, `skills`).map((f, i) => ({ ...f, source: `skills[${skillsOffset(sections, si)}+${i}]` })));
  const certifications = bySectionName(sections, CERTS_SECTION).flatMap(s => extractSkills(s.body, 'certifications'));

  // Metrics are scanned over every bullet found in experience entries, not the whole document, so a date
  // or a page number elsewhere is never counted as an "achievement metric".
  const metrics = experiences.flatMap((e, ei) =>
    e.bullets.flatMap((b, bi) => findMetricsInText(b.value, `metrics[exp${ei}.b${bi}]`)));

  const facts = {
    schema_version: RESUME_FACTS_VERSION,
    content_hash: contentHash(raw),
    extraction: { status: raw.trim() ? 'ok' : 'failed', notes: [] },
    contact: extractContact(contactText, raw),
    experiences,
    education,
    skills,
    metrics,
    certifications,
  };

  // Self-check: if this ever produces data that fails our own contract, that is an extraction bug, not a
  // caller's problem, so it is reported loudly instead of silently shipping invalid facts.
  const check = validateResumeFacts(facts);
  if (!check.ok) {
    facts.extraction.status = 'partial';
    facts.extraction.notes.push(`internal: extractor produced ${check.errors.length} contract violation(s): ${check.errors.slice(0, 3).map(e => `${e.path} ${e.code}`).join('; ')}`);
  }
  return facts;
}

function skillsOffset(sections, uptoIndex) {
  let n = 0;
  const matches = bySectionName(sections, SKILLS_SECTION);
  for (let i = 0; i < uptoIndex; i++) n += extractSkills(matches[i].body).length;
  return n;
}
