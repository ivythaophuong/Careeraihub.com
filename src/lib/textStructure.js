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

// A text with real lines in which no experience, education or skill could be read has a layout the extractor cannot follow (two columns read
// line by line, a table, headings it does not know). Scoring it would give a low number that says nothing about the CV, so, like lost line
// breaks, the honest answer is "cannot read the sections", not a score. A short or thin text is never judged, and anything read at all
// (an entry-level CV with only education and skills, for example) means the layout was readable.
const MIN_UNREADABLE_LINES = 6;
const MIN_UNREADABLE_CHARS = 250;

export function detectUnreadableSections(text, found) {
  const t = normalizeResumeText(text);
  const lines = t.split('\n').filter((l) => l.trim()).length;
  const anything = (found?.experiences || 0) + (found?.education || 0) + (found?.skills || 0) > 0;
  if (anything || lines < MIN_UNREADABLE_LINES || t.length < MIN_UNREADABLE_CHARS) return { unreadable: false };
  return { unreadable: true, reason: 'No experience, education or skills could be found in this text, so the sections cannot be told apart.' };
}
