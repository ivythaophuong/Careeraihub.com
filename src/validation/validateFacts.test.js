import { describe, it, expect } from 'vitest';
import { validateFacts } from './validateFacts';
import { extractResumeFacts } from '../extraction/resumeFacts';

const emptyFacts = () => extractResumeFacts(''); // a valid, schema-conformant, all-empty ResumeFacts

describe('validateFacts', () => {
  it('ok=true, no findings, on an empty but schema-valid ResumeFacts', () => {
    const r = validateFacts(emptyFacts());
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('reports a schema violation (e.g. a bad shape) as an error and sets ok=false', () => {
    const r = validateFacts({ not: 'a valid ResumeFacts object' });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors.every(e => e.severity === 'error')).toBe(true);
  });

  it('a chronology error (end before start) makes ok=false', () => {
    const facts = extractResumeFacts('Jane Example\n\nExperience\nProduct Manager\tJan 2024 - Jan 2021\nAcme Ltd\n• Did X');
    const r = validateFacts(facts);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.kind === 'end_before_start')).toBe(true);
  });

  it('a chronology WARNING (overlap) does not make ok=false', () => {
    const facts = extractResumeFacts(
      'Jane Example\n\nExperience\n' +
      'Product Manager\tJan 2020 - Jan 2022\nAcme Ltd\n• Did X\n' +
      'Consultant\tJan 2021 - Jan 2023\nBeta Co\n• Did Y'
    );
    const r = validateFacts(facts);
    expect(r.warnings.some(w => w.kind === 'overlapping_experience')).toBe(true);
    expect(r.ok).toBe(true);
  });

  it('always includes a confidence summary alongside findings', () => {
    const r = validateFacts(extractResumeFacts('Jane Example\njane@example.com'));
    expect(r.confidence.total).toBeGreaterThan(0);
    expect(typeof r.confidence.known).toBe('number');
  });

  it('on real extracted output (P2), never throws and findings stay consistent with ok', () => {
    for (const text of ['', 'Jane Example', 'Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Did X']) {
      const r = validateFacts(extractResumeFacts(text));
      expect(r.ok).toBe(r.errors.length === 0);
      expect(r.findings).toHaveLength(r.errors.length + r.warnings.length);
    }
  });
});
