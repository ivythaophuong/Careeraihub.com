// Chronology checks over an already-extracted ResumeFacts object (src/contracts/resumeFacts.js). No AI,
// no guessing: every finding only fires when compareNormalizedDates/rangesOverlap resolved with
// confidence (see dateOrder.js); an ambiguous pair produces no finding at all, not a false alarm.
import { compareNormalizedDates, rangesOverlap } from './dateOrder';

// A finding: { kind, severity: 'error' | 'warning', message, refs: [source paths involved] }.
const finding = (kind, severity, message, refs) => ({ kind, severity, message, refs });

// An entry's own end before its own start ("2024 - 2021") is an internal contradiction: wrong regardless
// of context, so it is an 'error'.
function checkEndBeforeStart(entries, kindLabel) {
  const out = [];
  entries.forEach((e, i) => {
    if (!e?.start?.normalized_value || !e?.end?.normalized_value) return;
    const cmp = compareNormalizedDates(e.start.normalized_value, e.end.normalized_value);
    if (cmp === 1) {
      out.push(finding(
        'end_before_start', 'error',
        `${kindLabel}[${i}]: the end date (${e.end.value}) is before the start date (${e.start.value}).`,
        [e.start.source, e.end.source],
      ));
    }
  });
  return out;
}

// Two experience entries overlapping in time is not necessarily wrong (a part-time role, freelancing
// alongside a job, a career transition), so this is a 'warning', not an 'error' — something for a human
// or a later AI step to look at, never something that blocks anything.
function checkOverlaps(experiences) {
  const out = [];
  for (let i = 0; i < experiences.length; i++) {
    for (let j = i + 1; j < experiences.length; j++) {
      const a = experiences[i], b = experiences[j];
      if (!a?.start?.normalized_value || !a?.end?.normalized_value) continue;
      if (!b?.start?.normalized_value || !b?.end?.normalized_value) continue;
      if (rangesOverlap(a.start.normalized_value, a.end.normalized_value, b.start.normalized_value, b.end.normalized_value) === true) {
        out.push(finding(
          'overlapping_experience', 'warning',
          `experiences[${i}] and experiences[${j}] overlap in time. This can be legitimate (a part-time role, freelancing alongside a job) — not flagged as an error.`,
          [a.start.source, a.end.source, b.start.source, b.end.source],
        ));
      }
    }
  }
  return out;
}

// Education entries (src/contracts/resumeFacts.js) currently carry only a single `year`, not a start/end
// range, so there is no "end before start" check to run on them yet.
export function checkChronology(facts) {
  const experiences = Array.isArray(facts?.experiences) ? facts.experiences : [];
  return [
    ...checkEndBeforeStart(experiences, 'experiences'),
    ...checkOverlaps(experiences),
  ];
}
