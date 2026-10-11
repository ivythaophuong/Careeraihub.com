// @vitest-environment node
// The same CV, as pasted text and as a PDF, must be READ the same way: same contact, same experience entries with the same bullets,
// same skills and education, same recognised sections, same score parts and the same checklist items. Comparing only the final score
// would let two different misreadings agree by accident, so every extracted field is compared.
// Fixtures are synthetic (a made-up person, example.com); they are not a real CV.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { extractResumeFacts } from './resumeFacts';
import { computeDeterministicScore } from '../scoring/computeDeterministicScore';
import { describePart } from '../lib/describeScorePart';
import { sectionReport } from '../lib/sectionReport';
import { buildLinesFromPdfItems } from '../lib/pdfLines';

const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const fx = (name) => path.join(process.cwd(), 'tests/fixtures', name);

async function pdfItems(name) {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(fx(name))), useSystemFonts: true }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) pages.push((await (await pdf.getPage(i)).getTextContent()).items);
  return pages;
}
const bullet = (s) => s.replace(/^[•\-*]\s*/, '').trim();

function read(text) {
  const f = extractResumeFacts(text);
  const r = computeDeterministicScore(text);
  return {
    contact: { name: f.contact.name.value, email: f.contact.email.value, phone: f.contact.phone.value },
    experiences: f.experiences.map((e) => ({ bullets: e.bullets.map((b) => bullet(b.value)), start: e.start?.normalized_value ?? null, end: e.end?.normalized_value ?? null })),
    education: f.education.length,
    skills: f.skills.map((s) => s.value),
    sections: sectionReport(text).recognised,
    parts: r.score.parts.map((p) => ({ id: p.id, score: p.score, items: describePart(p).items })),
    score: r.score.score,
  };
}

describe.each([['synthetic-cv.txt', 'synthetic-cv.pdf'], ['synthetic-cv-styled.txt', 'synthetic-cv-styled.pdf']])('%s and %s are read the same way', (txtName, pdfName) => {
  it('pasted text and PDF give the same extracted fields, sections, checklist items and score', async () => {
    const fromText = read(fs.readFileSync(fx(txtName), 'utf8'));
    const pages = await pdfItems(pdfName);
    const fromPdf = read(pages.map(buildLinesFromPdfItems).join('\n'));
    expect(fromPdf).toEqual(fromText);
  });
});

describe('why runs must be joined into lines', () => {
  it('joining every pdf.js item as its own line (the old behaviour) turns styled lines into extra "bullets" and changes the score', async () => {
    const pages = await pdfItems('synthetic-cv-styled.pdf');
    const oldWay = read(pages.flat().map((i) => i.str).join('\n'));
    const text = read(fs.readFileSync(fx('synthetic-cv-styled.txt'), 'utf8'));
    const count = (r) => r.experiences.reduce((n, e) => n + e.bullets.length, 0);
    expect(count(oldWay)).toBeGreaterThan(count(text));
    expect(oldWay.score).not.toBe(text.score);
  });
});
