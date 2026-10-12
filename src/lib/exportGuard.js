// A suggestion with a figure the resume never had is saved with a [X] blank for the person to fill in (factGuard.js).
// Before a file leaves the app, ask once if a blank is still there, so "[X]%" does not go to a recruiter by accident.
const BLANK = /\[[XY]\]/g;

export const countPlaceholders = (text) => (String(text ?? '').match(BLANK) || []).length;

// true = go ahead with the export.
export function confirmExport(text) {
  const n = countPlaceholders(text);
  if (!n) return true;
  return window.confirm(
    `Your resume still has ${n} ${n === 1 ? 'blank' : 'blanks'} marked [X] where a figure is missing. ` +
    'Fill them in with real figures or remove them before you send it.\n\nExport anyway?'
  );
}
