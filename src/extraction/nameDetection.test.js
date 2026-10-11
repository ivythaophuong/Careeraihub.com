import { describe, it, expect } from 'vitest';
import { extractName, extractContact } from './contact';
import { extractResumeFacts } from './resumeFacts';
import { computeDeterministicScore } from '../scoring/computeDeterministicScore';
import { describePart } from '../lib/describeScorePart';

const name = (text) => extractName(text);

describe('a name is found when it shares its line with something else, or is not on the first line', () => {
  it.each([
    ['Jordan Lee | Senior Product Analyst', 'Jordan Lee'],
    ['Jordan Lee – Senior Product Analyst', 'Jordan Lee'],
    ['Jordan Lee · Singapore · jordan.lee@example.com', 'Jordan Lee'],
    ['Jordan A. Lee, MBA', 'Jordan A. Lee'],
    ['Jordan Lee MBA', 'Jordan Lee'],
    ['Mary-Jane O\'Neil, PhD', 'Mary-Jane O\'Neil'],
    ['Name: Jordan Lee', 'Jordan Lee'],
    ['Full name - Jordan Lee', 'Jordan Lee'],
    ['jordan.lee@example.com | +65 5555 0100\nJordan Lee\nSingapore', 'Jordan Lee'],
    ['+65 5555 0100\nlinkedin.com/in/jordan-lee-example\nJordan Lee', 'Jordan Lee'],
    ['Senior Product Analyst\nJordan Lee\nSingapore', 'Jordan Lee'],
    ['Nguyễn Thị Hương | Product Manager', 'Nguyễn Thị Hương'],
    ['JORDAN LEE\nProduct Analyst', 'JORDAN LEE'],
  ])('%j -> %s', (text, expected) => {
    expect(name(text).value).toBe(expected);
  });

  it('keeps the whole original line as the evidence, and the name alone as the value', () => {
    const n = name('Jordan Lee | Senior Product Analyst');
    expect(n.value).toBe('Jordan Lee');
    expect(n.evidence).toBe('Jordan Lee | Senior Product Analyst');
    expect(n.requiresInterpretation).toBe(false);
  });

  it('is less sure of a name that is not on the first line than of one that is', () => {
    expect(name('Jordan Lee\nProduct Analyst').confidence).toBe(0.85);
    expect(name('jordan.lee@example.com\nJordan Lee').confidence).toBeLessThan(0.85);
    expect(name('Senior Product Analyst\nJordan Lee').confidence).toBeLessThan(name('jordan.lee@example.com\nJordan Lee').confidence);
  });
});

describe('nothing is guessed when the evidence does not point to one name', () => {
  it.each([
    'Senior Product Analyst',
    'Product Analyst | Singapore',
    'Senior Product Analyst\nSingapore',
    'jordan.lee@example.com',
    'jordan.lee@example.com | +65 5555 0100',
    'RESUME\n2024 Edition',
    'Class of 2024',
    'Senior Product Analyst\nJordan Lee\nAlex Kim',   // two equal candidates after a non-name line: ambiguous
    'Lee, Jordan',                                    // a comma form we do not read: unknown, not a wrong name
    'Jordan Lee jordan.lee@example.com',               // an email stuck to the words: not name-shaped
  ])('%j', (text) => {
    expect(name(text)).toMatchObject({ value: null, requiresInterpretation: true });
  });

  it('a job title is never read as the name, even on the first line', () => {
    expect(name('Senior Product Analyst\nExperience').value).toBeNull();
    expect(name('Head of Data Engineering').value).toBeNull();
  });
});

describe('the name reaches the checklist', () => {
  const cv = (firstLine) => `${firstLine}
jordan.lee@example.com | +65 5555 0100 | Singapore

Experience
Product Analyst, Northwind Logistics
Mar 2022 - Present
- Built a weekly report used by 6 regional managers

Education
BSc Business Administration, 2019

Skills
SQL, Excel
`;
  const nameItem = (t) => describePart(computeDeterministicScore(t).score.parts.find((p) => p.id === 'completeness')).items.find((i) => i.label === 'Name');
  it.each(['Jordan Lee | Senior Product Analyst', 'Jordan A. Lee, MBA', 'Name: Jordan Lee'])('%s: Name is found', (line) => {
    expect(nameItem(cv(line)).ok).toBe(true);
    expect(extractResumeFacts(cv(line)).contact.name.value).toMatch(/^Jordan/);
  });
  it('a CV with only a job title at the top has no name, and the checklist says so', () => {
    expect(nameItem(cv('Senior Product Analyst')).ok).toBe(false);
  });
});

describe('extractContact still returns the name from the header', () => {
  it('works through the contact entry point', () => {
    expect(extractContact('Jordan Lee | Senior Product Analyst\njordan.lee@example.com').name.value).toBe('Jordan Lee');
  });
});
