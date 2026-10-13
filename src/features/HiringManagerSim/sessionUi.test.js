import { describe, it, expect } from 'vitest';
import { formatElapsed, describeEvaluationFailure } from './sessionUi';

describe('formatElapsed', () => {
  it('formats minutes and hours, and never shows nonsense', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(65_000)).toBe('01:05');
    expect(formatElapsed(3_725_000)).toBe('1:02:05');
    expect(formatElapsed(-5)).toBe('00:00');
    expect(formatElapsed(NaN)).toBe('00:00');
  });
});

describe('describeEvaluationFailure', () => {
  it('says "unknown" when no HTTP status came back (timeout or network), and that a retry is a new AI request', () => {
    const f = describeEvaluationFailure(new Error('The request timed out.'));
    expect(f.kind).toBe('unknown');
    expect(f.text).toMatch(/could not confirm whether/);
    expect(f.text).toMatch(/still here/);
    expect(f.text).toMatch(/new AI request/);
    expect(f.text).not.toMatch(/safe/i);
  });
  it('says the answer was not evaluated when the server answered with an error', () => {
    const f = describeEvaluationFailure(Object.assign(new Error('The AI could not evaluate the answer.'), { status: 502 }));
    expect(f.kind).toBe('known');
    expect(f.text).toMatch(/was not evaluated/);
    expect(f.text).not.toMatch(/could not confirm/);
  });
  it('treats 429 as a limit: not evaluated, wait', () => {
    const f = describeEvaluationFailure(Object.assign(new Error('Too many requests.'), { status: 429 }));
    expect(f.kind).toBe('limit');
    expect(f.text).toMatch(/not evaluated/);
  });
});
