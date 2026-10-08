import { describe, it, expect } from 'vitest';
import { checkEvidenceConsistency } from './evidence';

const f = (value, evidence, extraction_method = 'regex') => ({ value, evidence, extraction_method });

describe('checkEvidenceConsistency', () => {
  it('passes when the value appears in its own evidence (case/whitespace-insensitive)', () => {
    expect(checkEvidenceConsistency({ contact: { email: f('jane@example.com', 'Jane.Doe | JANE@EXAMPLE.COM') } })).toEqual([]);
  });

  it('flags a value that does not appear in its own evidence, with the exact field path', () => {
    const r = checkEvidenceConsistency({ contact: { name: f('Jane Example', 'Product Manager') } });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ kind: 'evidence_mismatch', severity: 'error' });
    expect(r[0].refs).toEqual(['contact.name']);
  });

  it('skips a null-value fact (nothing to check) and an AI-filled fact (no verbatim requirement)', () => {
    expect(checkEvidenceConsistency({ contact: { name: { value: null, evidence: null, extraction_method: 'rule' } } })).toEqual([]);
    expect(checkEvidenceConsistency({ contact: { name: f('Jane Example', 'unrelated text', 'ai') } })).toEqual([]);
  });

  it('checks experience, education, skills, metrics, certifications, and links', () => {
    const facts = {
      contact: { links: [f('github.com/jane', 'github.com/jane')] },
      experiences: [{ title: f('Manager', 'Acme'), bullets: [f('Did X', 'Did Y')] }],
      education: [{ degree: f('BSc', 'MSc') }],
      skills: [f('SQL', 'SQL')],
      metrics: [f('20%', 'revenue')],
      certifications: [f('AWS', 'GCP')],
    };
    const r = checkEvidenceConsistency(facts);
    expect(r.map(x => x.refs[0]).sort()).toEqual([
      'certifications[0]', 'education[0].degree', 'experiences[0].bullets[0]', 'experiences[0].title', 'metrics[0]',
    ].sort());
  });

  it('tolerates missing sections and does not throw', () => {
    expect(checkEvidenceConsistency({})).toEqual([]);
    expect(() => checkEvidenceConsistency(null)).not.toThrow();
  });
});
