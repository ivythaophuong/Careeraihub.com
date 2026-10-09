// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Every relational insert the app makes (`updateMemory(..., { table, data })`) must name only columns that exist in the database.
// LIVE lists the production columns read from the catalog on 2026-10-09 (docs/architecture/EVIDENCE_RESULTS_2026-10-09.md, query 1.2).
// `user_id` is added by useMemory on every insert, so it is not listed in `data`.
//
// This checks the source text of the writers (a static check). It does not run the app or touch the database.
const LIVE = {
  jd_analyses: ['id', 'user_id', 'company', 'role_title', 'match_score', 'keywords', 'gaps', 'advice', 'created_at'],
  cover_letters: ['id', 'user_id', 'tone', 'company', 'content', 'subject', 'follow_up', 'created_at'],
  star_stories: ['id', 'user_id', 'one_liner', 'score', 'situation', 'task', 'action', 'result', 'refined', 'created_at'],
};

// knownMismatch: the writer names columns the table does not have (finding F-6). The test is marked `fails` so the suite stays green while the
// problem is documented; when the writer is fixed this test starts failing and must be changed to a normal test.
const WRITERS = [
  { file: 'src/features/ResumeScan/ResumeScan.jsx', table: 'jd_analyses' },
  { file: 'src/features/JDAnalyzer/JDAnalyzer.jsx', table: 'jd_analyses', knownMismatch: true },
  { file: 'src/features/CoverLetterGen/CoverLetterGen.jsx', table: 'cover_letters' },
  { file: 'src/features/STARBuilder/STARBuilder.jsx', table: 'star_stories' },
];

const ROOT = path.resolve(__dirname, '../..');

// Returns the top-level keys of the object literal that follows `table: '<table>'`'s `data:`.
export function writtenColumns(source, table) {
  const t = source.indexOf(`table: '${table}'`);
  if (t === -1) return null;
  const d = source.indexOf('data:', t);
  const open = source.indexOf('{', d);
  if (d === -1 || open === -1) return null;
  const keys = [];
  let depth = 0;
  let i = open;
  let expectKey = false;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "'" || ch === '"' || ch === '`') {            // skip a string literal
      const q = ch; i++;
      while (i < source.length && source[i] !== q) { if (source[i] === '\\') i++; i++; }
      i++; expectKey = false; continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') { depth++; if (depth === 1) expectKey = true; i++; continue; }
    if (ch === '}' || ch === ']' || ch === ')') { depth--; if (depth === 0) break; i++; continue; }
    if (depth === 1 && ch === ',') { expectKey = true; i++; continue; }
    if (depth === 1 && expectKey) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(source.slice(i, i + 80));
      if (m) { keys.push(m[1]); i += m[0].length; expectKey = false; continue; }
      if (/\S/.test(ch)) expectKey = false;
    }
    i++;
  }
  return keys;
}

describe('column extraction helper', () => {
  it('reads top-level keys and ignores nested ones', () => {
    const src = "x({ table: 'jd_analyses', data: { a: f(1, { z: 2 }), b: 'c: d', c: [1, 2], d: g ? 1 : 2 } })";
    expect(writtenColumns(src, 'jd_analyses')).toEqual(['a', 'b', 'c', 'd']);
  });
  it('returns null when the table is not written', () => {
    expect(writtenColumns('nothing here', 'jd_analyses')).toBeNull();
  });
});

describe('relational writers name only columns that exist in production', () => {
  for (const w of WRITERS) {
    const source = fs.readFileSync(path.join(ROOT, w.file), 'utf8');
    const cols = writtenColumns(source, w.table);

    it(`${w.file} -> ${w.table}: the written columns can be read from the source`, () => {
      expect(cols && cols.length).toBeGreaterThan(0);
    });

    const check = () => {
      const unknown = cols.filter((c) => !LIVE[w.table].includes(c));
      expect(unknown, `columns not in ${w.table}`).toEqual([]);
    };
    if (w.knownMismatch) {
      it.fails(`${w.file} -> ${w.table}: writes only existing columns (KNOWN MISMATCH, finding F-6)`, check);
      it(`${w.file} -> ${w.table}: the mismatch is exactly key_requirements and critical_gaps`, () => {
        expect(cols.filter((c) => !LIVE[w.table].includes(c)).sort()).toEqual(['critical_gaps', 'key_requirements']);
      });
    } else {
      it(`${w.file} -> ${w.table}: writes only existing columns`, check);
    }
  }
});
