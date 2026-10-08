// @vitest-environment node
// Executable specification of the data contracts (docs/AI_ARCHITECTURE_CONTRACT.md).
// Each JSON file in tests/contracts/<contract>/ holds { description, input, expect }. Adding a case means
// adding a file; the contract is whatever these files say, not what the validators happen to do.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { validateResumeFacts, validateFact, mergeAiFact, RESUME_FACTS_VERSION } from '../../src/contracts/resumeFacts';
import { validateScoreResult } from '../../src/contracts/scoreResult';
import { canonicalStringify } from '../../src/contracts/validate';

const load = (dir) =>
  fs.readdirSync(path.join(__dirname, dir)).filter(f => f.endsWith('.json')).sort()
    .map(f => ({ name: f.replace(/\.json$/, ''), ...JSON.parse(fs.readFileSync(path.join(__dirname, dir, f), 'utf8')) }));

const codes = (r) => [...new Set(r.errors.map(e => e.code))].sort();

describe('ResumeFacts contract', () => {
  for (const c of load('resume-facts').filter(c => !c.input.merge)) {
    it(`${c.name}: ${c.description}`, () => {
      const r = validateResumeFacts(c.input);
      expect({ ok: r.ok, codes: codes(r) }).toEqual({ ok: c.expect.ok, codes: [...c.expect.codes].sort() });
    });
  }
});

describe('AI cannot overwrite a deterministic fact', () => {
  for (const c of load('resume-facts').filter(c => c.input.merge)) {
    it(`${c.name}: ${c.description}`, () => {
      const { existing, ai } = c.input.merge;
      const m = mergeAiFact(existing, ai);
      expect(m.accepted).toBe(c.expect.accepted);
      expect(m.reason).toBe(c.expect.reason);
      expect(m.field).toEqual(c.expect.keeps === 'ai' ? ai : existing);
    });
  }
  it('does not mutate its inputs', () => {
    const existing = { value: 'a', normalized_value: null, source: 's', evidence: 'a', confidence: 0.9, extraction_method: 'regex', requiresInterpretation: false };
    const ai = { ...existing, value: 'b', evidence: 'b', extraction_method: 'ai' };
    const before = JSON.stringify([existing, ai]);
    mergeAiFact(existing, ai);
    expect(JSON.stringify([existing, ai])).toBe(before);
  });
});

describe('ScoreResult contract', () => {
  for (const c of load('score-result')) {
    it(`${c.name}: ${c.description}`, () => {
      const input = JSON.parse(JSON.stringify(c.input).replace('"__NaN__"', 'null'));
      if (c.input.score === '__NaN__') input.score = NaN; // JSON cannot carry NaN
      const r = validateScoreResult(input);
      expect({ ok: r.ok, codes: codes(r) }).toEqual({ ok: c.expect.ok, codes: [...c.expect.codes].sort() });
    });
  }
});

describe('invariants', () => {
  it('never coerces: a numeric string is not a number', () => {
    const f = { value: 'x', normalized_value: null, source: 's', evidence: 'x', confidence: '0.8', extraction_method: 'rule', requiresInterpretation: false };
    expect(validateFact(f).map(e => e.code)).toContain('bad_confidence');
    expect(f.confidence).toBe('0.8'); // and the input is left as it was
  });

  it('same input gives the same verdict, whatever the key order', () => {
    const facts = load('resume-facts').find(c => c.name === 'valid-complete').input;
    const reverseKeys = (v) => Array.isArray(v) ? v.map(reverseKeys)
      : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).reverse().map(k => [k, reverseKeys(v[k])])) : v;
    const reordered = reverseKeys(facts);
    expect(Object.keys(reordered)).not.toEqual(Object.keys(facts)); // the order really did change
    expect(canonicalStringify(reordered)).toBe(canonicalStringify(facts));
    expect(validateResumeFacts(reordered)).toEqual(validateResumeFacts(facts));
    expect(validateResumeFacts(facts)).toEqual(validateResumeFacts(facts));
  });

  it('the contract version is in step with the fixtures', () => {
    expect(load('resume-facts').find(c => c.name === 'valid-minimal').input.schema_version).toBe(RESUME_FACTS_VERSION);
  });

  it('every fixture has a description and an expectation', () => {
    for (const c of [...load('resume-facts'), ...load('score-result')]) {
      expect(c.description, c.name).toBeTruthy();
      expect(c.expect, c.name).toBeTruthy();
    }
  });
});
