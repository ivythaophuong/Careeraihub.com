import { describe, it, expect } from 'vitest';
import { buildParsePrompt, todayIso, dropFalseDateClaims } from './parsePrompt';

describe('todayIso', () => {
  it('is the local calendar date as YYYY-MM-DD', () => {
    expect(todayIso(new Date(2026, 9, 14, 23, 30))).toBe('2026-10-14');
    expect(todayIso(new Date(2027, 0, 5))).toBe('2027-01-05');
  });
});

describe('buildParsePrompt', () => {
  const p = buildParsePrompt('Jordan Lee\nAnalyst, Acme (Jan 2020 - Feb 2026)', '2026-10-14');
  it('tells the model what today is, so a past date is not called a future one', () => {
    expect(p).toContain("Today's date is 2026-10-14");
    expect(p).toMatch(/on or before 2026-10-14 is not in the future/);
  });
  it('keeps the resume text and the JSON shape, and the rule that the score is not the model\'s', () => {
    expect(p).toContain('Analyst, Acme (Jan 2020 - Feb 2026)');
    expect(p).toContain('"workExperience"');
    expect(p).toContain('"issues"');
    expect(p).toMatch(/Do NOT output any overall score/);
  });
  it('sends only the first 5000 characters of the resume, as before', () => {
    const long = 'x'.repeat(6000);
    expect(buildParsePrompt(long, '2026-10-14')).not.toContain('x'.repeat(5001));
  });
  it('falls back to the real date when none is given', () => {
    expect(buildParsePrompt('cv')).toMatch(/Today's date is \d{4}-\d{2}-\d{2}/);
  });
});

const issue = (over) => ({ severity: 'critical', title: 'Future End Date on PingAstro', description: 'PingAstro lists an end date of Feb 2026, which is either an impossible future date or a typo for Feb 2025.', before: 'Nov 2024 – Feb 2026', after: 'Nov 2024 – Present', ...over });

describe('dropFalseDateClaims', () => {
  it('drops a "future date" claim about a date that is not in the future', () => {
    expect(dropFalseDateClaims([issue()], '2026-10-14')).toEqual([]);
  });
  it('keeps a "future date" claim when a date it names really is after today', () => {
    const real = issue({ description: 'The end date Feb 2027 is in the future.', before: 'Nov 2024 – Feb 2027' });
    expect(dropFalseDateClaims([real], '2026-10-14')).toEqual([real]);
  });
  it('compares by month: this month is not the future, next month is', () => {
    expect(dropFalseDateClaims([issue({ description: 'future date Oct 2026', before: 'Oct 2026', title: 'Future date' })], '2026-10-14')).toEqual([]);
    const next = issue({ description: 'future date Nov 2026', before: 'Nov 2026', title: 'Future date' });
    expect(dropFalseDateClaims([next], '2026-10-14')).toEqual([next]);
  });
  it('treats a bare year as possibly future for the whole current year (it may mean December), and as past before it', () => {
    const now = issue({ description: 'An impossible future date: 2026.', before: '2026', title: 'Impossible date' });
    expect(dropFalseDateClaims([now], '2026-10-14')).toEqual([now]);   // could still be a real problem: kept
    const past = issue({ description: 'An impossible future date: 2025.', before: '2025', title: 'Impossible date' });
    expect(dropFalseDateClaims([past], '2026-10-14')).toEqual([]);
    const y = issue({ description: 'An impossible future date: 2028.', before: '2028', title: 'Impossible date' });
    expect(dropFalseDateClaims([y], '2026-10-14')).toEqual([y]);
  });
  it('leaves other issues, and date claims that name no date, untouched', () => {
    const a = issue({ title: 'No metrics in any bullet', description: 'None of the bullets contains a number.', before: 'Managed the team', after: 'Managed 6 people' });
    const b = issue({ title: 'Future date', description: 'A date is in the future.', before: '', after: '' });
    expect(dropFalseDateClaims([a, b], '2026-10-14')).toEqual([a, b]);
  });
  it('is safe on nonsense', () => {
    expect(dropFalseDateClaims(null, '2026-10-14')).toEqual([]);
    expect(dropFalseDateClaims([null, 5, {}], '2026-10-14')).toEqual([{}]); // junk entries are removed so the screen never reads a property of null
  });
});
