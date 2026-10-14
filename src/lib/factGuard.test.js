import { describe, it, expect } from 'vitest';
import { neutralizeInventedFigures, hasPlaceholder, revertInsertion, findBlanks, extraBlanks, fillNote, countBlanks } from './factGuard';

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

// What the models wrote in place of a figure they did not have (measured 2026-10-14 on 12 invented resumes): gpt-6-luna wrote [number], [type],
// [City, Region], [verified scheduling outcome]; Haiku wrote [X]%. Only [X] and [Y] used to be recognised.
const CV = 'Dana Whitfield\ndana@example.com | +1 555 0100\nSales Associate, Harbor Mart\nJan 2021 - Present\n- Helped customers find products\nSkills\nCustomer service, POS systems';

describe('findBlanks: any short [bracketed] blank is unfinished content', () => {
  it.each([
    ['Cut bugs by [X]%', ['[X]']],
    ['Grew revenue by [Y]', ['[Y]']],
    ['Fixed [number] [type] defects, improving [reliability or user outcome].', ['[number]', '[type]', '[reliability or user outcome]']],
    ['dana@example.com | +1 555 0100 | [City, Region]', ['[City, Region]']],
    ['Resolved conflicts for [number] shifts, improving [verified scheduling outcome].', ['[number]', '[verified scheduling outcome]']],
    ['[X] and [X] again', ['[X]']],                       // listed once
  ])('%s', (text, expected) => { expect(findBlanks(text)).toEqual(expected); });

  it.each([
    'Helped customers find products',
    'Shipped in Q4 2024 on a team of 5',
    'Skills (include only skills you can support)',        // round brackets are ordinary text
    'See [1] and [2]',                                     // a footnote number is not a blank to fill
    '',
  ])('finds nothing in: %s', (text) => { expect(findBlanks(text)).toEqual([]); });

  it('ignores a bracket that is already in the resume, so a resume that has its own [Confidential] is not flagged', () => {
    expect(findBlanks('Led [Confidential] project', 'Led [Confidential] project for a client')).toEqual([]);
    expect(findBlanks('Led [Confidential] project [number]', 'Led [Confidential] project')).toEqual(['[number]']);
  });
  it('hasPlaceholder follows the same rule and still accepts one argument', () => {
    expect(hasPlaceholder('x [X]%')).toBe(true);
    expect(hasPlaceholder('x [number]')).toBe(true);
    expect(hasPlaceholder('x [number]', 'x [number]')).toBe(false);
    expect(hasPlaceholder('plain text')).toBe(false);
  });
});

describe('neutralizeInventedFigures: reports blanks the model wrote itself', () => {
  it('a blank the model wrote ([X]%) means the user must fill something, even though the code replaced nothing', () => {
    const r = neutralizeInventedFigures('Helped customers, lifting weekly sales by [X]%', CV);
    expect(r.changed).toBe(false);
    expect(r.text).toBe('Helped customers, lifting weekly sales by [X]%');
    expect(r.blanks).toEqual(['[X]']);
    expect(r.needsInput).toBe(true);
  });
  it('other brackets are kept as written, NOT turned into [X], and are reported', () => {
    const r = neutralizeInventedFigures('Fixed [number] [type] defects', CV);
    expect(r.text).toBe('Fixed [number] [type] defects');
    expect(r.blanks).toEqual(['[number]', '[type]']);
    expect(r.needsInput).toBe(true);
    expect(r.changed).toBe(false);
  });
  it('an invented figure is replaced by [X] as before and needs input', () => {
    const r = neutralizeInventedFigures('Assisted 150+ customers daily, increasing upsell rate by 12%', CV);
    expect(r.text).toBe('Assisted [X] customers daily, increasing upsell rate by [X]%');
    expect(r.changed).toBe(true);
    expect(r.needsInput).toBe(true);
    expect(r.replaced).toEqual(['150+', '12%']);
  });
  it('clean text needs no input', () => {
    const r = neutralizeInventedFigures('Helped customers find products since 2021', CV);
    expect(r).toEqual({ text: 'Helped customers find products since 2021', changed: false, replaced: [], blanks: [], needsInput: false });
  });
  it('contact details and figures that are in the resume are never touched', () => {
    const r = neutralizeInventedFigures('dana@example.com | +1 555 0100 | Jan 2021', CV);
    expect(r.text).toBe('dana@example.com | +1 555 0100 | Jan 2021');
    expect(r.needsInput).toBe(false);
  });
  it('a blank that is already in the resume does not need input', () => {
    expect(neutralizeInventedFigures('Led [Confidential] work', 'Led [Confidential] work').needsInput).toBe(false);
  });
});

describe('extraBlanks: the blanks the "figures not in your resume" note does not already explain', () => {
  it('when the code replaced figures, the [X] it wrote are explained, other blanks are extra', () => {
    expect(extraBlanks(['150+'], ['[X]', '[number]'])).toEqual(['[number]']);
  });
  it('when the code replaced nothing, every blank is extra (the model wrote [X]% itself)', () => {
    expect(extraBlanks([], ['[X]'])).toEqual(['[X]']);
  });
  it('is safe on missing input', () => {
    expect(extraBlanks(undefined, undefined)).toEqual([]);
  });
});

describe('[X] and [Y] always count, even when the resume already contains one', () => {
  it('a fix applied earlier leaves [X] in the resume; a new draft with [X] is still flagged', () => {
    expect(findBlanks('Cut errors by [X]%', 'Cut costs by [X]% last year')).toEqual(['[X]']);
    expect(neutralizeInventedFigures('Cut errors by [X]%', 'Cut costs by [X]%').needsInput).toBe(true);
  });
});

describe('fillNote', () => {
  it('says nothing when there is nothing extra to fill', () => {
    expect(fillNote([], [])).toBe('');
    expect(fillNote(['150+'], ['[X]'])).toBe('');
  });
  it('names a blank the model wrote itself', () => {
    expect(fillNote([], ['[X]'])).toBe('The text has a blank for you to fill: [X]. Put your real details, or remove it.');
  });
  it('says "also" when the figures note is shown next to it', () => {
    expect(fillNote(['150+'], ['[X]', '[City, Region]'])).toBe('The text also has a blank for you to fill: [City, Region]. Put your real details, or remove it.');
  });
  it('uses the plural for several blanks', () => {
    expect(fillNote([], ['[number]', '[type]'])).toBe('The text has blanks for you to fill: [number], [type]. Put your real details, or remove them.');
  });
});

describe('countBlanks', () => {
  it('counts every occurrence, and not a footnote number', () => {
    expect(countBlanks('Up [X]% and [X] clients, see [1], plus [City, Region]')).toBe(3);
    expect(countBlanks('')).toBe(0);
    expect(countBlanks(undefined)).toBe(0);
  });
});
