// The parts of a feature that live inside it in the sidebar. Today only the Interview Coach has parts; another feature can be added here without touching the sidebar.
// The ids are the names the feature already uses for its own sections.
export const INTERVIEW_COACH_SUBS = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'study',     label: 'Study Modules' },
  { id: 'session',   label: 'Live Session' },
  { id: 'weakness',  label: 'Weakness Radar' },
  { id: 'starbank',  label: 'STAR Bank' },
  { id: 'aimemory',  label: 'AI Memory' },
];

export const SUBS_BY_MODULE = { simulate: INTERVIEW_COACH_SUBS };

export const subsOf = (moduleId) => SUBS_BY_MODULE[moduleId] || [];
export const isSub = (moduleId, sub) => subsOf(moduleId).some((s) => s.id === sub);
export const defaultSub = (moduleId) => subsOf(moduleId)[0]?.id ?? null;

// The address for a feature and one of its parts. A part the feature does not have is replaced by its first part; a feature without parts has none.
export function tabUrl(moduleId, sub) {
  const has = subsOf(moduleId).length > 0;
  const s = has ? (isSub(moduleId, sub) ? sub : defaultSub(moduleId)) : null;
  return `?tab=${moduleId}${s ? `&sub=${s}` : ''}`;
}
