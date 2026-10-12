// Puts an AI suggestion ("before" -> "after") into the Builder data, as a proposal the user accepts.
// Never guesses: the quoted "before" must be found in a place the user can see, and when it is in several places the user chooses.
// Figures in "after" that the resume does not already contain become [X] for the user to fill in.
// Undo finds the inserted text by its content, not by a position, so deleting or moving a job or bullet cannot send it to the wrong place.
import { neutralizeInventedFigures } from '../../lib/factGuard.js';
import { builderDataToText } from './builderText.js';

const INVISIBLE = /[​-‍⁠﻿­]/g;
const nfc = (s) => String(s ?? '').normalize('NFC');

// One regex for the quote that ignores differences with no meaning: spaces (incl. no-break), curly vs straight quotes, dash kinds,
// zero-width marks. Words and numbers must match exactly.
// The AI often shortens a quote with an ellipsis ("...", "…") at the start, the end or the middle. The mark is not in the resume, so it is not
// matched: the parts around it must come in order inside one field (one bullet or the summary), and a full stop that ends the quote is optional.
// A quote that is nothing but dots, or too short once they are gone, finds nothing (it would match almost anywhere).
const MIN_QUOTE_CHARS = 6;
function quotePattern(before) {
  const q = nfc(before).replace(INVISIBLE, '').trim();
  const ch = (c) => {
    if (/['‘’‛]/.test(c)) return "['‘’‛]";
    if (/["“”‟]/.test(c)) return '["“”‟]';
    if (/[-‐‑–—]/.test(c)) return '[-‐‑–—]';
    return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };
  const parts = q.split(/\s*(?:\.{3,}|…)\s*/).map(x => x.trim()).filter(Boolean);
  if (parts.length) parts[parts.length - 1] = parts[parts.length - 1].replace(/[.,;:]+$/, '').trim();
  const kept = parts.filter(Boolean);
  if (!kept.length || kept.join('').length < MIN_QUOTE_CHARS) return null;
  return new RegExp(kept.map(part => part.split(/\s+/).map(w => Array.from(w).map(ch).join('')).join('\\s+')).join('.*?'));
}

// Every editable text field, in a fixed order, with where it lives and a name the user can read.
function fields(d) {
  const out = [{ at: { kind: 'summary' }, text: nfc(d.summary), label: 'Summary' }];
  (d.experience || []).forEach((j, exp) => (j.bullets || []).forEach((b, bullet) =>
    out.push({ at: { kind: 'bullet', exp, bullet }, text: nfc(b), label: `${j.company || 'Job ' + (exp + 1)}, bullet ${bullet + 1}` })));
  return out;
}

export function locateAll(data, before) {
  const re = quotePattern(before);
  if (!re) return [];
  return fields(data || {}).filter(f => re.test(f.text)).map(f => ({ at: f.at, label: f.label, text: f.text }));
}

// The one place the quote is in, or null (not found, or in more than one place).
export function locateBefore(data, before) {
  const hits = locateAll(data, before);
  return hits.length === 1 ? hits[0].at : null;
}

const read = (d, at) => nfc(at.kind === 'summary' ? d.summary : d.experience?.[at.exp]?.bullets?.[at.bullet]);
const write = (d, at, text) => {
  const c = JSON.parse(JSON.stringify(d));
  if (at.kind === 'summary') c.summary = text;
  else c.experience[at.exp].bullets[at.bullet] = text;
  return c;
};

// Replaces the quoted passage, keeping the rest of the field. `chosen` picks the place when the quote is in several.
// Returns { data, record, placeholders, replaced } or { error: 'empty_after' | 'not_found' }.
export function applyIssue(data, issue, chosen) {
  const after = String(issue?.after ?? '').trim();
  if (!after) return { error: 'empty_after' };
  const hits = locateAll(data, issue.before);
  const at = chosen ? hits.find(h => JSON.stringify(h.at) === JSON.stringify(chosen))?.at : (hits.length === 1 ? hits[0].at : null);
  if (!at) return { error: 'not_found' };

  const guarded = neutralizeInventedFigures(after, builderDataToText(data));
  const current = read(data, at);
  const match = current.match(quotePattern(issue.before));
  // A full stop that ends the quote is optional when matching, so it may still be in the resume after the match: when the replacement ends with a
  // mark of its own, that mark is replaced too, and the sentence does not end with two.
  let end = match.index + match[0].length;
  if (/[.,;:]/.test(current[end] || '') && /[.,;:]$/.test(guarded.text)) end += 1;
  const next = current.slice(0, match.index) + guarded.text + current.slice(end);
  return {
    data: write(data, at, next),
    record: { at, inserted: guarded.text, original: current.slice(match.index, end) },
    placeholders: guarded.changed,
    replaced: guarded.replaced,
  };
}

// Puts the original passage back. Looks for the inserted text in every field and acts only when it is in exactly one;
// returns null when it is gone (the user edited it) or in several places.
export function undoApply(data, record) {
  const hits = fields(data || {}).filter(f => record.inserted && f.text.includes(record.inserted));
  if (hits.length !== 1) return null;
  const { at, text } = hits[0];
  const pos = text.indexOf(record.inserted);
  return write(data, at, text.slice(0, pos) + record.original + text.slice(pos + record.inserted.length));
}
