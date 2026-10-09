import { describe, it, expect } from 'vitest';
import { compareNormalizedDates, rangesOverlap } from './dateOrder';

describe('compareNormalizedDates', () => {
  it('orders by year first', () => {
    expect(compareNormalizedDates('2020', '2021')).toBe(-1);
    expect(compareNormalizedDates('2021', '2020')).toBe(1);
  });
  it('orders by month when years match and both have one', () => {
    expect(compareNormalizedDates('2021-01', '2021-06')).toBe(-1);
    expect(compareNormalizedDates('2021-06', '2021-01')).toBe(1);
    expect(compareNormalizedDates('2021-06', '2021-06')).toBe(0);
  });
  it('"present" is later than any specific date', () => {
    expect(compareNormalizedDates('2024-01', 'present')).toBe(-1);
    expect(compareNormalizedDates('present', '2024-01')).toBe(1);
    expect(compareNormalizedDates('present', 'present')).toBe(0);
  });
  it('does NOT guess when the same year has mismatched precision', () => {
    expect(compareNormalizedDates('2021', '2021-06')).toBeNull();
    expect(compareNormalizedDates('2021-06', '2021')).toBeNull();
  });
  it('is null for null, undefined, or an unparseable value, never throws', () => {
    expect(compareNormalizedDates(null, '2021')).toBeNull();
    expect(compareNormalizedDates('2021', undefined)).toBeNull();
    expect(compareNormalizedDates('not a date', '2021')).toBeNull();
    expect(() => compareNormalizedDates(null, null)).not.toThrow();
  });
});

describe('rangesOverlap', () => {
  it('detects a clear overlap', () => {
    expect(rangesOverlap('2020-01', '2022-01', '2021-01', '2023-01')).toBe(true);
  });
  it('detects clearly separate ranges', () => {
    expect(rangesOverlap('2018-01', '2019-01', '2020-01', '2021-01')).toBe(false);
  });
  it('an ongoing role overlaps anything that starts before now', () => {
    expect(rangesOverlap('2020-01', 'present', '2021-01', '2022-01')).toBe(true);
  });
  it('is null (no finding), not a guess, when one of the needed comparisons cannot resolve it', () => {
    // startB (2022-06) vs endA (2022): same year, endA has no month, so that one comparison is
    // ambiguous — even though the OTHER comparison (startA vs endB, different years) is clear.
    expect(rangesOverlap('2021-01', '2022', '2022-06', '2023-01')).toBeNull();
  });
});
