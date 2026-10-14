// A suggestion with a figure the resume never had is saved with a [X] blank for the person to fill in, and a model may write its own blank
// ([number], [City, Region]); factGuard.js decides what counts. Before a file leaves the app, ask once if a blank is still there, so "[X]%"
// or "[number]" does not go to a recruiter by accident.
import { countBlanks } from './factGuard.js';

export const countPlaceholders = countBlanks;

// true = go ahead with the export.
export function confirmExport(text) {
  const n = countPlaceholders(text);
  if (!n) return true;
  return window.confirm(
    `Your resume still has ${n} ${n === 1 ? 'blank' : 'blanks'} in [square brackets] (such as [X]) where a detail is missing. ` +
    'Fill them in with real details or remove them before you send it.\n\nExport anyway?'
  );
}
