// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ingestDocument, detectKind, MAX_BYTES } from './ingestDocument';
import { normalizeText } from './normalizeText';
import { joinPdfItems } from './pdfText';

const FIX = path.resolve(__dirname, '../../tests/fixtures/documents');
const fixture = (name, asName = name) => {
  const buf = fs.readFileSync(path.join(FIX, name));
  return { name: asName, size: buf.length, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
};
const fromBytes = (name, bytes) => { const u = Uint8Array.from(bytes); return { name, size: u.length, arrayBuffer: async () => u.buffer }; };
const fromText = (name, text) => fromBytes(name, Buffer.from(text, 'utf8'));
const LONG = 'Jane Example\nProduct Manager at Acme Ltd, 2021 to 2024\nIncreased lead qualification by 20 percent\nSkills: SQL, Python';

describe('normalizeText', () => {
  it('fixes encoding noise and whitespace, and nothing else', () => {
    expect(normalizeText('﻿Hello​  \r\nWorld !\r\n\r\n\r\n\r\nEnd  ')).toBe('Hello\nWorld !\n\nEnd');
  });
  it('is stable: normalising twice changes nothing', () => {
    const once = normalizeText('a\r\n\r\n\r\nb​  ');
    expect(normalizeText(once)).toBe(once);
  });
  it('gives an empty string for non-strings', () => { expect(normalizeText(null)).toBe(''); expect(normalizeText(42)).toBe(''); });
});

describe('joinPdfItems', () => {
  const it_ = (str, x, y, width = str.length * 6) => ({ str, transform: [1, 0, 0, 1, x, y], width });
  it('keeps two runs on one baseline on one line, with a space for the gap', () => {
    expect(joinPdfItems([it_('Skills:', 72, 660, 40), it_('SQL, Python', 130, 660)])).toBe('Skills: SQL, Python');
  });
  it('does not insert a space inside a word split into pieces', () => {
    expect(joinPdfItems([it_('Prod', 72, 700, 24), it_('uct', 96, 700, 18)])).toBe('Product');
  });
  it('starts a new line when the baseline changes', () => {
    expect(joinPdfItems([it_('Jane', 72, 720), it_('Manager', 72, 700)])).toBe('Jane\nManager');
  });
  it('ignores items without text and tolerates missing positions', () => {
    expect(joinPdfItems([{ str: 'A' }, { foo: 1 }, { str: 'B' }])).toBe('A B');
    expect(joinPdfItems(null)).toBe('');
  });
});

describe('detectKind', () => {
  it('trusts content over the file name', () => {
    const pdf = Buffer.from('%PDF-1.4\n');
    expect(detectKind(pdf, 'resume.docx').kind).toBe('pdf');
    expect(detectKind(pdf, 'resume.docx').note).toMatch(/content is a PDF/);
  });
  it('knows an old .doc and a zip that is not a docx', () => {
    expect(detectKind(Uint8Array.from([0xD0, 0xCF, 0x11, 0xE0]), 'a.doc').reason).toBe('legacy_doc');
    expect(detectKind(Uint8Array.from([0x50, 0x4B, 0x03, 0x04]), 'a.zip').reason).toBe('zip_not_docx');
  });
});

describe('ingestDocument: TXT', () => {
  it('reads a text resume and reports ok', async () => {
    const r = await ingestDocument(fromText('cv.txt', LONG));
    expect(r).toMatchObject({ status: 'ok', kind: 'txt', method: 'plain' });
    expect(r.text).toContain('Increased lead qualification');
    expect(r.stats.words).toBeGreaterThan(10);
  });
  it('fails (not ok) when there is too little text', async () => {
    expect(await ingestDocument(fromText('cv.txt', 'hi'))).toMatchObject({ status: 'failed', error: 'too_little_text' });
  });
  it('rejects binary data named .txt', async () => {
    expect(await ingestDocument(fromBytes('cv.txt', Array.from({ length: 500 }, (_, i) => i % 7)))).toMatchObject({ status: 'failed', error: 'not_text' });
  });
  it('does not guess at unknown extensions (ATS Builder used to decode anything as text)', async () => {
    expect(await ingestDocument(fromText('cv.rtf', LONG))).toMatchObject({ status: 'failed', error: 'unsupported_type' });
    expect(await ingestDocument(fromText('resume', LONG))).toMatchObject({ status: 'failed', error: 'unsupported_type' });
  });
});

describe('ingestDocument: limits and bad input', () => {
  it('rejects an empty file', async () => { expect(await ingestDocument(fromBytes('a.txt', []))).toMatchObject({ error: 'empty_file' }); });
  it('rejects a file over the size limit before reading it', async () => {
    let read = false;
    const big = { name: 'a.pdf', size: MAX_BYTES + 1, arrayBuffer: async () => { read = true; return new ArrayBuffer(1); } };
    expect(await ingestDocument(big)).toMatchObject({ status: 'failed', error: 'too_large' });
    expect(read).toBe(false);
  });
  it('never throws for a missing or unreadable file', async () => {
    expect(await ingestDocument(null)).toMatchObject({ status: 'failed', error: 'read_error' });
    expect(await ingestDocument({ name: 'a.txt', arrayBuffer: async () => { throw new Error('boom'); } })).toMatchObject({ status: 'failed', error: 'read_error' });
  });
  it('explains an old .doc file', async () => {
    const r = await ingestDocument(fromBytes('old.doc', [0xD0, 0xCF, 0x11, 0xE0, 1, 2, 3]));
    expect(r.error).toBe('unsupported_type');
    expect(r.notes[0]).toMatch(/docx or PDF/);
  });
  it('never puts file content into notes', async () => {
    const r = await ingestDocument(fromText('cv.rtf', 'SECRET-NAME-12345 ' + LONG));
    expect(JSON.stringify(r.notes)).not.toContain('SECRET-NAME-12345');
  });
});

describe('ingestDocument: DOCX (real file, real mammoth)', () => {
  it('reads a standard resume', async () => {
    const r = await ingestDocument(fixture('standard.docx'));
    expect(r).toMatchObject({ status: 'ok', kind: 'docx', method: 'mammoth' });
    expect(r.text).toContain('Jane Example');
    expect(r.text).toContain('Skills: SQL, Python, Roadmapping');
  });
  it('an empty document is failed, not ok', async () => {
    expect(await ingestDocument(fixture('empty.docx'))).toMatchObject({ status: 'failed', error: 'too_little_text' });
  });
  it('a damaged docx is reported as corrupt', async () => {
    const buf = Buffer.concat([Buffer.from([0x50, 0x4B, 0x03, 0x04]), Buffer.from('not really a zip')]);
    expect(await ingestDocument(fromBytes('cv.docx', buf))).toMatchObject({ status: 'failed', error: 'corrupt' });
  });
});

describe('ingestDocument: PDF (real files, real pdf.js)', () => {
  it('reads a two-page resume, joining runs on a line', async () => {
    const r = await ingestDocument(fixture('standard.pdf'));
    expect(r).toMatchObject({ status: 'ok', kind: 'pdf', method: 'pdfjs' });
    expect(r.stats.pages).toBe(2);
    expect(r.text).toContain('Skills: SQL, Python, Roadmapping');
    expect(r.text).toContain('Education');
  });
  it('a PDF with no text layer says so instead of pretending', async () => {
    const r = await ingestDocument(fixture('blank.pdf'));
    expect(r.status).toBe('no_text_layer');
    expect(r.notes.join(' ')).toMatch(/scan or an image/);
  });
  it('a PDF with one empty page is partial and names the page', async () => {
    const r = await ingestDocument(fixture('partial.pdf'));
    expect(r.status).toBe('partial');
    expect(r.stats.emptyPages).toBe(1);
    expect(r.notes.join(' ')).toContain('page 2');
    expect(r.text).toContain('Jane Example');
  });
  it('a damaged PDF is corrupt', async () => {
    expect(await ingestDocument(fixture('corrupt.pdf'))).toMatchObject({ status: 'failed', error: 'corrupt' });
  });
  it('trusts content over the name: a PDF saved as .docx is read as a PDF', async () => {
    const r = await ingestDocument(fixture('standard.pdf', 'resume.docx'));
    expect(r).toMatchObject({ status: 'ok', kind: 'pdf' });
    expect(r.notes[0]).toMatch(/content is a PDF/);
  });
});

describe('determinism', () => {
  it('the same file gives the same result every time', async () => {
    for (const f of ['standard.pdf', 'standard.docx', 'partial.pdf']) {
      const a = await ingestDocument(fixture(f));
      const b = await ingestDocument(fixture(f));
      expect(b).toEqual(a);
    }
  });
});
