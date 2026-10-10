// @vitest-environment node
// Reader quality gate (docs/product/READER-QUALITY-GATE.md). Runs every file in tests/fixtures/documents/real/ (local only, never committed)
// through ingestion, the facts extractor and the ATS Readiness score, and compares what was found with a human annotation file
// tests/fixtures/documents/real/expected.json (also local only). It never prints or stores the text of a resume.
//
//   npx vitest run src/ingestion/readerEvaluation          # checks every file against expected.json
//   READER_REPORT=1 npx vitest run src/ingestion/readerEvaluation   # also prints one line of counts per file
//
// expected.json: { "file.pdf": { "name": true, "email": true, "experience": true, "education": true, "skills": true,
//                                "bulletsMin": 3, "datedMin": 2, "readable": true }, ... }   (every key optional)
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ingestDocument } from './ingestDocument';
import { computeDeterministicScore } from '../scoring/computeDeterministicScore';
import { sectionReport } from '../lib/sectionReport';

const DIR = path.resolve(__dirname, '../../tests/fixtures/documents/real');
const files = fs.existsSync(DIR)
  ? fs.readdirSync(DIR).filter(f => /\.(pdf|docx|txt)$/i.test(f) && !f.startsWith('.') && !f.startsWith('_') && fs.statSync(path.join(DIR, f)).isFile()).sort()
  : [];
const expectedPath = path.join(DIR, 'expected.json');
const expected = fs.existsSync(expectedPath) ? JSON.parse(fs.readFileSync(expectedPath, 'utf8')) : {};
const asFile = (f) => { const b = fs.readFileSync(path.join(DIR, f)); return { name: f, size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };

// What the reader found, as counts and yes/no only.
export function observe(text) {
  const r = computeDeterministicScore(text);
  const f = r.facts;
  const rep = sectionReport(text);
  return {
    name: !!f.contact.name?.value,
    email: !!f.contact.email?.value,
    experience: f.experiences.length > 0,
    education: f.education.length > 0,
    skills: f.skills.length > 0,
    bullets: f.experiences.flatMap(e => e.bullets || []).length,
    dated: f.experiences.filter(e => e.start?.normalized_value && e.end?.normalized_value).length,
    score: r.score.score,
    parts: Object.fromEntries(r.score.parts.map(p => [p.id, p.score])),
    recognised: rep.recognised,
    unrecognisedHeadings: rep.unrecognisedHeadings.length,
  };
}

// Pre-registered gate (set before looking at results; see the doc). Share of annotated files in which the reader found what the annotation says is there.
export const GATE = Object.freeze({ minAnnotatedFiles: 20, sectionsAndContact: 0.95, bulletsAndDates: 0.9, unreadableNeverScored: 1 });

describe('observe (synthetic)', () => {
  it('counts what a simple resume contains, and no text', () => {
    const o = observe('Jane Doe\njane@example.com\n\nWork Experience\nPM, Acme\nJan 2021 - Present\n- Grew revenue 20%\n\nEducation\nBSc Business 2017\nSkills\nSQL');
    expect(o).toMatchObject({ name: true, email: true, experience: true, education: true, skills: true, bullets: 1, dated: 1 });
    expect(JSON.stringify(o)).not.toMatch(/Jane|Acme/);
  });
});

describe.skipIf(files.length === 0)(`reader evaluation (${files.length} file(s), local only)`, () => {
  const results = {};
  for (const f of files) {
    it(`${f}: read twice gives the same observation; matches the annotation if there is one`, async () => {
      const a = await ingestDocument(asFile(f));
      const readable = a.status === 'ok' || a.status === 'partial';
      if (!readable) {
        results[f] = { readable: false };
        if (expected[f]) expect(expected[f].readable, `${f}: the reader says "${a.status}"`).toBe(false);
        return;
      }
      const o1 = observe(a.text);
      const o2 = observe((await ingestDocument(asFile(f))).text);
      expect(o2).toEqual(o1);
      results[f] = { readable: true, ...o1 };
      if (process.env.READER_REPORT) {
        console.log(`READER ${f}: name=${o1.name} email=${o1.email} exp=${o1.experience} edu=${o1.education} skills=${o1.skills} bullets=${o1.bullets} dated=${o1.dated} score=${o1.score} parts=${JSON.stringify(o1.parts)} sections=[${o1.recognised.join(',')}] unrecognisedHeadings=${o1.unrecognisedHeadings}`);
      }
      const e = expected[f];
      if (!e) return;
      for (const k of ['name', 'email', 'experience', 'education', 'skills']) if (k in e) expect(o1[k], `${f}: ${k}`).toBe(e[k]);
      if ('bulletsMin' in e) expect(o1.bullets, `${f}: bullets`).toBeGreaterThanOrEqual(e.bulletsMin);
      if ('datedMin' in e) expect(o1.dated, `${f}: dated entries`).toBeGreaterThanOrEqual(e.datedMin);
    });
  }

  const annotated = files.filter(f => expected[f]);
  it.skipIf(annotated.length < GATE.minAnnotatedFiles)(`gate: ${GATE.minAnnotatedFiles}+ annotated files meet the pre-registered rates`, () => {
    const share = (pred) => annotated.filter(f => results[f]?.readable && pred(f)).length / annotated.filter(f => results[f]?.readable).length;
    const okSections = share(f => ['name', 'email', 'experience', 'education', 'skills'].every(k => !(k in expected[f]) || results[f][k] === expected[f][k]));
    const okDetails = share(f => (!('bulletsMin' in expected[f]) || results[f].bullets >= expected[f].bulletsMin) && (!('datedMin' in expected[f]) || results[f].dated >= expected[f].datedMin));
    const unreadableScored = annotated.filter(f => expected[f].readable === false && results[f]?.readable).length;
    expect(okSections).toBeGreaterThanOrEqual(GATE.sectionsAndContact);
    expect(okDetails).toBeGreaterThanOrEqual(GATE.bulletsAndDates);
    expect(unreadableScored).toBe(0);
  });
});
