import { describe, it, expect } from 'vitest';
import { findUnsupportedNumbers, numberKeys } from './numberGuard';

describe('findUnsupportedNumbers (strict)', () => {
  it('accepts equivalent spellings of numbers the user wrote', () => {
    expect(findUnsupportedNumbers('We had 2 million users and 15 percent growth', 'Served 2M users with 15% growth')).toEqual([]);
  });
  it('flags numbers the user never wrote, once each', () => {
    expect(findUnsupportedNumbers('We shipped it', '40% faster, 40% cheaper, saved $200k')).toEqual(['40%', '$200k']);
  });
  it('flags small plain numbers in strict mode', () => {
    expect(findUnsupportedNumbers('We shipped it', 'Done in 48 hours')).toEqual(['48']);
  });
});

describe('findUnsupportedNumbers (moneyOnly)', () => {
  const f = (src, out) => findUnsupportedNumbers(src, out, { moneyOnly: true });
  it('ignores durations, step numbers and years', () => {
    expect(f('offer is 95000', 'Reply within 48 hours, in 2-3 days, step 2, back in 2025')).toEqual([]);
  });
  it('still flags amounts, rates, and large numbers not supplied', () => {
    expect(f('offer is 95000', 'Ask for $120,000, a 12% raise, or 8k more, or 130000')).toEqual(['$120,000', '12%', '8k', '130000']);
  });
  it('accepts the user\'s own figures in other formats', () => {
    expect(f('offer is 95000 and I want 115k', 'Ask for $95,000 and settle near 115000')).toEqual([]);
  });
  it('treats a comma-grouped four-digit number as money even if it looks like a year', () => {
    expect(f('', 'Offer of 2,025')).toEqual(['2,025']);
  });
});

describe('numberKeys', () => {
  it('maps number words', () => { expect(numberKeys('three and twenty').has('20')).toBe(true); });
});
