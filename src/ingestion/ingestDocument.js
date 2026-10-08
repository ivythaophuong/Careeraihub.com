// Document ingestion: a file in, text and an honest extraction status out. Deterministic, no AI.
// The status uses the same words as ResumeFacts.extraction.status (src/contracts/resumeFacts.js).
//
//   ok             text found on every page / in the whole document
//   partial        some pages had no text (e.g. scanned pages in a mixed PDF); notes say which
//   no_text_layer  a PDF with no usable text: it is probably a scan. OCR (or the AI fallback) is a separate,
//                  explicit step, never done silently here
//   failed         unsupported type, too large, empty, corrupt, or too little text; `error` says why
//
// This function never throws for a bad file and never puts file content into `notes`.
import { normalizeText, countWords } from './normalizeText';
import { joinPdfItems, layoutHint, removeRepeatedPageLines } from './pdfText';
import { readDocxHeaderFooter } from './zipText';

export const MAX_BYTES = 10 * 1024 * 1024;
export const MIN_TEXT_CHARS = 50;      // below this a resume has nothing to analyse (same as Resume Scan)
const MIN_PAGE_CHARS = 10;             // a page with fewer characters counts as having no text

const ext = (name) => (String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
const startsWith = (b, sig, at = 0) => sig.every((v, i) => b[at + i] === v);

// File type by content first, extension second. Returns { kind, note? }.
export function detectKind(bytes, name) {
  const e = ext(name);
  const head = bytes.subarray(0, 1024);
  let isPdf = false;
  for (let i = 0; i + 4 < head.length && !isPdf; i++) isPdf = startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2D], i); // "%PDF-" in the first KB
  if (isPdf) return { kind: 'pdf', note: e && e !== 'pdf' ? `The file name says .${e} but the content is a PDF; it was read as a PDF.` : undefined };
  if (startsWith(bytes, [0x50, 0x4B, 0x03, 0x04])) {
    return e === 'docx' ? { kind: 'docx' } : { kind: 'unknown', reason: 'zip_not_docx' };
  }
  if (startsWith(bytes, [0xD0, 0xCF, 0x11, 0xE0])) return { kind: 'unknown', reason: 'legacy_doc' };
  if (e === 'txt') return { kind: 'txt' };
  return { kind: 'unknown', reason: e ? `unsupported_extension` : 'no_extension' };
}

const looksBinary = (bytes) => {
  const sample = bytes.subarray(0, 4096);
  let bad = 0;
  for (const b of sample) if (b === 0 || (b < 9) || (b > 13 && b < 32)) bad++;
  return sample.length > 0 && bad / sample.length > 0.02;
};

// UTF-8 first (with or without BOM). UTF-16 is recognised by its BOM. Anything else that is not valid
// UTF-8 is read as Windows-1252 and says so, since legacy Vietnamese encodings (TCVN3, VNI) would be wrong.
export function decodeText(bytes) {
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), notes: [] };
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), notes: [] };
  if (looksBinary(bytes)) return { error: true };
  try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), notes: [] }; }
  catch { return { text: new TextDecoder('windows-1252').decode(bytes), notes: ['The text is not valid UTF-8; it was read as Windows-1252, so accented letters may be wrong.'] }; }
}

const fail = (kind, error, note, stats = {}) => ({
  status: 'failed', kind, text: '', method: null, error,
  stats: { bytes: 0, chars: 0, words: 0, pages: null, emptyPages: null, ...stats }, notes: [note],
});

// Default PDF reader (pdf.js). Tests pass their own `readPdf` so they do not need a worker.
export async function readPdfPages(bytes) {
  const inBrowser = typeof window !== 'undefined' && typeof Worker !== 'undefined';
  // In Node (tests, tooling) pdf.js must use its legacy build and its own fake worker.
  const pdfjs = inBrowser ? await import('pdfjs-dist') : await import('pdfjs-dist/legacy/build/pdf.js');
  const { getDocument, GlobalWorkerOptions } = pdfjs.default && !pdfjs.getDocument ? pdfjs.default : pdfjs;
  if (inBrowser && !GlobalWorkerOptions.workerSrc) {
    GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString();
  }
  const pdf = await getDocument({ data: bytes.slice(), isEvalSupported: false, useSystemFonts: true }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    // Keep every text run separate: by default pdf.js merges runs on a line and pads the gap with spaces,
    // which hides the column gaps joinPdfItems needs.
    const content = await (await pdf.getPage(i)).getTextContent({ disableCombineTextItems: true });
    pages.push(joinPdfItems(content.items));
  }
  return pages;
}

// mammoth's browser build reads `arrayBuffer`, its Node build reads `buffer`.
export async function readDocxText(bytes) {
  const mammoth = (await import('mammoth')).default;
  const input = typeof Buffer !== 'undefined'
    ? { buffer: Buffer.from(bytes) }
    : { arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  const { value } = await mammoth.extractRawText(input);
  return value;
}

export async function ingestDocument(file, { readPdf = readPdfPages, readDocx = readDocxText, maxBytes = MAX_BYTES } = {}) {
  const name = file?.name;
  if (!file || typeof file.arrayBuffer !== 'function') return fail('unknown', 'read_error', 'No readable file was given.');
  const size = Number.isFinite(file.size) ? file.size : null;
  if (size !== null && size > maxBytes) return fail('unknown', 'too_large', `The file is larger than ${Math.round(maxBytes / 1048576)} MB.`, { bytes: size });

  let bytes;
  try { bytes = new Uint8Array(await file.arrayBuffer()); }
  catch { return fail('unknown', 'read_error', 'The file could not be read.'); }
  if (bytes.length === 0) return fail('unknown', 'empty_file', 'The file is empty.');
  if (bytes.length > maxBytes) return fail('unknown', 'too_large', `The file is larger than ${Math.round(maxBytes / 1048576)} MB.`, { bytes: bytes.length });

  const { kind, note, reason } = detectKind(bytes, name);
  const notes = note ? [note] : [];
  const base = { bytes: bytes.length };

  if (kind === 'unknown') {
    const msg = {
      legacy_doc: 'Old .doc files and password-protected Office files are not supported. Save the document as .docx or PDF.',
      zip_not_docx: 'This archive is not a .docx resume.',
      unsupported_extension: 'Only PDF, DOCX and TXT files are supported.',
      no_extension: 'The file has no extension; only PDF, DOCX and TXT files are supported.',
    }[reason] || 'This file type is not supported.';
    return fail('unknown', 'unsupported_type', msg, base);
  }

  try {
    if (kind === 'txt') {
      const dec = decodeText(bytes);
      if (dec.error) return fail('txt', 'not_text', 'The file does not look like text.', base);
      return finish('txt', 'plain', normalizeText(dec.text), null, null, [...notes, ...dec.notes], base);
    }
    if (kind === 'docx') {
      const body = await readDocx(bytes);
      const hf = await readDocxHeaderFooter(bytes);
      const docNotes = [...notes];
      let text = body;
      if (hf.found && hf.failed) docNotes.push('This document has a header or footer that could not be read.');
      if (hf.header || hf.footer) {
        text = [hf.header, body, hf.footer].filter(Boolean).join('\n');
        docNotes.push('Text from the document header/footer was included.');
      }
      return finish('docx', 'mammoth', normalizeText(text), null, null, docNotes, base);
    }
    // pdf
    const raw = await readPdf(bytes);
    const emptyIdx = raw.map((t, i) => (normalizeText(t).length < MIN_PAGE_CHARS ? i + 1 : null)).filter(Boolean);
    const dedup = removeRepeatedPageLines(raw.map(normalizeText));
    const pageTexts = dedup.pages;
    const pdfNotes = [...notes];
    if (dedup.removed > 0) pdfNotes.push(`Repeated header/footer lines were kept once (${dedup.removed} removed).`);
    const columnarPages = raw.map((t, i) => (layoutHint(t).columnar ? i + 1 : null)).filter(Boolean);
    if (columnarPages.length) pdfNotes.push(`Page${columnarPages.length > 1 ? 's' : ''} ${columnarPages.join(', ')} look${columnarPages.length > 1 ? '' : 's'} like columns or a table; the reading order may be mixed.`);
    const text = normalizeText(pageTexts.join('\n\n'));
    const r = finish('pdf', 'pdfjs', text, pageTexts.length, emptyIdx, pdfNotes, base);
    r.stats.columnarPages = columnarPages.length;
    r.stats.repeatedLinesRemoved = dedup.removed;
    return r;
  } catch (e) {
    if (e?.name === 'PasswordException') return fail(kind, 'password_protected', 'The file is password-protected. Remove the password and upload it again.', base);
    return fail(kind, 'corrupt', `The ${kind.toUpperCase()} could not be opened. It may be damaged or password-protected.`, base);
  }
}

function finish(kind, method, text, pages, emptyPages, notes, base) {
  const stats = { ...base, chars: text.length, words: countWords(text), pages, emptyPages: emptyPages ? emptyPages.length : null };
  if (kind === 'pdf') {
    if (pages === 0) return { status: 'failed', kind, method, error: 'corrupt', text: '', stats, notes: [...notes, 'The PDF has no pages.'] };
    if (text.length < MIN_TEXT_CHARS || emptyPages.length === pages) {
      return { status: 'no_text_layer', kind, method, text, stats, notes: [...notes, 'No selectable text was found. This PDF is probably a scan or an image.'] };
    }
    if (emptyPages.length > 0) {
      return { status: 'partial', kind, method, text, stats, notes: [...notes, `No text on page${emptyPages.length > 1 ? 's' : ''} ${emptyPages.join(', ')}.`] };
    }
    return { status: 'ok', kind, method, text, stats, notes };
  }
  if (text.length < MIN_TEXT_CHARS) {
    return { status: 'failed', kind, method, error: 'too_little_text', text, stats, notes: [...notes, 'The document has too little text to analyse.'] };
  }
  return { status: 'ok', kind, method, text, stats, notes };
}
