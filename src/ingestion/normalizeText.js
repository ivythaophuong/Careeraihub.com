// Deterministic clean-up of extracted text, so the same document always gives the same text.
// It never adds or rewords anything: it only fixes encoding noise and whitespace.
const LIGATURES = { '\uFB00': 'ff', '\uFB01': 'fi', '\uFB02': 'fl', '\uFB03': 'ffi', '\uFB04': 'ffl', '\uFB05': 'st', '\uFB06': 'st' };

export function normalizeText(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\uFB00-\uFB06]/g, c => LIGATURES[c])                // PDF ligatures: 'ﬁ' -> 'fi'
    .replace(/[\uE000-\uF8FF]/g, '')                            // private-use glyphs (icon fonts) carry no text
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')                // zero-width characters and BOM
    .replace(/\u00A0/g, ' ')                                       // no-break space
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // control characters except \n and \t
    .replace(/[ \t]+$/gm, '')                               // trailing spaces
    .replace(/\n{3,}/g, '\n\n')                             // at most one blank line in a row
    .trim();
}

export const countWords = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0);
