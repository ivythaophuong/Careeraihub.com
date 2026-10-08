// Deterministic clean-up of extracted text, so the same document always gives the same text.
// It never adds or rewords anything: it only fixes encoding noise and whitespace.
export function normalizeText(input) {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[​-‍⁠﻿]/g, '')          // zero-width characters and BOM
    .replace(/ /g, ' ')                                // no-break space
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // control characters except \n and \t
    .replace(/[ \t]+$/gm, '')                               // trailing spaces
    .replace(/\n{3,}/g, '\n\n')                             // at most one blank line in a row
    .trim();
}

export const countWords = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0);
