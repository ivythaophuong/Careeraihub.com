import { describe, it, expect } from 'vitest';
import { summarizeConfidence } from './confidence';

const known = (confidence) => ({ value: 'x', confidence });
const unknown = () => ({ value: null, confidence: 0 });

describe('summarizeConfidence', () => {
  it('counts known vs unknown, and averages only over known fields', () => {
    const facts = { contact: { name: known(0.9), email: known(0.7), phone: unknown(), location: unknown(), links: [] } };
    const s = summarizeConfidence(facts);
    expect(s).toMatchObject({ total: 4, known: 2, unknown: 2, averageConfidence: 0.8 });
    expect(s.unknownPaths.sort()).toEqual(['contact.location', 'contact.phone']);
  });

  it('flags low-confidence known fields (below 0.6) by path, separately from unknown ones', () => {
    const facts = { contact: { name: known(0.85), email: known(0.5), phone: unknown(), location: unknown(), links: [] } };
    const s = summarizeConfidence(facts);
    expect(s.lowConfidencePaths).toEqual(['contact.email']);
    expect(s.lowConfidenceCount).toBe(1);
  });

  it('walks experiences (incl. bullets), education, skills, metrics, certifications, links', () => {
    const facts = {
      contact: { name: known(0.9), links: [known(0.95)] },
      experiences: [{ title: known(0.8), bullets: [known(0.8), known(0.8)] }],
      education: [{ degree: known(0.8) }],
      skills: [known(0.8)],
      metrics: [known(0.8)],
      certifications: [known(0.8)],
    };
    expect(summarizeConfidence(facts).total).toBe(9); // name, link, title, 2 bullets, degree, skill, metric, cert
  });

  it('averageConfidence is null (not 0 or NaN) when nothing is known at all', () => {
    const s = summarizeConfidence({ contact: { name: unknown() } });
    expect(s.averageConfidence).toBeNull();
  });

  it('tolerates missing sections and does not throw', () => {
    expect(summarizeConfidence({})).toMatchObject({ total: 0, known: 0, unknown: 0, averageConfidence: null });
    expect(() => summarizeConfidence(null)).not.toThrow();
  });
});
