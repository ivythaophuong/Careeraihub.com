// Plain-language lines for the parts of the ATS Readiness score. Pure. The evidence strings come from src/scoring/resumeScore.js.

const LABELS = { 'contact.name': 'Name', 'contact.email': 'Email', 'experience or education': 'Experience or education', skills: 'Skills' };

// Why a part could not be assessed: what the reader looked for and did not find, and what to check. Never "nothing to check" (that blamed the resume).
export const NOT_ASSESSED = {
  completeness: 'Not assessed.',
  measurable_impact: 'No work-experience bullets were found. If your resume has them, check that the section heading is a usual one (for example Experience, Work History, Kinh nghiệm làm việc) and that the file text below looks right.',
  chronology_health: 'No work entries with both a start and an end date were found to compare. If your roles have dates, check the date format (for example Jan 2021 – Present, 01/2021 – nay).',
};

export function describePart(part) {
  const assessed = Number.isFinite(part?.score);
  if (!assessed) return { assessed: false, items: [], text: NOT_ASSESSED[part?.id] || 'Not assessed.' };
  if (part.id === 'completeness') {
    const items = (part.evidence || []).map((e) => {
      const m = e.match(/^(.*): (present|missing)$/);
      return m ? { label: LABELS[m[1]] || m[1], ok: m[2] === 'present' } : { label: e, ok: true };
    });
    return { assessed: true, items, text: items.map((i) => `${i.ok ? '✓' : '✗'} ${i.label}${i.ok ? '' : ' not found'}`).join('  ·  ') };
  }
  return { assessed: true, items: [], text: (part.evidence || []).join(' · ') };
}
