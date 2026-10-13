// The contact details and the school and degree of the Fix page, as pure functions over the Builder data (no screen, no AI call, no storage).
// An education entry is found by its `id` (an entry without one by its place in its own list, for this visit only), never by a position that can shift.
// Code only reads, checks and stores what the user typed: it never rewrites a value into another one and never makes one up. The year of an education
// entry belongs to the Dates card (datesFix.js), not to this one.
const norm = (s) => (typeof s === 'string' ? s.normalize('NFC').replace(/[\s ]+/g, ' ').trim() : '');
const CONTACT = [['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['linkedin', 'LinkedIn'], ['location', 'Location']];
const EDU = [['institution', 'School'], ['degree', 'Degree']];
const isObj = (d) => !!d && typeof d === 'object';
const eduList = (d) => (isObj(d) && Array.isArray(d.education) ? d.education : []);
const effId = (e, i) => (e && e.id !== undefined && e.id !== null ? e.id : `i${i}`);
const str = (v) => (typeof v === 'string' ? v : '');

export function listContactFields(data) {
  const c = isObj(data) && isObj(data.contact) ? data.contact : {};
  return CONTACT.map(([field, label]) => ({ ref: { kind: 'contact', field }, label, text: str(c[field]) }));
}

// The school and the degree of each education entry that has something in it. { ref: { kind: 'edu', id, field }, label, group, text, ambiguous }.
export function listEducationFields(data) {
  const list = eduList(data);
  const counts = new Map();
  list.forEach((e, i) => counts.set(effId(e, i), (counts.get(effId(e, i)) || 0) + 1));
  const out = [];
  list.forEach((e, i) => {
    if (!e || typeof e !== 'object' || (!norm(e.institution) && !norm(e.degree) && !norm(e.year))) return;
    const id = effId(e, i);
    const group = norm(e.institution) || norm(e.degree) || `Education ${i + 1}`;
    for (const [field, label] of EDU) out.push({ ref: { kind: 'edu', id, field }, label, group, text: str(e[field]), ambiguous: counts.get(id) > 1 });
  });
  return out;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Only what code can see: 'missing', 'not_email', 'phone_digits' (fewer than 7 or more than 15 digits) and 'not_linkedin' (no linkedin.com in it).
export function fieldFindings(item) {
  const text = norm(item?.text);
  if (!text) return ['missing'];
  if (item.ref?.kind !== 'contact') return [];
  if (item.ref.field === 'email') return EMAIL.test(text) ? [] : ['not_email'];
  if (item.ref.field === 'phone') { const n = (text.match(/\d/g) || []).length; return n < 7 || n > 15 ? ['phone_digits'] : []; }
  if (item.ref.field === 'linkedin') return /linkedin\.com/i.test(text) ? [] : ['not_linkedin'];
  return [];
}

// Where a field is: { get(), set(v) } on a copy, or { error }.
function locate(data, ref) {
  if (!isObj(data) || !ref) return { error: 'not_found' };
  if (ref.kind === 'contact') {
    if (!CONTACT.some(([f]) => f === ref.field)) return { error: 'not_found' };
    return { get: (d) => str(isObj(d.contact) ? d.contact[ref.field] : ''), set: (d, v) => { if (!isObj(d.contact)) d.contact = {}; d.contact[ref.field] = v; } };
  }
  if (ref.kind === 'edu' && ref.id !== undefined && ref.id !== null && EDU.some(([f]) => f === ref.field)) {
    const list = eduList(data);
    const hits = list.map((e, i) => (e && typeof e === 'object' && effId(e, i) === ref.id ? i : -1)).filter(i => i >= 0);
    if (hits.length === 0) return { error: 'not_found' };
    if (hits.length > 1) return { error: 'ambiguous' };
    return { get: (d) => str(d.education[hits[0]][ref.field]), set: (d, v) => { d.education[hits[0]][ref.field] = v; } };
  }
  return { error: 'not_found' };
}

// Writes what the user typed in the one field. Returns { data, record } or { error: 'no_data' | 'empty' | 'not_found' | 'ambiguous' | 'unchanged' }.
export function setField(data, ref, text) {
  if (!isObj(data)) return { error: 'no_data' };
  const after = norm(text);
  if (!after) return { error: 'empty' };
  const loc = locate(data, ref);
  if (loc.error) return { error: loc.error };
  const before = loc.get(data);
  if (norm(before) === after) return { error: 'unchanged' };
  const copy = JSON.parse(JSON.stringify(data));
  loc.set(copy, after);
  const r = ref.kind === 'contact' ? { kind: 'contact', field: ref.field } : { kind: 'edu', id: ref.id, field: ref.field };
  return { data: copy, record: { kind: 'fields', changes: [{ ref: r, before, after }] } };
}

const isFieldsRecord = (r) => !!r && r.kind === 'fields' && Array.isArray(r.changes);
const keyOf = (ref) => (ref.kind === 'contact' ? `contact:${ref.field}` : `edu:${ref.id}:${ref.field}`);

// Several changes in one visit become one record: a field keeps its first before and its last after, and a change that returns to where it started is no change.
export function mergeFieldRecords(prev, next) {
  const out = new Map();
  for (const rec of [prev, next]) {
    if (!isFieldsRecord(rec)) continue;
    for (const c of rec.changes) { const k = keyOf(c.ref); out.set(k, { ref: c.ref, before: out.has(k) ? out.get(k).before : c.before, after: c.after }); }
  }
  return { kind: 'fields', changes: [...out.values()].filter(c => norm(c.before) !== norm(c.after)) };
}

// 'open' (no change recorded), 'applied' (every value is still as saved), 'applied_edited' (changed afterwards, or the entry or the data is gone).
export function fieldsStatus(data, record) {
  if (!isFieldsRecord(record) || record.changes.length === 0) return 'open';
  if (!isObj(data)) return 'applied_edited';
  for (const c of record.changes) {
    const loc = locate(data, c.ref);
    if (loc.error || norm(loc.get(data)) !== norm(c.after)) return 'applied_edited';
  }
  return 'applied';
}

// Takes the change back (to the value as it was, even a missing one), but only while it is still as saved; otherwise null.
export function undoFields(data, record) {
  if (fieldsStatus(data, record) !== 'applied') return null;
  const copy = JSON.parse(JSON.stringify(data));
  for (const c of record.changes) locate(copy, c.ref).set(copy, c.before);
  return copy;
}
