import { describe, it, expect } from 'vitest';
import { parseDate, parseDateRange, findDateRangeInLine } from './dates';

describe('parseDate', () => {
  it.each([
    ['Jan 2020', '2020-01'], ['January 2020', '2020-01'], ['Sep. 2023', '2023-09'],
    ['01/2020', '2020-01'], ['2020/01', '2020-01'], ['2020-01', '2020-01'],
    ['2020', '2020'],
  ])('%s -> %s', (input, normalized) => {
    const f = parseDate(input);
    expect(f.normalized_value).toBe(normalized);
    expect(f.requiresInterpretation).toBe(false);
  });

  it('recognises "present" in English and Vietnamese, without a normalized date', () => {
    for (const w of ['Present', 'Current', 'present', 'hiện tại']) {
      expect(parseDate(w)).toMatchObject({ value: w, normalized_value: 'present', requiresInterpretation: false });
    }
  });

  it('does not guess at an unrecognisable token', () => {
    expect(parseDate('sometime last year')).toMatchObject({ value: null, requiresInterpretation: true });
    expect(parseDate('')).toMatchObject({ value: null, requiresInterpretation: true });
  });

  it('rejects a month number out of range', () => {
    expect(parseDate('13/2020').requiresInterpretation).toBe(true);
  });
});

describe('parseDateRange', () => {
  it('splits on a dash with spaces, from P1\'s restored or Chrome-printed dashes', () => {
    const r = parseDateRange('Sep. 2023 - Mar. 2024');
    expect(r.start.normalized_value).toBe('2023-09');
    expect(r.end.normalized_value).toBe('2024-03');
  });
  it('splits on an en dash with no surrounding spaces', () => {
    const r = parseDateRange('2021–2024');
    expect(r.start.normalized_value).toBe('2021');
    expect(r.end.normalized_value).toBe('2024');
  });
  it('an ongoing role: start known, end is "present"', () => {
    const r = parseDateRange('Mar 2021 - Present');
    expect(r.start.normalized_value).toBe('2021-03');
    expect(r.end.normalized_value).toBe('present');
  });
  it('a single date (no range) leaves end unknown rather than guessing', () => {
    const r = parseDateRange('2021');
    expect(r.start.normalized_value).toBe('2021');
    expect(r.end).toMatchObject({ value: null, requiresInterpretation: true });
  });
  it('no text at all: both ends unknown, does not throw', () => {
    expect(() => parseDateRange('')).not.toThrow();
    expect(parseDateRange(undefined).start.requiresInterpretation).toBe(true);
  });
});

describe('findDateRangeInLine', () => {
  it('finds a trailing tab-separated date range (P1\'s wide-gap tab)', () => {
    const r = findDateRangeInLine('Product Manager, Acme Ltd\t2021 - 2024');
    expect(r.matchedText.replace(/\s+/g, ' ')).toContain('2021');
    expect(r.range.start.normalized_value).toBe('2021');
    expect(r.range.end.normalized_value).toBe('2024');
  });
  it('finds a date range inline with other words', () => {
    const r = findDateRangeInLine('Software Engineer — Jan 2020 - Dec 2022');
    expect(r.range.start.normalized_value).toBe('2020-01');
  });
  it('a bare 4-digit year counts as a date (e.g. a single-year internship line)', () => {
    const r = findDateRangeInLine('Summer intern, 2019');
    expect(r.range.start.normalized_value).toBe('2019');
  });
  it('returns null when the line has no date at all', () => {
    expect(findDateRangeInLine('Led a cross-functional team of 6')).toBeNull();
  });
  it('does not mistake a phone number for a date', () => {
    expect(findDateRangeInLine('Phone: +65 9123 4567')).toBeNull();
  });
});
