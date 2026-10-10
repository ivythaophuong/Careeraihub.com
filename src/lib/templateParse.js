// Helpers for turning resume text into a template (Resume Scan editor, PDF export). Pure and deterministic.

// How much of the resume is sent to the model to fill a template. The old limit was 4000 characters, which silently dropped
// Education and Skills from any resume longer than that (a 4,779-character resume lost both).
export const TEMPLATE_PARSE = Object.freeze({ maxChars: 12000, maxTokens: 4500 });

export const JD_MAX_CHARS = 15000; // a job description longer than this is almost always boilerplate; the user is asked to trim it

const HEADINGS = {
  experience: /^\s*(?:work\s+|professional\s+)?(?:experience|employment(?:\s+history)?|kinh nghiệm(?:\s+làm việc)?)\s*:?\s*$/imu,
  education: /^\s*(?:education|academic\s+background|học vấn|trình độ học vấn)\s*:?\s*$/imu,
  skills: /^\s*(?:(?:technical|key|core)\s+)?(?:skills|competencies)|^\s*kỹ năng\s*:?\s*$|^\s*kĩ năng\s*:?\s*$/imu,
};
const filled = (a) => Array.isArray(a) && a.some((x) => (typeof x === 'string' ? x.trim() : x && Object.values(x).some((v) => (Array.isArray(v) ? v.length : String(v ?? '').trim()))));

// Sections whose heading is in the text but that the parsed profile does not contain. A template built from such a profile would
// silently print a resume without them, so the caller shows the full text instead and tells the user.
export function missingSections(text, profile) {
  if (!profile || typeof profile !== 'object') return [];
  const t = String(text ?? '');
  const out = [];
  if (HEADINGS.education.test(t) && !filled(profile.education)) out.push('education');
  if (HEADINGS.skills.test(t) && !filled(profile.skills)) out.push('skills');
  if (HEADINGS.experience.test(t) && !filled(profile.workExperience)) out.push('experience');
  return out;
}
