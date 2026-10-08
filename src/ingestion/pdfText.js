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
// Lines are compared exactly, except for a page counter, whose number is ignored in two cases:
//   - an explicit one: "Page 1 of 2", "Trang 2/3"
//   - a bare number at the right end of the line (after a wide gap) that equals the page's own position (1 on
//     page 1, 2 on page 2...), as in "February 10, 2026<TAB>Jane Doe - Resume<TAB>2". A heading such as
//     "Chapter 1" has no wide gap and is not treated as a counter
// Any other digits are NOT ignored: "Project 1: ..." and "Project 12: ..." are different lines.
const PAGE_COUNTER = /\b(page|trang)\s*\d+(\s*(of|\/|trên)\s*\d+)?/gi;
const norm = (l) => l.replace(PAGE_COUNTER, '$1 #').replace(/\s+/g, ' ').trim();
const keyOf = (l, pageIndex) => {
  if (new RegExp(PAGE_COUNTER.source, 'i').test(l)) return norm(l);   // an explicit counter wins
  const m = l.match(/^(.*\S)\t(\d{1,3})\s*$/);   // right-aligned: after a wide gap (a tab), like a footer
  if (m && Number(m[2]) === pageIndex + 1) return 'PAGE#:' + norm(m[1]);
  return norm(l);
};
const EDGE = 3, MIN_LEN = 8, MAX_LEN = 100;
export function removeRepeatedPageLines(pages) {
  if (!Array.isArray(pages) || pages.length < 2) return { pages, removed: 0 };
  const split = pages.map(p => p.split('\n'));
  const isEdge = (lines, i) => i < EDGE || i >= lines.length - EDGE;
  // The length limits apply to the line as written, not to its key ("Page 1 of 2" -> "Page #" would be too short).
  const okLen = (l) => l.trim().length >= MIN_LEN && l.trim().length <= MAX_LEN;
  const sets = split.map((lines, pi) => new Set(lines.filter((l, i) => isEdge(lines, i) && okLen(l)).map(l => keyOf(l, pi))));
  const common = new Set([...sets[0]].filter(k => sets.every(s => s.has(k))));
  if (!common.size) return { pages, removed: 0 };
  const seen = new Set();
  let removed = 0;
  const out = split.map((lines, pi) => lines.filter((l, i) => {
    const k = keyOf(l, pi);
    if (!isEdge(lines, i) || !okLen(l) || !common.has(k)) return true;
    if (!seen.has(k)) { seen.add(k); return true; }
    removed++; return false;
  }).join('\n'));
  return { pages: out, removed };
}

// Some LaTeX (XeTeX) fonts store the hyphen and the dash of a date range as U+00AD (soft hyphen). pdf.js treats
// it as an invisible format character and drops it from the page text: "high-impact" becomes "highimpact" and
// "Sep. 2023 - Mar. 2024" becomes "Sep. 2023 Mar. 2024". The glyph is still in the page's drawing operations,
// so each text run that contains one is matched back to its text item and the dash is put back as "-".
// `runs` is a list of glyph-unicode arrays, one per drawn text run, only those that contain a soft hyphen.
// Returns { items, restored, unreadable }; an item that cannot be matched is left as it was and counted.
export const SOFT_HYPHEN = '\u00AD';
const squash = (s) => String(s).normalize('NFKC').replace(/\s+/g, '');
const LOOKAHEAD = 80;

// Where the soft hyphens sit, as "how many non-space characters come before it" (compared after NFKC, the
// form pdf.js uses for the text).
function dashPositions(glyphs) {
  const at = [];
  let count = 0;
  for (const g of glyphs) {
    if (g === SOFT_HYPHEN) at.push(count);
    else count += squash(g).length;
  }
  return at;
}

// Puts "-" into `str` at those positions without touching anything else, so the spaces pdf.js added for gaps
// survive. Inside a word the dash goes in directly ("high-impact"). Where the text has a space at that point
// (a date range: "2023 Mar.") it becomes " - " ("2023 - Mar.").
export function insertDashes(str, positions) {
  const todo = [...positions];
  let out = '', count = 0;
  const chars = [...str];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (/\s/.test(c)) {
      if (todo.length && todo[0] === count && i > 0) {
        let j = i; while (j < chars.length && /\s/.test(chars[j])) j++;
        if (j < chars.length) { out += chars.slice(i, j).join('') + '- '; i = j - 1; todo.shift(); continue; }
      }
      out += c; continue;
    }
    while (todo.length && todo[0] === count) { out += '-'; todo.shift(); }
    out += c;
    count += squash(c).length;
  }
  while (todo.length && todo[0] <= count) { out += '-'; todo.shift(); }
  return { text: out, left: todo.length };
}

export function restoreSoftHyphens(items, runs) {
  const out = (items || []).map(i => ({ ...i }));
  const used = new Set();
  let cursor = 0, restored = 0, unreadable = 0;
  for (const glyphs of runs || []) {
    const positions = dashPositions(glyphs);
    const plain = squash(glyphs.filter(g => g !== SOFT_HYPHEN).join(''));
    let found = -1;
    for (let k = cursor; k < Math.min(out.length, cursor + LOOKAHEAD); k++) {
      if (!used.has(k) && typeof out[k].str === 'string' && squash(out[k].str) === plain) { found = k; break; }
    }
    if (found < 0) { unreadable += positions.length; continue; }
    const r = insertDashes(out[found].str, positions);
    out[found].str = r.text;
    restored += positions.length - r.left;
    unreadable += r.left;
    used.add(found);
    cursor = found + 1;
  }
  return { items: out, restored, unreadable };
}
