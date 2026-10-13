// The logic behind the Fix page (no screen): where an issue's quoted text is, what the AI draft would put in that field, saving what the user wrote
// in one field, and the status of each issue. Pure functions over the Builder data. They reuse applyIssue.js (finding the quote, the figure guard that turns
// a number the resume does not have into [X], undo by content) and claimGuard.js; nothing here calls AI or touches storage.
import { locateAll, applyIssue, undoApply } from './applyIssue.js';
import { claimWarnings } from '../../lib/claimGuard.js';
import { countPlaceholders } from '../../lib/exportGuard.js';
import { builderDataToText } from './builderText.js';
import { skillsStatus, undoSkills } from './skillsFix.js';
import { datesStatus, undoDates } from './datesFix.js';

const nfc = (s) => String(s ?? '').normalize('NFC');

const rawField = (d, at) => (at?.kind === 'summary' ? d?.summary : d?.experience?.[at?.exp]?.bullets?.[at?.bullet]);
const readField = (d, at) => nfc(rawField(d, at));
const writeField = (d, at, text) => {
  const c = JSON.parse(JSON.stringify(d));
  if (at.kind === 'summary') c.summary = text;
  else c.experience[at.exp].bullets[at.bullet] = text;
  return c;
};

// The templates draw the summary when it has text, and a bullet only when it has text and its job has a company name.
function isDrawn(data, at) {
  if (at.kind === 'summary') return !!nfc(data.summary).trim();
  return !!data.experience?.[at.exp]?.company && !!readField(data, at).trim();
}

// Where the issue's quoted text is. kind: 'no_before' (nothing quoted), 'none' (not found), 'one', 'many' (the user chooses; nothing is picked).
// A place can be found in the data and not drawn in the preview (`drawn: false`).
export function fixTargets(data, issue) {
  const before = issue?.before;
  if (!before || !String(before).trim()) return { kind: 'no_before', places: [] };
  const places = locateAll(data, before).map(h => ({ at: h.at, label: h.label, text: h.text, drawn: isDrawn(data, h.at) }));
  return { kind: places.length === 0 ? 'none' : places.length === 1 ? 'one' : 'many', places };
}

// What the whole field would read after the AI draft replaces the quoted words, as it would be saved: a figure the resume does not contain is [X].
// `at` is needed when the quote is in several places. Returns { text, placeholders, replaced, warnings } or { error: 'empty_after' | 'not_found' }.
export function suggestionFor(data, issue, at) {
  const r = applyIssue(data, issue, at);
  if (r.error) return { error: r.error };
  const warnings = claimWarnings({ before: issue.before, after: issue.after, resumeText: builderDataToText(data) }).map(w => w.message);
  return { text: readField(r.data, r.record.at), placeholders: r.placeholders, replaced: r.replaced, warnings };
}

// Saves what the user wrote as the whole text of one field. Everything else stays as it was. The record has the shape undoApply reads.
// Returns { data, record, blanks } (blanks = how many [X] are left in the text) or { error: 'empty' | 'not_found' }.
export function saveFix(data, at, text) {
  const next = nfc(text).trim();
  if (!next) return { error: 'empty' };
  const original = rawField(data, at);
  if (original === undefined || original === null) return { error: 'not_found' };
  return { data: writeField(data, at, next), record: { at, inserted: next, original: String(original) }, blanks: countPlaceholders(next) };
}

// The status of an issue, read from the text as it is now (never "resolved"):
//   'applied'         saved, and the saved text is still there
//   'applied_edited'  saved, then the user changed it
//   'needs_figure'    saved but a [X] blank is still in it: it stays open
//   'changed'         nothing saved and the quoted text is gone
//   'open'            nothing saved and the quoted text is still there (or there is no quoted text)
export function issueStatus(data, issue, record) {
  if (record?.kind === 'skills') return skillsStatus(data, record);
  if (record?.kind === 'dates') return datesStatus(data, record);
  if (record) {
    if (undoApply(data, record) === null) return 'applied_edited';
    return countPlaceholders(readField(data, record.at)) > 0 ? 'needs_figure' : 'applied';
  }
  if (issue?.before && String(issue.before).trim() && locateAll(data, issue.before).length === 0) return 'changed';
  return 'open';
}

const UNRESOLVED = new Set(['open', 'needs_figure', 'changed']);

// The next issue after `from` that is not yet applied, or null at the end (then the summary is shown). A skipped issue stays unresolved.
export const nextUnresolved = (statuses, from) => {
  for (let i = from + 1; i < statuses.length; i++) if (UNRESOLVED.has(statuses[i])) return i;
  return null;
};
export const firstUnresolved = (statuses) => {
  const i = statuses.findIndex(s => UNRESOLVED.has(s));
  return i === -1 ? null : i;
};

// Counts of what is, for the last screen. Nothing here says everything is fixed.
export function summaryCounts(statuses) {
  const n = (...k) => statuses.filter(s => k.includes(s)).length;
  return { total: statuses.length, applied: n('applied'), open: n('open', 'needs_figure'), changedByYou: n('applied_edited', 'changed') };
}

// The key a record is kept under in the Suggestions panel (BuilderIssuesPanel), so the Fix page and the panel share their records.
export const issueKey = (issue, i) => `${i}:${issue?.title || ''}:${issue?.before || ''}`;

// The text of one field now ('' when the place does not exist).
export const fieldText = (data, at) => readField(data, at);

// A copy of the data with one field replaced, to preview a typed text before it is saved. A place that does not exist gives the data back as it was.
export function withFieldText(data, at, text) {
  if (rawField(data, at) === undefined || rawField(data, at) === null) return data;
  return writeField(data, at, String(text ?? ''));
}

// The bullets nearest to a quote that is not in the resume (the AI paraphrased it, or the user changed the sentence). Nothing here is a guess about
// meaning: it counts the words the quote and the bullet share. A bullet is listed when it shares at least half of the quote's words, best first,
// at most three; the user chooses, and the summary is never offered.
const words = (text) => new Set((nfc(text).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'+&%$.-]*/gu) || []).map(w => w.replace(/[.-]+$/, '')).filter(Boolean));
export function closestBullets(data, issue, { min = 0.5, max = 3 } = {}) {
  const q = words(issue?.before);
  if (!q.size) return [];
  const out = [];
  (data?.experience || []).forEach((job, exp) => (job.bullets || []).forEach((b, bullet) => {
    const w = words(b);
    if (!w.size) return;
    let shared = 0; for (const x of q) if (w.has(x)) shared++;
    const score = shared / q.size;
    if (score >= min) out.push({ at: { kind: 'bullet', exp, bullet }, score });
  }));
  return out.sort((a, b) => b.score - a.score).slice(0, max);
}

// Takes a recorded change back, whatever kind it is (a sentence or the skills list). null when it was changed afterwards and cannot be undone automatically.
export const undoRecord = (data, record) => (!record ? null : record.kind === 'skills' ? undoSkills(data, record) : record.kind === 'dates' ? undoDates(data, record) : undoApply(data, record));
