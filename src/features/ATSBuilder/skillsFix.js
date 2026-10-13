// The Skills field of the Fix page, as pure functions over the Builder data (no screen, no AI call, no storage).
// Skills are plain strings with no id, so a skill is identified by its normalised text (NFC, spaces collapsed, case ignored), never by its position.
// Code only does what code can know here: add one skill, remove one skill, see an empty list or a skill repeated. Which skills are missing is not
// something code knows, so nothing here suggests a skill.

// The text of a skill as it is shown: composed accents, every kind of space (also no-break) collapsed to one, trimmed. '' when it is not text.
export const normalizeSkill = (s) => (typeof s === 'string' ? s.normalize('NFC').replace(/[\s ]+/g, ' ').trim() : '');
// What two skills are compared on: the normalised text without case.
export const skillKey = (s) => normalizeSkill(s).toLowerCase();

const isData = (d) => !!d && typeof d === 'object' && Array.isArray(d.skills);
// The skills the Builder holds as text: the blank placeholder it keeps in an empty list is not a skill.
const filled = (d) => (isData(d) ? d.skills.filter(s => typeof s === 'string' && s.trim()) : []);

// The filled skills, normalised, in order.
export const skillList = (data) => filled(data).map(normalizeSkill);

// Only what code can see: no skills at all, and a skill repeated after normalising (listed once, as written at its first appearance).
export function skillsFindings(data) {
  const list = skillList(data);
  const seen = new Map();
  for (const s of list) { const k = skillKey(s); seen.set(k, { first: seen.get(k)?.first ?? s, n: (seen.get(k)?.n ?? 0) + 1 }); }
  return { empty: list.length === 0, duplicates: [...seen.values()].filter(v => v.n > 1).map(v => v.first), count: list.length };
}

// Adds exactly one skill at the end. Returns { data, record } or { error: 'no_data' | 'empty' | 'duplicate' }. The input is not changed.
// The skills already there keep the way they were written; only the blank placeholder goes.
export function addSkill(data, text) {
  if (!isData(data)) return { error: 'no_data' };
  const add = normalizeSkill(text);
  if (!add) return { error: 'empty' };
  const list = filled(data);
  if (list.some(s => skillKey(s) === skillKey(add))) return { error: 'duplicate' };
  return { data: { ...data, skills: [...list, add] }, record: { kind: 'skills', added: [add], removed: [] } };
}

// Removes one skill (the first that matches; a repeated skill loses one item per call). Returns { data, record } or { error: 'no_data' | 'not_found' }.
// An empty list is kept as [''] because the Builder form needs one row.
export function removeSkill(data, text) {
  if (!isData(data)) return { error: 'no_data' };
  const list = filled(data);
  const i = list.findIndex(s => skillKey(s) === skillKey(text));
  if (i === -1 || !skillKey(text)) return { error: 'not_found' };
  const [gone] = list.splice(i, 1);
  return { data: { ...data, skills: list.length ? list : [''] }, record: { kind: 'skills', added: [], removed: [normalizeSkill(gone)] } };
}

// The status of a Skills change, read from the data as it is now (never from a button):
//   'open'            nothing was changed here
//   'applied'         what was added is still there and what was removed is still gone
//   'applied_edited'  the user changed it afterwards (or the data is no longer readable)
export function skillsStatus(data, record) {
  if (!record || record.kind !== 'skills') return 'open';
  if (!isData(data)) return 'applied_edited';
  const keys = new Set(skillList(data).map(skillKey));
  const ok = (record.added || []).every(s => keys.has(skillKey(s))) && (record.removed || []).every(s => !keys.has(skillKey(s)));
  return ok ? 'applied' : 'applied_edited';
}
