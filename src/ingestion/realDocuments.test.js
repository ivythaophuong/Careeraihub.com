// @vitest-environment node
// Runs every file in tests/fixtures/documents/real/ (local only, never committed: the repo is public)
// through ingestion, and checks the files themselves for leftover personal data.
// With no files there, the suite is skipped. REAL_REPORT=1 prints one line per file (never the text).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ingestDocument } from './ingestDocument';
import { listZipEntries, readZipEntry } from './zipText';

const DIR = path.resolve(__dirname, '../../tests/fixtures/documents/real');
const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => !f.startsWith('.') && f !== 'README.md').sort() : [];
const asFile = (f) => { const b = fs.readFileSync(path.join(DIR, f)); return { name: f, size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };

const SAFE_EMAIL = /@(example\.(com|org|net)|test\.com|email\.com)$/i;
const YEAR_RANGE = /^(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}$/;

// What could still identify someone, reported by kind only (never the value).
export function findLeftovers(text) {
  const out = [];
  for (const m of text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []) if (!SAFE_EMAIL.test(m)) out.push('email address that is not @example.com');
  for (const m of text.match(/\+?\d[\d\s().-]{7,}\d/g) || []) {
    const digits = m.replace(/\D/g, '');
    if (YEAR_RANGE.test(m.trim()) || digits.length < 8) continue;
    if (/[1-9]/.test(digits.slice(-8))) out.push('phone-like number that is not all zeros');
  }
  return [...new Set(out)];
}

async function metadataFindings(name, bytes) {
  const out = [];
  if (/\.pdf$/i.test(name)) {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
    const { getDocument } = pdfjs.default && !pdfjs.getDocument ? pdfjs.default : pdfjs;
    const doc = await getDocument({ data: bytes.slice() }).promise;
    const { info } = await doc.getMetadata();
    if (info?.Author?.trim()) out.push('PDF Author is set');
    if (info?.Title?.trim()) out.push('PDF Title is set (it is often the person\'s name)');
  } else if (/\.docx$/i.test(name)) {
    const core = listZipEntries(bytes).find(e => e.name === 'docProps/core.xml');
    if (core) {
      const xml = new TextDecoder().decode(await readZipEntry(bytes, core));
      if (/<dc:creator>[^<]+<\/dc:creator>/.test(xml)) out.push('DOCX author (dc:creator) is set');
      if (/<cp:lastModifiedBy>[^<]+<\/cp:lastModifiedBy>/.test(xml)) out.push('DOCX lastModifiedBy is set');
    }
  }
  return out;
}

describe('findLeftovers', () => {
  it('flags real-looking emails and phone numbers, accepts the placeholders', () => {
    expect(findLeftovers('write to jane.doe@gmail.com')).toEqual(['email address that is not @example.com']);
    expect(findLeftovers('call +84 912 345 678')).toEqual(['phone-like number that is not all zeros']);
    expect(findLeftovers('candidate@example.com, +84 90 000 0000, 2021 - 2024, ID 20212024')).toEqual([]);
  });
});

describe.skipIf(files.length === 0)(`real documents (${files.length} file(s), local only)`, () => {
  for (const f of files) {
    describe(f, () => {
      it('is ingested without throwing and gives the same result twice', async () => {
        const a = await ingestDocument(asFile(f));
        const b = await ingestDocument(asFile(f));
        expect(b).toEqual(a);
        expect(['ok', 'partial', 'no_text_layer', 'failed']).toContain(a.status);
        if (process.env.REAL_REPORT) {
          console.log(`REPORT ${f}: kind=${a.kind} status=${a.status} pages=${a.stats.pages} chars=${a.stats.chars} words=${a.stats.words} columnarPages=${a.stats.columnarPages ?? '-'} repeatedRemoved=${a.stats.repeatedLinesRemoved ?? '-'} error=${a.error ?? '-'} notes=${JSON.stringify(a.notes)}`);
        }
      });

      // Files named public_* are open-licensed templates whose sample data the author published; they are
      // exempt from this check only. Anything else must be anonymised.
      it.skipIf(f.startsWith('public_'))('has no leftover personal data in its text or metadata', async () => {
        const r = await ingestDocument(asFile(f));
        const bytes = new Uint8Array(fs.readFileSync(path.join(DIR, f)));
        const findings = [...findLeftovers(r.text), ...(await metadataFindings(f, bytes))];
        expect(findings, `${f}: anonymise this before keeping it here`).toEqual([]);
      });

      it('notes never repeat text from the file', async () => {
        const r = await ingestDocument(asFile(f));
        const words = r.text.split(/\s+/).filter(w => w.length >= 8).slice(0, 200);
        const notes = JSON.stringify(r.notes);
        for (const w of words) expect(notes.includes(w), 'a note contains file text').toBe(false);
      });
    });
  }
});
