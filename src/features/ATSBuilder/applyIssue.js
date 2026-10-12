// Puts an AI suggestion ("before" -> "after") into the Builder data, as a proposal the user accepts.
// Never guesses: the quoted "before" must sit in exactly one place (the summary or one bullet).
// Figures in "after" that the resume does not already contain become [X] for the user to fill in.
import { neutralizeInventedFigures, revertInsertion } from '../../lib/factGuard.js';
import { builderDataToText } from './builderText.js';

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// Every editable text field, in a fixed order, with where it lives.
function fields(d) {
  const out = [{ at: { kind: 'summary' }, text: d.summary || '' }];
  (d.experience || []).forEach((j, exp) => (j.bullets || []).forEach((b, bullet) => out.push({ at: { kind: 'bullet', exp, bullet }, text: b || '' })));
  return out;
}

export function locateBefore(data, before) {
  const q = norm(before);
  if (!q) return null;
  const hits = fields(data || {}).filter(f => norm(f.text).includes(q));
  return hits.length === 1 ? hits[0].at : null;
}

const read = (d, at) => (at.kind === 'summary' ? d.summary || '' : d.experience[at.exp].bullets[at.bullet] || '');
const write = (d, at, text) => {
  const c = JSON.parse(JSON.stringify(d));
  if (at.kind === 'summary') c.summary = text;
  else c.experience[at.exp].bullets[at.bullet] = text;
  return c;
};

// Replaces the quoted passage, keeping the rest of the field. Returns { data, record, placeholders } or { error }.
export function applyIssue(data, issue) {
  const after = String(issue?.after ?? '').trim();
  if (!after) return { error: 'empty_after' };
  const at = locateBefore(data, issue.before);
  if (!at) return { error: 'not_found' };

  const guarded = neutralizeInventedFigures(after, builderDataToText(data));
  const current = read(data, at);
  const q = norm(issue.before);
  // Spacing in the field may differ from the quote, so find the passage through a whitespace-tolerant pattern.
  const pattern = new RegExp(q.split(' ').map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'));
  const match = current.match(pattern);
  const original = match[0];
  const next = current.slice(0, match.index) + guarded.text + current.slice(match.index + original.length);

  return {
    data: write(data, at, next),
    record: { at, inserted: guarded.text, original },
    placeholders: guarded.changed,
    replaced: guarded.replaced,
  };
}

// Puts the original passage back. Returns null when the inserted text can no longer be found (the user edited it).
export function undoApply(data, record) {
  try {
    const back = revertInsertion(read(data, record.at), record);
    return back === null ? null : write(data, record.at, back);
  } catch { return null; } // the bullet or job was removed meanwhile
}
