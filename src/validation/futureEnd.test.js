import { describe, it, expect } from 'vitest';
import { futureEndNotes } from './futureEnd';
import { extractResumeFacts } from '../extraction/resumeFacts';
import { computeDeterministicScore } from '../scoring/computeDeterministicScore';

const TODAY = '2026-10-14';
const cv = (range) => `Jordan Lee
jordan.lee@example.com

EXPERIENCE
Senior Analyst
Northwind Logistics
${range}
• Built a weekly report used by 6 managers

SKILLS
SQL, Excel
`;
const notes = (range, today = TODAY) => futureEndNotes(extractResumeFacts(cv(range)), today);

describe('futureEndNotes: a work entry that ends after today gets a code-made note', () => {
  it('Dec 2027 is after Oct 2026: one note, naming the role, the company and the date', () => {
    const n = notes('Jan 2024 - Dec 2027');
    expect(n).toHaveLength(1);
    expect(n[0].kind).toBe('future_end_date');
    expect(n[0].severity).toBe('info');
    expect(n[0].message).toContain('Dec 2027');
    expect(n[0].message).toMatch(/planned end date/i);
  });
  it('a later month of the same year is also after today', () => {
    expect(notes('Jan 2024 - Dec 2026')).toHaveLength(1);
  });
  it.each([
    ['the current month (Oct 2026) is not the future', 'Jan 2024 - Oct 2026'],
    ['a past month (Feb 2026) is not the future: the case the model got wrong', 'Jan 2024 - Feb 2026'],
    ['"Present" is an ongoing role, not a future date', 'Jan 2024 - Present'],
    ['a year only, the current year, is ambiguous: no note', '2024 - 2026'],
    ['a past year', '2020 - 2022'],
  ])('%s', (_, range) => {
    expect(notes(range)).toEqual([]);
  });
  it('a year only that is after the current year gets a note', () => {
    expect(notes('2024 - 2027')).toHaveLength(1);
  });
  it('the same dates give a different answer on a different "today" (today is passed in, not read from the clock)', () => {
    expect(notes('Jan 2024 - Dec 2027', '2028-01-05')).toEqual([]);
  });
  it('is safe on missing or odd input', () => {
    expect(futureEndNotes(null, TODAY)).toEqual([]);
    expect(futureEndNotes({}, TODAY)).toEqual([]);
    expect(futureEndNotes(extractResumeFacts(cv('Jan 2024 - Dec 2027')), 'not a date')).toEqual([]);
    expect(futureEndNotes(extractResumeFacts(cv('Jan 2024 - Dec 2027')))).toEqual([]);
  });
});

describe('a future end date does not change the score', () => {
  it('same score with a future end date and with a past one', () => {
    const a = computeDeterministicScore(cv('Jan 2024 - Dec 2027')).score.score;
    const b = computeDeterministicScore(cv('Jan 2024 - Feb 2026')).score.score;
    expect(a).toBe(b);
  });
});
