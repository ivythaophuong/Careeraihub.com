import { describe, it, expect } from 'vitest';
import { computeDeterministicScore } from './computeDeterministicScore';
import { validateResumeFacts } from '../contracts/resumeFacts';
import { validateScoreResult } from '../contracts/scoreResult';

describe('computeDeterministicScore: wires P2 -> P3 -> P4 correctly', () => {
  it('returns facts, validation and score together, each matching its own contract', () => {
    const r = computeDeterministicScore('Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew revenue by 20%');
    expect(validateResumeFacts(r.facts)).toMatchObject({ ok: true });
    expect(validateScoreResult(r.score)).toMatchObject({ ok: true });
    expect(r.validation.ok).toBe(true);
  });

  it('the score is traceable back to the same facts object it was computed from', () => {
    const r = computeDeterministicScore('Jane Example\njane@example.com');
    const completeness = r.score.parts.find(p => p.id === 'completeness');
    // name and email are both present in r.facts; nothing else is — matches the 2-of-4 completeness score.
    expect(!!r.facts.contact.name.value && !!r.facts.contact.email.value).toBe(true);
    expect(completeness.score).toBe(50);
  });

  it('an unreadable document (empty text) flows through as null, not 0, end to end', () => {
    const r = computeDeterministicScore('');
    expect(r.facts.extraction.status).toBe('failed');
    expect(r.score.score).toBeNull();
  });

  it('same text in, byte-identical result out, every time', () => {
    const text = 'Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew revenue by 20%\n• Helped the team';
    const first = JSON.stringify(computeDeterministicScore(text));
    for (let i = 0; i < 20; i++) expect(JSON.stringify(computeDeterministicScore(text))).toBe(first);
  });

  it('tolerates undefined/null text without throwing', () => {
    expect(() => computeDeterministicScore(undefined)).not.toThrow();
    expect(() => computeDeterministicScore(null)).not.toThrow();
  });
});
