// Turns the text items pdf.js returns for ONE page into lines.
// Each item is { str, transform: [a, b, c, d, x, y], width, hasEOL }. Items on the same baseline belong
// to one line; a gap between them becomes a space, no gap means the pieces are one word. (The old code
// put every item on its own line, which tore a line like "Skills: SQL, Python" into two.)
// A wide gap on one line (two columns, a table cell, a right-aligned date) is written as a TAB, so the
// reading order is not silently mixed: 'Skills<TAB>Experience'. Whether the page is really two columns
// or a table is a later step's job; `layoutHint` only reports that tabs are common.
// Known limit: if the PDF stores a two-column page row by row, the text still comes out row by row.
const SAME_LINE_TOLERANCE = 2;   // PDF units
const WORD_GAP = 1.5;            // PDF units; larger than this means a space
const COLUMN_GAP = 30;           // PDF units; a gap this wide on one line is a column or table cell, kept as a tab

export function joinPdfItems(items) {
  const parts = [];
  let lastY = null, lastEnd = null;
  for (const it of items || []) {
    if (typeof it?.str !== 'string') continue;
    const x = Array.isArray(it.transform) ? it.transform[4] : null;
    const y = Array.isArray(it.transform) ? it.transform[5] : null;
    if (it.str === '') { if (it.hasEOL) { parts.push('\n'); lastY = null; lastEnd = null; } continue; }
    // pdf.js reports a gap between two runs on a line as a whitespace-only item whose width is the gap.
    if (it.str.trim() === '') {
      if (parts.length && lastY !== null && y !== null && Math.abs(y - lastY) <= SAME_LINE_TOLERANCE && typeof it.width === 'number') {
        const last = parts[parts.length - 1];
        if (it.width >= COLUMN_GAP) { if (!/[\t\n]$/.test(last)) parts.push('\t'); }
        else if (it.width > WORD_GAP && !/\s$/.test(last)) parts.push(' ');
        lastEnd = x !== null ? x + it.width : null;
      }
      continue;
    }
    if (parts.length) {
      const newLine = y !== null && lastY !== null && Math.abs(y - lastY) > SAME_LINE_TOLERANCE;
      if (newLine) parts.push('\n');
      else if (x !== null && lastEnd !== null) {
        const gap = x - lastEnd;
        if (gap >= COLUMN_GAP) parts.push('\t');
        else if (gap > WORD_GAP && !/\s$/.test(parts[parts.length - 1]) && !/^\s/.test(it.str)) parts.push(' ');
      } else if (!/\s$/.test(parts[parts.length - 1]) && !/^\s/.test(it.str)) parts.push(' ');
    }
    parts.push(it.str);
    lastY = y;
    lastEnd = x !== null && typeof it.width === 'number' ? x + it.width : null;
    if (it.hasEOL) { parts.push('\n'); lastY = null; lastEnd = null; }
  }
  return parts.join('');
}

// Share of lines that contain a tab. Many tabs = columns or a table, so reading order may be mixed.
export function layoutHint(pageText) {
  const lines = String(pageText || '').split('\n').filter(l => l.trim());
  const tabbed = lines.filter(l => l.includes('\t')).length;
  return { lines: lines.length, tabbed, columnar: lines.length >= 4 && tabbed / lines.length >= 0.4 };
}

// Lines that repeat at the edge of every page (running header, footer, "Confidential") are kept once.
// Lines are compared exactly, except for a page counter ("Page 1 of 2" / "Trang 2/3"), whose numbers are
// ignored. Other digits are NOT ignored: "Project 1: ..." and "Project 12: ..." are different lines.
const PAGE_COUNTER = /\b(page|trang)\s*\d+(\s*(of|\/|trên)\s*\d+)?/gi;
const key = (l) => l.replace(PAGE_COUNTER, '$1 #').replace(/\s+/g, ' ').trim();
const EDGE = 3, MIN_LEN = 8, MAX_LEN = 100;
export function removeRepeatedPageLines(pages) {
  if (!Array.isArray(pages) || pages.length < 2) return { pages, removed: 0 };
  // The length limits apply to the line as written, not to its key ("Page 1 of 2" -> "Page #" would be too short).
  const edgeKeys = (lines) => new Set(lines.filter((l, i) => (i < EDGE || i >= lines.length - EDGE) && l.trim().length >= MIN_LEN && l.trim().length <= MAX_LEN).map(key));
  const split = pages.map(p => p.split('\n'));
  const sets = split.map(edgeKeys);
  const common = new Set([...sets[0]].filter(k => sets.every(s => s.has(k))));
  if (!common.size) return { pages, removed: 0 };
  const seen = new Set();
  let removed = 0;
  const out = split.map(lines => lines.filter((l, i) => {
    const k = key(l);
    if (!(i < EDGE || i >= lines.length - EDGE) || !common.has(k)) return true;
    if (!seen.has(k)) { seen.add(k); return true; }
    removed++; return false;
  }).join('\n'));
  return { pages: out, removed };
}
