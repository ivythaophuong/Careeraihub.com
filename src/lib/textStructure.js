// Detects text whose line breaks were lost (a CV pasted from a source that flattened it, or extracted as one long line). Sections are found
// line by line, so such a text has no sections to read: scoring it would give a low number that says nothing about the CV. The honest answer
// is "cannot read the structure", not a score. A short text is never judged (there is too little to tell), and a text with real lines is never
// flagged, however bare it is: that is a thin CV, which is a different thing.
import { normalizeResumeText } from './textNormalize';

const MIN_CHARS = 400;        // below this there is too little text to judge
const MAX_LINES_ALWAYS = 2;   // a CV of this length on one or two lines has lost its structure
const MAX_LINES_LONG = 5;     // ... and so has one on up to five lines if the lines are very long
const AVG_LINE_LONG = 400;

export function detectLostStructure(text) {
  const t = normalizeResumeText(text);
  if (t.length < MIN_CHARS) return { lost: false };
  const lines = t.split('\n').filter((l) => l.trim()).length;
  const avg = t.length / Math.max(lines, 1);
  if (lines <= MAX_LINES_ALWAYS || (lines <= MAX_LINES_LONG && avg > AVG_LINE_LONG)) {
    return { lost: true, reason: 'This text has almost no line breaks, so the sections cannot be told apart.' };
  }
  return { lost: false };
}
