import { describe, it, expect } from 'vitest';
import { findMetricsInText, bulletHasMetric } from './metrics';

describe('findMetricsInText', () => {
  it('counts a figure with an M, B or K suffix before a count noun ("2M rows per day")', () => {
    expect(findMetricsInText('Built ETL pipelines processing 2M rows per day').map(f => f.value)).toContain('2M rows');
    expect(findMetricsInText('Served 1.5B requests a month').map(f => f.value)).toContain('1.5B requests');
    expect(findMetricsInText('Grew to 300K subscribers').length).toBeGreaterThan(0);
  });
  it('does not read a brand like "3M Company" as a figure', () => {
    expect(findMetricsInText('Worked at 3M Company on adhesives')).toEqual([]);
  });

  it('finds a percentage and normalizes it to a fraction', () => {
    const [f] = findMetricsInText('Increased lead qualification by 20%');
    expect(f.value).toBe('20%');
    expect(f.normalized_value).toBe(0.2);
  });
  it('finds a money amount with a currency symbol and a K/M suffix', () => {
    expect(findMetricsInText('Saved $1.2M annually').some(f => f.value === '$1.2M')).toBe(true);
    expect(findMetricsInText('Managed a $500K budget').some(f => f.value === '$500K')).toBe(true);
  });
  it('finds a multiplier like "3x"', () => {
    expect(findMetricsInText('Grew revenue 3x in one year').some(f => f.value.toLowerCase() === '3x')).toBe(true);
  });
  it('finds a count with a unit word', () => {
    expect(findMetricsInText('Led a team of 6 engineers').some(f => /6\s?engineers/.test(f.value))).toBe(true);
  });
  it('does not report a bare year as a metric', () => {
    expect(findMetricsInText('Joined the company in 2021')).toEqual([]);
  });
  it('a plain bullet with no number gives no metrics', () => {
    expect(findMetricsInText('Collaborated with cross-functional stakeholders')).toEqual([]);
  });
  it('does not double-count the same span under two patterns (percentage wins over bare number)', () => {
    const found = findMetricsInText('Reduced churn by 15%');
    expect(found).toHaveLength(1);
    expect(found[0].value).toBe('15%');
  });
});

describe('bulletHasMetric', () => {
  it('returns the first/best metric for a bullet, or null', () => {
    expect(bulletHasMetric('Increased revenue by 20%').value).toBe('20%');
    expect(bulletHasMetric('Worked on various projects')).toBeNull();
  });
});
