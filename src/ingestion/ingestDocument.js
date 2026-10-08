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
import { joinPdfItems } from './pdfText';

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
    const content = await (await pdf.getPage(i)).getTextContent();
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
      legacy_doc: 'Old .doc files are not supported. Save the document as .docx or PDF.',
      zip_not_docx: 'This archive is not a .docx resume.',
      unsupported_extension: 'Only PDF, DOCX and TXT files are supported.',
      no_extension: 'The file has no extension; only PDF, DOCX and TXT files are supported.',
    }[reason] || 'This file type is not supported.';
    return fail('unknown', 'unsupported_type', msg, base);
  }

  try {
    if (kind === 'txt') {
      if (looksBinary(bytes)) return fail('txt', 'not_text', 'The file does not look like text.', base);
      const text = normalizeText(new TextDecoder('utf-8').decode(bytes));
      return finish('txt', 'plain', text, null, null, notes, base);
    }
    if (kind === 'docx') {
      const text = normalizeText(await readDocx(bytes));
      return finish('docx', 'mammoth', text, null, null, notes, base);
    }
    // pdf
    const pageTexts = (await readPdf(bytes)).map(normalizeText);
    const pages = pageTexts.length;
    const emptyIdx = pageTexts.map((t, i) => (t.length < MIN_PAGE_CHARS ? i + 1 : null)).filter(Boolean);
    const text = normalizeText(pageTexts.join('\n\n'));
    return finish('pdf', 'pdfjs', text, pages, emptyIdx, notes, base);
  } catch {
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
