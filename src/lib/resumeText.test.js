import { describe, it, expect } from 'vitest';
import { resumeContent } from './resumeText';

describe('resumeContent', () => {
  it('returns a string as is, including an empty one', () => {
    expect(resumeContent('Jane Doe')).toBe('Jane Doe');
    expect(resumeContent('')).toBe('');
  });
  it('reads the text out of the object Resume Scan stores', () => {
    expect(resumeContent({ type: 'text', content: 'Jane Doe', fileName: 'cv.docx' })).toBe('Jane Doe');
  });
  it.each([[{ type: 'pdf', content: null, fileName: 'cv.pdf' }], [{}], [['a']], [123], [null], [undefined]])(
    'gives an empty string for %j, so .trim() is always safe', (v) => {
      expect(resumeContent(v)).toBe('');
      expect(() => resumeContent(v).trim()).not.toThrow();
    });
});
