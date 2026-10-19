import { describe, it, expect } from 'vitest';
import { latestSessionScore } from './interviewFigures';

describe('latestSessionScore', () => {
  it('is null, not 0, when there is no session or no readable score', () => {
    expect(latestSessionScore(undefined)).toBeNull();
    expect(latestSessionScore(null)).toBeNull();
    expect(latestSessionScore([])).toBeNull();
    expect(latestSessionScore([{}])).toBeNull();
    expect(latestSessionScore([{ avgScore: null }])).toBeNull();
    expect(latestSessionScore([{ avgScore: 'x' }])).toBeNull();
    expect(latestSessionScore([{ avgScore: NaN }])).toBeNull();
  });
  it('is the score of the newest session (index 0), whatever the older ones hold', () => {
    expect(latestSessionScore([{ avgScore: 85 }, { avgScore: 40 }, { avgScore: 30 }])).toBe(85);
  });
  it('does not skip a newest session without a score to reach an older one', () => {
    expect(latestSessionScore([{ avgScore: null }, { avgScore: 90 }])).toBeNull();
  });
  it('keeps a real score of 0', () => {
    expect(latestSessionScore([{ avgScore: 0 }])).toBe(0);
  });
});
