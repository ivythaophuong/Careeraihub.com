// Two-column PDF pages. pdf.js gives text runs with a position; buildLinesFromPdfItems (pdfLines.js) joins the runs of one baseline into one
// line, so on a two-column page a line of the left column and the line of the right column that happens to share its baseline become ONE line
// ("Project Manager, Delta Build BSc Civil Engineering") and the two columns are read interleaved, which no section reader can follow.
// This reads such a page column by column instead: first the left column, then the right, with full-width lines (a name banner) kept in place.
//
// It is deliberately conservative, because a table also has runs side by side. It returns null (use the normal reading) unless ALL hold:
//   - there is one vertical gap wide enough to be a gutter, crossed by very few runs (a banner, a rule)
//   - both sides hold enough text on enough separate lines, and cover overlapping heights
//   - neither side has a gutter of its own (three or more columns is a table or a grid, not a two-column resume)
// The caller uses this only when the normal reading could not find any section, never instead of it.
import { buildLinesFromPdfItems } from './pdfLines';

const MIN_RUNS_PER_SIDE = 6;
const MIN_LINES_PER_SIDE = 4;
const MIN_GUTTER = 14;          // PDF units of empty width between the columns
const MAX_CROSSING_SHARE = 0.12; // share of runs allowed to span the gutter (a banner, a rule)
const BASELINE_TOL = 2;
const MIN_SPAN = 250;
const INNER_MIN_SPAN = 120;     // the narrowest side that is still checked for a gutter of its own
const INNER_MIN_RUNS = 8;
const INNER = { minSpan: INNER_MIN_SPAN, minRuns: INNER_MIN_RUNS, crossingShare: 0, minGap: 20 }; // inside one column nothing may cross the band: a ragged right edge is not a gutter

const toRuns = (items) => (Array.isArray(items) ? items : []).map((it, i) => {
  const str = typeof it?.str === 'string' ? it.str : '';
  const tr = Array.isArray(it?.transform) ? it.transform : null;
  const x = tr ? tr[4] : NaN, y = tr ? tr[5] : NaN, w = Number(it?.width);
  return { it, i, str, x, y, w: Number.isFinite(w) ? w : 0 };
}).filter(r => r.str.trim() && Number.isFinite(r.x) && Number.isFinite(r.y));

function findGutter(runs, { minSpan = MIN_SPAN, minRuns = MIN_RUNS_PER_SIDE * 2, crossingShare = MAX_CROSSING_SHARE, minGap = MIN_GUTTER } = {}) {
  if (runs.length < minRuns) return null;
  const minX = Math.min(...runs.map(r => r.x)), maxX = Math.max(...runs.map(r => r.x + r.w));
  const span = maxX - minX;
  if (span < minSpan) return null;
  const allowed = Math.floor(runs.length * crossingShare);
  let best = null, start = null;
  const lo = Math.floor(minX + span * 0.2), hi = Math.ceil(minX + span * 0.8);
  for (let c = lo; c <= hi + 1; c++) {
    const crossing = c <= hi ? runs.filter(r => r.x < c && r.x + r.w > c).length : Infinity;
    if (crossing <= allowed) { if (start === null) start = c; }
    else if (start !== null) { if (!best || c - 1 - start > best.b - best.a) best = { a: start, b: c - 1 }; start = null; }
  }
  if (!best || best.b - best.a < minGap) return null;
  return (best.a + best.b) / 2;
}

const baselines = (runs) => [...new Set(runs.map(r => Math.round(r.y / BASELINE_TOL)))];

// Returns the page text read column by column, or null when the page is not clearly two columns.
export function buildColumnLines(items) {
  const runs = toRuns(items);
  const g = findGutter(runs);
  if (g === null) return null;
  const side = (r) => (r.x < g && r.x + r.w > g ? 'S' : (r.x + r.w / 2 < g ? 'L' : 'R'));
  const L = runs.filter(r => side(r) === 'L'), R = runs.filter(r => side(r) === 'R');
  if (L.length < MIN_RUNS_PER_SIDE || R.length < MIN_RUNS_PER_SIDE) return null;
  const lb = baselines(L), rb = baselines(R);
  if (lb.length < MIN_LINES_PER_SIDE || rb.length < MIN_LINES_PER_SIDE) return null;
  const yMin = (rs) => Math.min(...rs.map(r => r.y)), yMax = (rs) => Math.max(...rs.map(r => r.y));
  const overlap = Math.min(yMax(L), yMax(R)) - Math.max(yMin(L), yMin(R));
  const shorter = Math.min(yMax(L) - yMin(L), yMax(R) - yMin(R));
  if (shorter <= 0 || overlap < shorter * 0.5) return null;
  // Three or more columns: a side that has a gutter of its own is a table or a grid.
  if (findGutter(L, INNER) !== null || findGutter(R, INNER) !== null) return null;

  // Read top to bottom (PDF y grows upwards). Full-width runs split the page into blocks; inside a block the left column comes first.
  const ordered = [...runs].sort((a, b) => b.y - a.y || a.x - b.x);
  const out = [];
  let block = [];
  const flushBlock = () => {
    if (!block.length) return;
    const left = block.filter(r => side(r) === 'L').map(r => r.it), right = block.filter(r => side(r) === 'R').map(r => r.it);
    for (const part of [left, right]) { const t = buildLinesFromPdfItems(part); if (t) out.push(t); }
    block = [];
  };
  let full = [];
  const flushFull = () => { if (full.length) { const t = buildLinesFromPdfItems(full.map(r => r.it)); if (t) out.push(t); full = []; } };
  for (const r of ordered) {
    if (side(r) === 'S') { flushBlock(); full.push(r); }
    else { flushFull(); block.push(r); }
  }
  flushBlock(); flushFull();
  return out.join('\n');
}
