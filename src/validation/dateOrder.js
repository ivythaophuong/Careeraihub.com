// Orders two ResumeFacts normalized date values ("YYYY", "YYYY-MM", "present", or null). No AI.
// Deliberately conservative: when the two values cannot be compared with confidence (same year but only
// one of them has a month, or either value is unknown), the answer is null ("cannot tell"), not a guess —
// consistent with the rest of this project's "don't guess" rule. A caller must treat null as "no finding",
// never as evidence of a problem.
function parseNormalized(n) {
  if (n === 'present') return { year: Infinity, month: 12 };
  if (typeof n !== 'string') return null;
  const m = /^(\d{4})(?:-(\d{2}))?$/.exec(n);
  if (!m) return null;
  return { year: Number(m[1]), month: m[2] ? Number(m[2]) : null };
}

// Returns -1 (a before b), 0 (same), 1 (a after b), or null (cannot tell with confidence).
export function compareNormalizedDates(a, b) {
  const pa = parseNormalized(a);
  const pb = parseNormalized(b);
  if (!pa || !pb) return null;
  if (pa.year !== pb.year) return pa.year < pb.year ? -1 : 1;
  if (pa.month === null || pb.month === null) return pa.year === Infinity && pb.year === Infinity ? 0 : null;
  if (pa.month === pb.month) return 0;
  return pa.month < pb.month ? -1 : 1;
}

// Do [startA, endA] and [startB, endB] overlap? Only answers true/false when every comparison needed is
// confident; otherwise null ("cannot tell"), e.g. when one range's precision is too coarse to resolve
// against the other.
export function rangesOverlap(startA, endA, startB, endB) {
  const aStartsBeforeBEnds = compareNormalizedDates(startA, endB);
  const bStartsBeforeAEnds = compareNormalizedDates(startB, endA);
  if (aStartsBeforeBEnds === null || bStartsBeforeAEnds === null) return null;
  return aStartsBeforeBEnds < 0 && bStartsBeforeAEnds < 0;
}
