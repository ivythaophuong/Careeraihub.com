// Shared by modules that need the user's resume as model input (JD Analyzer, Cover Letter, ...).
// Pure helpers, no UI.

export const MAX_RESUME_CHARS = 12000;
const clip = (s, n) => (s.length > n ? s.slice(0, n) : s);

// Flatten the ATS Builder's structured resume (memory.resumeData) into plain text.
export function resumeToText(data) {
  if (!data || typeof data !== 'object') return '';
  const lines = [];
  const p = data.personalInfo || {};
  if (p.fullName) lines.push(p.fullName);
  if (data.summary) lines.push(`Summary: ${data.summary}`);
  (data.experience || []).forEach(e => {
    lines.push(`${e.position || ''} at ${e.company || ''} (${e.startDate || ''} – ${e.endDate || ''})`.trim());
    (e.description || []).forEach(d => lines.push(`- ${d}`));
  });
  (data.education || []).forEach(e => lines.push(`${e.degree || ''}, ${e.school || ''} ${e.year || ''}`.trim()));
  (data.skills || []).forEach(s => lines.push(`${s.category || 'Skills'}: ${(s.items || []).join(', ')}`));
  (data.projects || []).forEach(pr => {
    lines.push(`Project: ${pr.name || ''} ${(pr.techStack || []).join(', ')}`.trim());
    (pr.description || []).forEach(d => lines.push(`- ${d}`));
  });
  (data.certifications || []).forEach(c => lines.push(`Certification: ${c.name || ''} ${c.issuer || ''}`.trim()));
  return lines.filter(Boolean).join('\n');
}

// Pick the best resume source available. PDF uploads keep no text (`content: null`), so the
// session-only PDF is the fallback before giving up.
export function pickResumeSource({ memory = {}, resumeText } = {}) {
  const structured = resumeToText(memory.resumeData);
  if (structured.trim().length > 40) return { kind: 'structured', text: clip(structured, MAX_RESUME_CHARS), pdfBase64: null };
  const pasted = typeof resumeText?.content === 'string' ? resumeText.content.trim() : '';
  if (pasted.length > 40) return { kind: 'text', text: clip(pasted, MAX_RESUME_CHARS), pdfBase64: null };
  if (memory.scanPdfBase64) return { kind: 'pdf', text: '', pdfBase64: memory.scanPdfBase64 };
  return { kind: 'none', text: '', pdfBase64: null };
}
