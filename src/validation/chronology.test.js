import { describe, it, expect } from 'vitest';
import { checkChronology } from './chronology';

const entry = (start, end, i = 0) => ({
  start: { value: start, normalized_value: start, source: `experiences[${i}].start` },
  end: { value: end, normalized_value: end, source: `experiences[${i}].end` },
});
const facts = (experiences) => ({ experiences });

describe('checkChronology: end before start', () => {
  it('flags an entry whose end is before its own start, as an error', () => {
    const r = checkChronology(facts([entry('2024-01', '2021-01')]));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ kind: 'end_before_start', severity: 'error' });
  });
  it('does not flag a normal entry', () => {
    expect(checkChronology(facts([entry('2021-01', '2024-01')]))).toEqual([]);
  });
  it('does not flag an ongoing role (end = present)', () => {
    expect(checkChronology(facts([entry('2021-01', 'present')]))).toEqual([]);
  });
  it('does not flag when start or end is unknown (null)', () => {
    expect(checkChronology(facts([entry(null, '2024-01')]))).toEqual([]);
    expect(checkChronology(facts([entry('2021-01', null)]))).toEqual([]);
  });
  it('does not guess when precision is too coarse to tell (same year, one lacks a month)', () => {
    expect(checkChronology(facts([entry('2021', '2021-06')]))).toEqual([]);
  });
});

describe('checkChronology: overlaps', () => {
  it('flags two overlapping entries as a warning, not an error', () => {
    const r = checkChronology(facts([entry('2020-01', '2022-01', 0), entry('2021-01', '2023-01', 1)]));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ kind: 'overlapping_experience', severity: 'warning' });
  });
  it('does not flag two separate, non-overlapping entries', () => {
    expect(checkChronology(facts([entry('2018-01', '2019-01', 0), entry('2020-01', '2021-01', 1)]))).toEqual([]);
  });
  it('flags an ongoing role overlapping an earlier one that is still within it', () => {
    const r = checkChronology(facts([entry('2019-01', 'present', 0), entry('2020-01', '2021-01', 1)]));
    expect(r.some(f => f.kind === 'overlapping_experience')).toBe(true);
  });
  it('checks every pair, not just adjacent ones, with three entries', () => {
    const r = checkChronology(facts([
      entry('2018-01', '2019-01', 0),
      entry('2020-01', '2022-01', 1),
      entry('2021-01', '2023-01', 2),
    ]));
    expect(r).toHaveLength(1); // only entries[1] and entries[2] overlap
  });
});

describe('checkChronology: robustness', () => {
  it('tolerates missing or malformed input without throwing', () => {
    expect(checkChronology({})).toEqual([]);
    expect(checkChronology({ experiences: [] })).toEqual([]);
    expect(() => checkChronology(null)).not.toThrow();
    expect(() => checkChronology({ experiences: [{}] })).not.toThrow();
  });
});
