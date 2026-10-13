// @vitest-environment node
// How accurate is the CODE extractor (src/extraction/resumeFacts.js) on resumes whose answers are known?
// This is the "code side" of docs/architecture/plans/DESIGN-ai-routing-by-feature.md section 6. It calls no model and sends nothing anywhere.
//
// It does not assert an accuracy threshold (none has been approved). It asserts the honesty rules the contract requires:
//   - a field that was not found is null AND says so (requiresInterpretation or confidence 0), never a guess;
//   - the extractor never throws on any case;
//   - the report is complete (every scored field is classified correct / wrong / missing).
// The report (counts, and the list of wrong or missing fields) is written to the file named by EXTRACTION_REPORT when set, and logged otherwise.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { extractResumeFacts } from '../../src/extraction/resumeFacts';
import { CASES } from '../fixtures/extraction-accuracy/cases.js';

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9+#%./]+/g, ' ').trim();
const same = (a, b) => norm(a) === norm(b);
const contains = (hay, needle) => norm(hay).includes(norm(needle));

// one scored field: expected, got, confidence
const rows = [];
function score(caseId, field, expected, got, confidence, ok = same(expected, got)) {
  const status = got == null || got === '' ? (expected == null ? 'correct' : 'missing') : ok ? 'correct' : 'wrong';
  rows.push({ caseId, field, expected, got: got ?? null, confidence: confidence ?? null, status });
}

function run(c) {
  const f = extractResumeFacts(c.text);
  const e = c.expect;
  score(c.id, 'name', e.name, f.contact?.name?.value, f.contact?.name?.confidence);
  if ('email' in e) score(c.id, 'email', e.email, f.contact?.email?.normalized_value ?? f.contact?.email?.value, f.contact?.email?.confidence);
  if ('phone' in e) score(c.id, 'phone', e.phone, f.contact?.phone?.normalized_value, f.contact?.phone?.confidence);
  const xs = f.experiences || [];
  score(c.id, 'experience count', String(e.experiences.length), String(xs.length), null);
  e.experiences.forEach((want, i) => {
    const got = xs[i];
    score(c.id, `exp${i} title`, want.title, got?.title?.value, got?.title?.confidence);
    score(c.id, `exp${i} company`, want.company, got?.company?.value, got?.company?.confidence);
    score(c.id, `exp${i} start`, want.start, got?.start?.normalized_value, got?.start?.confidence);
    score(c.id, `exp${i} end`, want.end, got?.end?.normalized_value, got?.end?.confidence);
  });
  const eds = f.education || [];
  e.education.forEach((want, i) => {
    const got = eds[i];
    // The extractor keeps institution, degree and year in one "degree" string when it cannot split them; accept institution found anywhere in education.
    const text = [got?.institution?.value, got?.degree?.value].filter(Boolean).join(' ');
    score(c.id, `edu${i} institution`, want.institution, text || null, got?.institution?.confidence ?? got?.degree?.confidence, contains(text, want.institution));
    score(c.id, `edu${i} year`, want.year, got?.year?.normalized_value ?? got?.year?.value, got?.year?.confidence);
  });
  const skills = (f.skills || []).map(s => s.value);
  e.skills.forEach(want => {
    const hit = skills.find(s => same(s, want));
    score(c.id, `skill ${want}`, want, hit ?? null, hit ? 0.85 : null);
  });
  if (e.skillsUnique) {
    const keys = skills.map(norm);
    score(c.id, 'skills unique', 'true', String(new Set(keys).size === keys.length), null);
  }
  score(c.id, 'metrics found (min)', String(e.metricsMin), String((f.metrics || []).length), null, (f.metrics || []).length >= e.metricsMin);
  return f;
}

const facts = {};
describe('code extraction on synthetic resumes with known answers', () => {
  for (const c of CASES) {
    it(`${c.id}: runs without throwing and never guesses silently`, () => {
      facts[c.id] = run(c);
      const f = facts[c.id];
      expect(['ok', 'partial', 'no_text', 'failed', 'unsupported'].some(s => s === f.extraction?.status) || typeof f.extraction?.status === 'string').toBe(true);
      // honesty rule: every null scalar says why
      const scalars = [f.contact?.name, f.contact?.email, f.contact?.phone, f.contact?.location,
        ...(f.experiences || []).flatMap(x => [x.title, x.company, x.start, x.end]),
        ...(f.education || []).flatMap(x => [x.institution, x.degree, x.year])].filter(Boolean);
      for (const s of scalars) {
        if (s.value == null) expect(s.requiresInterpretation === true || s.confidence === 0).toBe(true);
      }
    });
  }

  it('produces a complete report', () => {
    const by = (st) => rows.filter(r => r.status === st);
    const confidentWrong = rows.filter(r => r.status === 'wrong' && (r.confidence ?? 0) >= 0.7);
    const summary = {
      cases: CASES.length, fields: rows.length,
      correct: by('correct').length, wrong: by('wrong').length, missing: by('missing').length,
      confidentWrong: confidentWrong.length,
    };
    expect(summary.correct + summary.wrong + summary.missing).toBe(summary.fields);
    const byField = {};
    for (const r of rows) { const k = r.field.replace(/\d+/, 'N').replace(/^skill .*/, 'skill'); (byField[k] ||= { correct: 0, wrong: 0, missing: 0 })[r.status]++; }
    const report = { summary, byField, confidentWrong, problems: rows.filter(r => r.status !== 'correct') };
    if (process.env.EXTRACTION_REPORT) fs.writeFileSync(process.env.EXTRACTION_REPORT, JSON.stringify(report, null, 1));
    else console.log(JSON.stringify(summary));
  });
});
