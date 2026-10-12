import { describe, it, expect } from 'vitest';
import { splitFirstSentence } from './feedbackDetail.js';

describe('splitFirstSentence', () => {
  it('returns the first sentence as the headline and the rest as the detail', () => {
    expect(splitFirstSentence('No measurable result. You describe the work but never say what changed. Add one number.'))
      .toEqual({ head: 'No measurable result.', more: 'You describe the work but never say what changed. Add one number.' });
  });
  it('has no detail for a one-sentence text', () => {
    expect(splitFirstSentence('Clear structure.')).toEqual({ head: 'Clear structure.', more: '' });
    expect(splitFirstSentence('No full stop at the end')).toEqual({ head: 'No full stop at the end', more: '' });
  });
  it('does not split inside a decimal, an abbreviation-like initial or a figure', () => {
    expect(splitFirstSentence('You said 2.5 million users. Name the team.')).toEqual({ head: 'You said 2.5 million users.', more: 'Name the team.' });
    expect(splitFirstSentence('Say e.g. what you built. Then the result.').head).toBe('Say e.g. what you built.');
  });
  it('splits on ! and ? as well', () => {
    expect(splitFirstSentence('What was the result? Say it plainly.')).toEqual({ head: 'What was the result?', more: 'Say it plainly.' });
  });
  it('is safe on empty or non-string input', () => {
    expect(splitFirstSentence('')).toEqual({ head: '', more: '' });
    expect(splitFirstSentence(undefined)).toEqual({ head: '', more: '' });
    expect(splitFirstSentence(null)).toEqual({ head: '', more: '' });
  });
  it('keeps every character: head and detail together are the original text', () => {
    const t = 'First one. Second one! Third one?';
    const { head, more } = splitFirstSentence(t);
    expect(`${head} ${more}`.trim()).toBe(t);
  });
});
