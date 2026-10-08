// Turns the text items pdf.js returns for ONE page into lines.
// Each item is { str, transform: [a, b, c, d, x, y], width, hasEOL }. Items on the same baseline belong
// to one line; a gap between them becomes a space, no gap means the pieces are one word. (The old code
// put every item on its own line, which tore a line like "Skills: SQL, Python" into two.)
// Known limit: a two-column layout is read left to right across both columns. That is a layout problem
// for a later step, not something this function can know.
const SAME_LINE_TOLERANCE = 2;   // PDF units
const WORD_GAP = 1.5;            // PDF units; larger than this means a space

export function joinPdfItems(items) {
  const parts = [];
  let lastY = null, lastEnd = null;
  for (const it of items || []) {
    if (typeof it?.str !== 'string') continue;
    const x = Array.isArray(it.transform) ? it.transform[4] : null;
    const y = Array.isArray(it.transform) ? it.transform[5] : null;
    if (it.str === '') { if (it.hasEOL) { parts.push('\n'); lastY = null; lastEnd = null; } continue; }
    if (parts.length) {
      const newLine = y !== null && lastY !== null && Math.abs(y - lastY) > SAME_LINE_TOLERANCE;
      if (newLine) parts.push('\n');
      else if (x !== null && lastEnd !== null) {
        if (x - lastEnd > WORD_GAP && !/\s$/.test(parts[parts.length - 1]) && !/^\s/.test(it.str)) parts.push(' ');
      } else if (!/\s$/.test(parts[parts.length - 1]) && !/^\s/.test(it.str)) parts.push(' ');
    }
    parts.push(it.str);
    lastY = y;
    lastEnd = x !== null && typeof it.width === 'number' ? x + it.width : null;
    if (it.hasEOL) { parts.push('\n'); lastY = null; lastEnd = null; }
  }
  return parts.join('');
}
