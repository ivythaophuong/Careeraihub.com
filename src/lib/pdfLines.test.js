import { describe, it, expect } from 'vitest';
import { buildLinesFromPdfItems } from './pdfLines';

// pdf.js text items: { str, transform: [a, b, c, d, x, y], width, hasEOL }
const item = (str, x, y, width = str.length * 5, hasEOL = false) => ({ str, transform: [10, 0, 0, 10, x, y], width, hasEOL });

describe('buildLinesFromPdfItems', () => {
  it('joins runs of different styles on the same line into one line', () => {
    const items = [item('Senior Product Analyst', 30, 700), item(', Northwind Logistics', 30 + 110, 700, 100, true)];
    expect(buildLinesFromPdfItems(items)).toBe('Senior Product Analyst, Northwind Logistics');
  });

  it('puts a bullet glyph and its text on one line, with a space between them', () => {
    const items = [item('•', 30, 680, 5), item('Built a weekly report', 44, 680, 100, true)];
    expect(buildLinesFromPdfItems(items)).toBe('• Built a weekly report');
  });

  it('starts a new line when the vertical position changes, even without an end-of-line flag', () => {
    const items = [item('Experience', 30, 700), item('Senior Product Analyst', 30, 684)];
    expect(buildLinesFromPdfItems(items)).toBe('Experience\nSenior Product Analyst');
  });

  it('does not add a space inside a word that was split by kerning (no gap), but does between words (a gap)', () => {
    const items = [item('Pro', 30, 700, 15), item('duct', 45, 700, 20), item('Analyst', 75, 700, 35, true)];
    expect(buildLinesFromPdfItems(items)).toBe('Product Analyst');
  });

  it('keeps items that carry their own spaces as they are', () => {
    const items = [item('Led ', 30, 700, 20), item('a 4-person pilot', 50, 700, 80, true)];
    expect(buildLinesFromPdfItems(items)).toBe('Led a 4-person pilot');
  });

  it('drops empty items and blank lines, but uses an empty item with an end-of-line flag as a line break', () => {
    const items = [item('Skills', 30, 700), { str: '', hasEOL: true }, { str: '', hasEOL: true }, item('SQL, Excel', 30, 684, 50, true)];
    expect(buildLinesFromPdfItems(items)).toBe('Skills\nSQL, Excel');
  });

  it('works when items have no coordinates (keeps words apart with a space) and on empty input', () => {
    expect(buildLinesFromPdfItems([{ str: 'SQL', hasEOL: false }, { str: 'Excel', hasEOL: true }])).toBe('SQL Excel');
    expect(buildLinesFromPdfItems([])).toBe('');
    expect(buildLinesFromPdfItems(null)).toBe('');
  });
});
