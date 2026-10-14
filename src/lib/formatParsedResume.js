// Rebuilds plain resume text from the JSON the model returns when a PDF could not be read as text (the fallback in App.jsx). The rebuilt text is
// stored as the user's resume and scored later like any other, so it must keep what the model returned: the old version dropped the email,
// phone and location (the score then said "Email not found" about a resume that has one) and gave the summary no heading.
// Every field is optional; nothing missing is written as "undefined" or "null".

export const RESUME_EXTRACT_PROMPT = `Extract this resume and return ONLY raw JSON (no markdown, start with {): {"personalInfo":{"fullName":"","email":"","phone":"","location":""},"summary":"","experience":[{"company":"","position":"","startDate":"","endDate":"","description":[]}],"education":[{"school":"","degree":"","year":""}],"skills":[{"category":"","items":[]}],"projects":[{"name":"","description":[]}],"certifications":[{"name":""}]}. Copy what the resume says; leave a field empty when it is not there.`;

const text = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const list = (v) => (Array.isArray(v) ? v : []);
const strings = (v) => list(v).map(text).filter(Boolean);

export function formatParsedResume(p) {
  if (!p || typeof p !== 'object') return '';
  const out = [];
  const info = p.personalInfo && typeof p.personalInfo === 'object' ? p.personalInfo : {};
  if (text(info.fullName)) out.push(text(info.fullName));
  const contact = [info.email, info.phone, info.location].map(text).filter(Boolean).join(' | ');
  if (contact) out.push(contact);
  if (text(p.summary)) out.push('', 'SUMMARY', text(p.summary));

  const jobs = list(p.experience).filter(e => e && typeof e === 'object');
  if (jobs.length) {
    out.push('', 'EXPERIENCE');
    for (const e of jobs) {
      const dates = [text(e.startDate), text(e.endDate)].filter(Boolean).join(' – ');
      const who = [text(e.position), text(e.company)].filter(Boolean).join(' at ');
      if (who || dates) out.push(`${who}${dates ? ` (${dates})` : ''}`.trim());
      for (const d of strings(e.description)) out.push(`• ${d}`);
    }
  }

  const projects = list(p.projects).filter(x => x && typeof x === 'object');
  if (projects.length) {
    out.push('', 'PROJECTS');
    for (const x of projects) {
      if (text(x.name)) out.push(text(x.name));
      for (const d of strings(x.description)) out.push(`• ${d}`);
    }
  }

  const schools = list(p.education).filter(e => e && typeof e === 'object');
  if (schools.length) {
    out.push('', 'EDUCATION');
    for (const e of schools) {
      const line = [[text(e.degree), text(e.school)].filter(Boolean).join(' — '), text(e.year)].filter(Boolean).join(' ');
      if (line) out.push(line);
    }
  }

  const groups = list(p.skills).filter(s => s && typeof s === 'object');
  if (groups.length) {
    out.push('', 'SKILLS');
    for (const s of groups) {
      const items = strings(s.items).join(', ');
      if (items) out.push(text(s.category) ? `${text(s.category)}: ${items}` : items);
    }
  }

  const certs = list(p.certifications).map(c => (c && typeof c === 'object' ? text(c.name) : text(c))).filter(Boolean);
  if (certs.length) out.push('', 'CERTIFICATIONS', ...certs);

  return out.join('\n');
}

// Shown when the resume text had to be rebuilt by the model because the PDF could not be read as text. The score is computed from this
// rebuilt text, so it can differ from the file.
export const REBUILT_RESUME_NOTICE = "We couldn't read your PDF directly, so we rebuilt the text with AI. It may differ from your file. For the most accurate score, upload a .docx.";

// Reads a PDF for onboarding: directly first; if that throws, ask the model and rebuild the text from its JSON. `rebuilt` is true only when
// rebuilt text came back. An error from the model is not caught here (the caller shows it).
export async function readPdfForSetup(file, { extractText, extractWithModel }) {
  try {
    return { text: await extractText(file), rebuilt: false };
  } catch (_) {
    const parsed = await extractWithModel(file);
    const rebuilt = parsed && !parsed.error ? formatParsedResume(parsed) : '';
    return { text: rebuilt, rebuilt: rebuilt.trim() !== '' };
  }
}
