import { describe, it, expect } from 'vitest';
import { normalizeResumeText } from './textNormalize';

const keepsContent = (a, b) => expect(b.replace(/[^\p{L}\p{N}]/gu, '')).toBe(a.replace(/[^\p{L}\p{N}]/gu, ''));

describe('normalizeResumeText', () => {
  it('unifies line endings, odd spaces, zero-width marks and curly quotes', () => {
    const out = normalizeResumeText('Jordan Lee\r\nO’Brien “quoted”​ text﻿');
    expect(out).toBe('Jordan Lee\nO\'Brien "quoted" text');
  });

  it('joins a bullet glyph that sits alone on its line with the text after it', () => {
    expect(normalizeResumeText('Experience\n•\nBuilt a report\n•  \nCut entry by 40%')).toBe('Experience\n• Built a report\n• Cut entry by 40%');
  });

  it('removes trailing spaces and long runs of blank lines but keeps one blank line', () => {
    expect(normalizeResumeText('A   \n\n\n\n\nB')).toBe('A\n\nB');
  });

  it('never removes words, numbers or lines of content', () => {
    const raw = 'Jordan Lee\n \n• 40% faster​\nSQL, Excel’s A/B testing — 2019–2022';
    keepsContent(raw.replace(/[ ​’]/g, ''), normalizeResumeText(raw));
    expect(normalizeResumeText(raw)).toMatch(/2019–2022/); // dashes in date ranges are left alone
  });

  it('is idempotent, and safe on empty or non-string input', () => {
    const once = normalizeResumeText('A b\r\n•\nc');
    expect(normalizeResumeText(once)).toBe(once);
    expect(normalizeResumeText(null)).toBe('');
    expect(normalizeResumeText(undefined)).toBe('');
    expect(normalizeResumeText(42)).toBe('42');
  });
});
