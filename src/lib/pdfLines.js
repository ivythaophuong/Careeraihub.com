// Rebuilds the lines of a PDF page from pdf.js text items. pdf.js returns text RUNS (a run is a stretch of text in one style), not lines:
// a line with a bold role and a regular date is two items, a bullet glyph can be an item of its own and a sentence can be split in the
// middle. Joining every item with a newline (what this code did before) therefore turned one printed line into several. Here items on the
// same visual line are joined, using pdf.js's end-of-line flag and the vertical position. Reading order is the order pdf.js gives; two-column
// pages and tables are NOT handled here (known limit, tracked by the reader quality gate).
const GAP_FOR_SPACE = 0.15; // a horizontal gap wider than this share of the text height means a space between two runs

export function buildLinesFromPdfItems(items) {
  const lines = [];
  let cur = null;
  const flush = () => {
    if (cur) { const t = cur.text.trim(); if (t) lines.push(t); }
    cur = null;
  };
  for (const it of Array.isArray(items) ? items : []) {
    const str = typeof it?.str === 'string' ? it.str : '';
    const tr = Array.isArray(it?.transform) ? it.transform : null;
    const x = tr ? tr[4] : NaN, y = tr ? tr[5] : NaN;
    const h = Math.abs(tr ? tr[3] : 0) || Number(it?.height) || 10;
    if (str === '') { if (it?.hasEOL) flush(); continue; }
    if (cur && Number.isFinite(y) && Number.isFinite(cur.y) && Math.abs(y - cur.y) > Math.max(2, cur.h * 0.5)) flush();
    if (!cur) {
      cur = { text: str, y, h, endX: Number.isFinite(x) ? x + (Number(it.width) || 0) : NaN };
    } else {
      const glued = /\s$/.test(cur.text) || /^\s/.test(str);
      const gap = Number.isFinite(x) && Number.isFinite(cur.endX) ? x - cur.endX : NaN;
      const needSpace = !glued && (!Number.isFinite(gap) || gap > cur.h * GAP_FOR_SPACE);
      cur.text += (needSpace ? ' ' : '') + str;
      cur.endX = Number.isFinite(x) ? x + (Number(it.width) || 0) : cur.endX;
    }
    if (it?.hasEOL) flush();
  }
  flush();
  return lines.join('\n');
}
