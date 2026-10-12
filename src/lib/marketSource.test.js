import { describe, it, expect } from 'vitest';
import { marketSource, PRODUCT_DEFAULT_MARKET } from './marketSource.js';

describe('marketSource: where a market value can have come from (until the user\'s choice is stored with its source)', () => {
  it('the product default is Singapore (the value the app starts with)', () => {
    expect(PRODUCT_DEFAULT_MARKET).toBe('Singapore');
  });
  it('an empty value is none', () => {
    for (const v of ['', '   ', undefined, null]) expect(marketSource(v)).toEqual({ source: 'none', market: '' });
  });
  it('a value other than the default must have been chosen by the user, because the app never sets it', () => {
    expect(marketSource('Southeast Asia')).toEqual({ source: 'user_selected', market: 'Southeast Asia' });
    expect(marketSource('  Global ')).toEqual({ source: 'user_selected', market: 'Global' });
  });
  it('the default value could be either a choice or the default: it is NOT reported as a choice', () => {
    expect(marketSource('Singapore')).toEqual({ source: 'default_or_unknown', market: 'Singapore' });
    expect(marketSource(' singapore ')).toEqual({ source: 'default_or_unknown', market: 'singapore' });
  });
});
