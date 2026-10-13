// The dates of the Fix page, as pure functions over the Builder data (no screen, no AI call, no storage). A job carries its dates in `period`, an education
// entry in `year`. An entry is identified by its `id` (an entry without one by its place in its own list, for this visit only), never by a position that
// can shift. Code only reads, checks and stores what the user typed: nothing here makes up a date or says what a date should be.
import { findDateRangeInLine, parseDateRange } from '../../extraction/dates.js';

const norm = (s) => (typeof s === 'string' ? s.normalize('NFC').replace(/[\s ]+/g, ' ').trim() : '');
const FIELD = { job: 'period', edu: 'year' };
const LIST = { job: 'experience', edu: 'education' };
const isRef = (r) => !!r && FIELD[r.kind] && r.id !== undefined && r.id !== null;
const listOf = (data, kind) => (data && typeof data === 'object' && Array.isArray(data[LIST[kind]]) ? data[LIST[kind]] : []);
const effId = (e, i) => (e && e.id !== undefined && e.id !== null ? e.id : `i${i}`);
const blank = (e, kind) => (kind === 'job' ? !norm(e?.company) && !norm(e?.title) && !norm(e?.period) : !norm(e?.institution) && !norm(e?.degree) && !norm(e?.year));
const labelOf = (e, kind, i) => (kind === 'job' ? norm(e.company) || norm(e.title) || `Job ${i + 1}` : norm(e.institution) || norm(e.degree) || `Education ${i + 1}`);

// Every job and education entry that has something in it, with where its date is. { ref: { kind, id }, label, text, ambiguous }.
export function listDateEntries(data) {
  const out = [];
  for (const kind of ['job', 'edu']) {
    const list = listOf(data, kind);
    const counts = new Map();
    list.forEach((e, i) => counts.set(effId(e, i), (counts.get(effId(e, i)) || 0) + 1));
    list.forEach((e, i) => {
      if (!e || typeof e !== 'object' || blank(e, kind)) return;
      const id = effId(e, i);
      out.push({ ref: { kind, id }, label: labelOf(e, kind, i), text: typeof e[FIELD[kind]] === 'string' ? e[FIELD[kind]] : '', ambiguous: counts.get(id) > 1 });
    });
  }
  return out;
}

function findEntry(data, ref) {
  if (!isRef(ref)) return { error: 'not_found' };
  const list = listOf(data, ref.kind);
  const hits = list.map((e, i) => (e && typeof e === 'object' && effId(e, i) === ref.id ? i : -1)).filter(i => i >= 0);
  if (hits.length === 0) return { error: 'not_found' };
  if (hits.length > 1) return { error: 'ambiguous' };
  return { index: hits[0] };
}

// Only what code can see: 'missing' (nothing written), 'unreadable' (no date can be read in it), 'end_before_start'.
// The same year written with a different precision (2021 and Mar 2021) is not decided, so it is not a finding.
export function dateFindings(entry) {
  const text = norm(entry?.text);
  if (!text) return ['missing'];
  const range = findDateRangeInLine(text)?.range ?? parseDateRange(text);
  const s = range.start?.normalized_value;
  if (!s || s === 'present') return ['unreadable'];
  const e = range.end?.normalized_value;
  if (e && e !== 'present') {
    const sy = Number(s.slice(0, 4)); const ey = Number(e.slice(0, 4));
    if (ey < sy || (ey === sy && s.length === e.length && e < s)) return ['end_before_start'];
  }
  return [];
}

// Writes what the user typed in the one date field of the one entry. Returns { data, record } or { error: 'no_data' | 'empty' | 'not_found' | 'ambiguous' | 'unchanged' }.
export function setDate(data, ref, text) {
  if (!data || typeof data !== 'object') return { error: 'no_data' };
  const after = norm(text);
  if (!after) return { error: 'empty' };
  const f = findEntry(data, ref);
  if (f.error) return { error: f.error };
  const entry = data[LIST[ref.kind]][f.index];
  const before = typeof entry[FIELD[ref.kind]] === 'string' ? entry[FIELD[ref.kind]] : '';
  if (norm(before) === after) return { error: 'unchanged' };
  const copy = JSON.parse(JSON.stringify(data));
  copy[LIST[ref.kind]][f.index][FIELD[ref.kind]] = after;
  return { data: copy, record: { kind: 'dates', changes: [{ ref: { kind: ref.kind, id: ref.id }, before, after }] } };
}

const isDatesRecord = (r) => !!r && r.kind === 'dates' && Array.isArray(r.changes);
const keyOf = (ref) => `${ref.kind}:${ref.id}`;

// Several changes in one visit become one record: the same entry keeps its first before and its last after, and a change that returns to where it started is no change.
export function mergeDateRecords(prev, next) {
  const out = new Map();
  for (const rec of [prev, next]) {
    if (!isDatesRecord(rec)) continue;
    for (const c of rec.changes) {
      const k = keyOf(c.ref);
      out.set(k, out.has(k) ? { ref: c.ref, before: out.get(k).before, after: c.after } : { ref: c.ref, before: c.before, after: c.after });
    }
  }
  return { kind: 'dates', changes: [...out.values()].filter(c => norm(c.before) !== norm(c.after)) };
}

// 'open' (no change recorded), 'applied' (every date is still as it was saved), 'applied_edited' (changed afterwards, or the entry or the data is gone).
export function datesStatus(data, record) {
  if (!isDatesRecord(record) || record.changes.length === 0) return 'open';
  if (!data || typeof data !== 'object') return 'applied_edited';
  for (const c of record.changes) {
    const f = findEntry(data, c.ref);
    if (f.error) return 'applied_edited';
    const cur = data[LIST[c.ref.kind]][f.index][FIELD[c.ref.kind]];
    if (norm(cur) !== norm(c.after)) return 'applied_edited';
  }
  return 'applied';
}

// Takes the change back (to the date as it was, even a missing one), but only while it is still as it was saved; otherwise null.
export function undoDates(data, record) {
  if (datesStatus(data, record) !== 'applied') return null;
  const copy = JSON.parse(JSON.stringify(data));
  for (const c of record.changes) {
    const f = findEntry(copy, c.ref);
    copy[LIST[c.ref.kind]][f.index][FIELD[c.ref.kind]] = c.before;
  }
  return copy;
}
