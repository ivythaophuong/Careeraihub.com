// One normalisation for resume text, used for text that was pasted and for text read from a PDF or DOCX, so the same CV
// reads the same whichever way it came in. It only unifies characters that carry no meaning (odd spaces, zero-width marks, curly
// quotes, a bullet glyph left alone on its own line). It never removes words, numbers or lines of content. It is idempotent.
const ODD_SPACES = /[       ]/g;
const INVISIBLE = /[​-‍⁠﻿­]/g;
const BULLET_ALONE = /^([ \t]*[•▪●◦‣⁃▫■□◆◇►‣·])[ \t]*\n+(?=[ \t]*\S)/gm;

export function normalizeResumeText(input) {
  let s = String(input ?? '');
  s = s.replace(/\r\n?/g, '\n');
  s = s.normalize('NFC');
  s = s.replace(INVISIBLE, '').replace(ODD_SPACES, ' ');
  s = s.replace(/[‘’‛]/g, "'").replace(/[“”‟]/g, '"');
  s = s.replace(BULLET_ALONE, '$1 ');
  s = s.replace(/[ \t]+$/gm, '');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}
