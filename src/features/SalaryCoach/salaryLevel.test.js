import { describe, it, expect } from 'vitest';
import { userLevelIndex, isCacheCurrent, MARKET_CACHE_VERSION } from './salaryLevel';

describe('userLevelIndex', () => {
  it('maps onboarding levels to rows', () => {
    expect(userLevelIndex('Junior')).toBe(0);
    expect(userLevelIndex('Senior')).toBe(2);
    expect(userLevelIndex('Director+')).toBe(4);
  });
  it('never guesses a level', () => {
    expect(userLevelIndex('')).toBe(-1);
    expect(userLevelIndex(undefined)).toBe(-1);
    expect(userLevelIndex('Intern')).toBe(-1);
    expect(userLevelIndex('Wizard')).toBe(-1);
  });
});

describe('isCacheCurrent', () => {
  const ctx = { role: 'Product Manager', level: 'Junior', market: 'Singapore' };
  const good = { v: MARKET_CACHE_VERSION, forRole: 'Product Manager', forLevel: 'Junior', forMarket: 'Singapore' };
  it('accepts a cache made for the same inputs', () => expect(isCacheCurrent(good, ctx)).toBe(true));
  it('rejects caches from before versioning (they may hold invented "You" rows)', () => {
    expect(isCacheCurrent({ data: {}, forRole: 'Product Manager' }, ctx)).toBe(false);
  });
  it('rejects a cache for a different level, role or market', () => {
    expect(isCacheCurrent({ ...good, forLevel: 'Senior' }, ctx)).toBe(false);
    expect(isCacheCurrent({ ...good, forRole: 'Engineer' }, ctx)).toBe(false);
    expect(isCacheCurrent({ ...good, forMarket: 'Global' }, ctx)).toBe(false);
    expect(isCacheCurrent(undefined, ctx)).toBe(false);
  });
});
