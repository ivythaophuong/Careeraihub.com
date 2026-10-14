// @vitest-environment node
// A REAL pdf file (tests/fixtures/documents/resume-columns-by-row.pdf, synthetic, made by make_two_column.py) read by the real pdf.js: the text items it gives
// must be read column by column by buildColumnLines, and the section reader must then find the jobs, the degree and the skills.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildColumnLines } from './pdfColumns';
import { buildLinesFromPdfItems } from './pdfLines';
import { extractResumeFacts } from '../extraction/resumeFacts';
import { readColumnsIfNothingWasFound } from './resumeParser';

vi.mock('mammoth', () => ({ default: {} }));
vi.mock('./ai.jsx', () => ({ callLLM: vi.fn(), extractJSON: vi.fn() }));

async function pageItems(file) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
  const { getDocument } = pdfjs.default && !pdfjs.getDocument ? pdfjs.default : pdfjs;
  const bytes = new Uint8Array(fs.readFileSync(path.resolve(__dirname, '../../tests/fixtures/documents', file)));
  const pdf = await getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true }).promise;
  return (await (await pdf.getPage(1)).getTextContent()).items;
}

describe('a real two-column PDF', () => {
  it('is read column by column, and then the sections can be found', async () => {
    const items = await pageItems('resume-columns-by-row.pdf');
    const text = buildColumnLines(items);
    expect(text).not.toBeNull();
    const f = extractResumeFacts(text);
    expect(f.experiences.map(e => [e.title.value, e.company.value])).toEqual([['Project Manager', 'Delta Build'], ['Site Engineer', 'Nile Works']]);
    expect(f.education.length).toBe(1);
    expect(f.skills.map(s => s.value)).toEqual(expect.arrayContaining(['Project planning', 'Budgeting']));
  });

  it('is not a two-column page when the file is a one-column resume (the existing standard.pdf): normal reading is kept', async () => {
    expect(buildColumnLines(await pageItems('standard.pdf'))).toBeNull();
    expect(buildLinesFromPdfItems(await pageItems('standard.pdf'))).toMatch(/Jane Example/);
  });

  it('a real two-column PDF written column by column is already read in order by the normal reading, which is kept', async () => {
    const items = await pageItems('resume-columns-by-column.pdf');
    const normal = buildLinesFromPdfItems(items);
    expect(extractResumeFacts(normal).experiences.length).toBe(2);
    expect(readColumnsIfNothingWasFound(normal, [{ items }])).toBe(normal);
  });

  it('a readable table is never re-read by columns: the gate keeps the normal reading, whatever the column detector would say', async () => {
    const items = await pageItems('tables.pdf');
    const normal = buildLinesFromPdfItems(items);
    expect(extractResumeFacts(normal).experiences.length).toBe(2); // the normal reading already finds the jobs
    expect(readColumnsIfNothingWasFound(normal, [{ items }])).toBe(normal);
  });

  it('a real PDF written row by row goes through the same gate: the normal reading finds nothing, the column reading finds the jobs', async () => {
    const items = await pageItems('resume-columns-by-row.pdf');
    const normal = buildLinesFromPdfItems(items);
    expect(extractResumeFacts(normal).experiences.length).toBe(0);
    const chosen = readColumnsIfNothingWasFound(normal, [{ items }]);
    expect(extractResumeFacts(chosen).experiences.length).toBe(2);
  });
});
