// Splits a feedback text into a one-sentence headline and the rest, so the screen can show the point first and the detail on request.
// A full stop inside a figure ("2.5") or before a lower-case word ("e.g. what") does not end a sentence.
export function splitFirstSentence(text) {
  const t = typeof text === 'string' ? text.trim() : '';
  if (!t) return { head: '', more: '' };
  const m = t.match(/^([\s\S]+?[.!?])\s+(?=[A-Z0-9"'(\[])/);
  if (!m) return { head: t, more: '' };
  return { head: m[1].trim(), more: t.slice(m[0].length).trim() };
}
