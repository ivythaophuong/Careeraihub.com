import { describe, it, expect } from 'vitest';
import { neutralizeInventedFigures, hasPlaceholder, revertInsertion } from './factGuard';

const RESUME = 'Associate Product Manager at Example Company. Worked on dashboard reporting. Supported product research.';

describe('neutralizeInventedFigures', () => {
  it('blanks the figures the audit saw the model invent', () => {
    const fix = 'Built dashboards reducing manual reporting time by 40% across 20+ user sessions, uncovering 5 key workflow friction points';
    const r = neutralizeInventedFigures(fix, RESUME);
    expect(r.changed).toBe(true);
    expect(r.text).toBe('Built dashboards reducing manual reporting time by [X]% across [X] user sessions, uncovering [X] key workflow friction points');
    expect(r.text).not.toMatch(/40|20|\b5\b/);
  });

  it('keeps figures that already appear in the resume', () => {
    const src = 'Led a team of 4 and cut costs by 12% in 2023.';
    const r = neutralizeInventedFigures('Led a team of 4 engineers, cutting costs by 12% in 2023', src);
    expect(r.changed).toBe(false);
    expect(r.text).toBe('Led a team of 4 engineers, cutting costs by 12% in 2023');
  });

  it('blanks money, multipliers and spelled-out numbers, keeping $ / % / x', () => {
    const r = neutralizeInventedFigures('Managed a $2M budget, 3x growth, a team of eight, serving 500K users', RESUME);
    expect(r.text).toBe('Managed a $[X] budget, [X]x growth, a team of [X], serving [X] users');
  });

  it('does not touch years or digits glued to letters (Q4, H2)', () => {
    const r = neutralizeInventedFigures('Shipped in Q4 2024 and H2 planning', RESUME);
    expect(r.changed).toBe(false);
  });

  it('does not touch ordinary words that contain a number word', () => {
    const r = neutralizeInventedFigures('Written reports for the tenant portal', RESUME);
    expect(r.changed).toBe(false);
  });

  it('blanks every figure when there is no resume to ground it', () => {
    const r = neutralizeInventedFigures('Improved retention by 15%', '');
    expect(r.text).toBe('Improved retention by [X]%');
  });
});

describe('hasPlaceholder', () => {
  it('detects [X] and [Y] blanks', () => {
    expect(hasPlaceholder('Grew revenue by [X]%')).toBe(true);
    expect(hasPlaceholder('Led [X] engineers to [Y]%')).toBe(true);
    expect(hasPlaceholder('Grew revenue')).toBe(false);
  });
});

describe('revertInsertion', () => {
  const rec = { inserted: 'Built dashboards reducing reporting time by [X]%', original: 'Worked on dashboard reporting' };

  it('restores the original passage in the resume text', () => {
    const edited = `Associate PM\n${rec.inserted}\nSupported product research`;
    expect(revertInsertion(edited, rec)).toBe('Associate PM\nWorked on dashboard reporting\nSupported product research');
  });

  it('returns null when the candidate has since rewritten that passage', () => {
    expect(revertInsertion('Associate PM\nSomething I typed myself', rec)).toBeNull();
  });
});
