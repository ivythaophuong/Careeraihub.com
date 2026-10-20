// Estimated speaking rate (user story D1): a deterministic calculation from a transcript and a recording duration. Information only.
import { describe, it, expect } from 'vitest';
import { countWords, estimateWpm } from './speakingRate.js';

const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

describe('countWords', () => {
  it('counts whitespace-separated words', () => {
    expect(countWords('I led the migration.')).toBe(4);
    expect(countWords('  two   spaces\nand\ta tab ')).toBe(5);
  });
  it('counts a hyphenated or apostrophe word as one', () => {
    expect(countWords("we're a cross-functional team")).toBe(4);
  });
  it('does not count tokens that are only punctuation', () => {
    expect(countWords('well — I think , yes ...')).toBe(4);
  });
  it('counts numbers and figures as words', () => {
    expect(countWords('We grew revenue 25% in 2024')).toBe(6);
  });
  it('is 0 for empty, whitespace-only or non-string input', () => {
    for (const v of ['', '   \n', null, undefined, 42, {}]) expect(countWords(v)).toBe(0);
  });
});

describe('estimateWpm', () => {
  it('is words x 60 / seconds, rounded', () => {
    expect(estimateWpm({ text: words(75), durationSec: 30 })).toEqual({ state: 'ok', wpm: 150, words: 75, durationSec: 30 });
    expect(estimateWpm({ text: words(100), durationSec: 45 })).toMatchObject({ state: 'ok', wpm: 133 }); // 133.33
  });
  it('gives the same result for the same input, every time', () => {
    const a = estimateWpm({ text: words(61), durationSec: 29.5 });
    for (let i = 0; i < 5; i++) expect(estimateWpm({ text: words(61), durationSec: 29.5 })).toEqual(a);
  });
  it.each([
    ['empty transcript', { text: '', durationSec: 30 }, 'no_transcript'],
    ['whitespace-only transcript', { text: '  \n ', durationSec: 30 }, 'no_transcript'],
    ['punctuation-only transcript', { text: '... — ,', durationSec: 30 }, 'no_transcript'],
    ['missing transcript', { durationSec: 30 }, 'no_transcript'],
    ['missing duration', { text: words(10) }, 'no_duration'],
    ['zero duration', { text: words(10), durationSec: 0 }, 'no_duration'],
    ['negative duration', { text: words(10), durationSec: -5 }, 'no_duration'],
    ['NaN duration', { text: words(10), durationSec: NaN }, 'no_duration'],
    ['Infinity duration', { text: words(10), durationSec: Infinity }, 'no_duration'],
    ['string duration', { text: words(10), durationSec: '30' }, 'no_duration'],
  ])('shows no number for %s', (_n, input, reason) => {
    const r = estimateWpm(input);
    expect(r).toEqual({ state: 'unavailable', reason });
    expect('wpm' in r).toBe(false); // never 0, never a fallback
  });
  it('never throws, whatever it is given', () => {
    for (const v of [undefined, null, 5, 'x', [], { text: Symbol('s') }]) expect(() => estimateWpm(v)).not.toThrow();
  });
});
