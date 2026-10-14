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

describe('a location line before the name is skipped, like a contact line', () => {
  it.each([
    ['a city and country with a note in brackets', '+65 5555 0100\nHo Chi Minh City, Vietnam (Open to relocation)\njordan.lee@example.com\nJordan Lee\nSenior Product Analyst'],
    ['a city and a two-letter state', 'jordan.lee@example.com\nAustin, TX\nJordan Lee\nSenior Product Analyst'],
  ])('%s', (_label, text) => {
    expect(name(text).value).toBe('Jordan Lee');
  });

  it('the location line is not itself taken as the name', () => {
    expect(name('Ho Chi Minh City, Vietnam (Open to relocation)\nSenior Product Analyst').value).toBeNull();
    expect(name('Austin, TX\njordan.lee@example.com').value).toBeNull();
  });

  it('forms that can be a person (Surname, Given name) or a bare "City, Country" are still not read as location or name', () => {
    expect(name('Lee, Jordan\nSenior Product Analyst').value).toBeNull();
    expect(name('Lee, Jordan A.\nSenior Product Analyst').value).toBeNull();
    expect(name('Lee, Maria Elena\nSenior Product Analyst').value).toBeNull();
    expect(name('Austin, Texas\nJordan Lee').value).toBeNull();
  });
});

describe('known limit: a two-column resume read column by column', () => {
  // A PDF with a sidebar is read left column first, so the first recognised heading ("Contact") comes before the name, which sits at the
  // top of the right column. The reader looks for a name before the first heading, so it finds none. Reading it correctly needs column
  // detection (a design of its own); guessing a name from any later line would read "State University" as a person.
  const text = 'Contact\njordan@example.com\n+1 555 0100\nSkills\nSQL\nExcel\nEducation\nBSc Economics\nState University\n2016\nJordan A. Lee\nOperations Analyst\nExperience\nSenior Analyst, Acme Corp\nJan 2020 – Mar 2023\nBuilt 3 dashboards';
  it.fails('finds the name in the right column', () => {
    expect(extractResumeFacts(text).contact.name.value).toBe('Jordan A. Lee');
  });
});
