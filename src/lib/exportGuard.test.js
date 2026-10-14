import { describe, it, expect, vi, afterEach } from 'vitest';
import { countPlaceholders, confirmExport } from './exportGuard.js';

afterEach(() => vi.unstubAllGlobals());

describe('countPlaceholders', () => {
  it('counts [X] and [Y] blanks the figure guard left', () => {
    expect(countPlaceholders('Grew revenue by [X]% for [X] clients and [Y] teams')).toBe(3);
  });
  it('is 0 for clean text, empty text and undefined', () => {
    expect(countPlaceholders('Grew revenue by 20%')).toBe(0);
    expect(countPlaceholders('')).toBe(0);
    expect(countPlaceholders(undefined)).toBe(0);
  });
  // Changed on 2026-10-14. This used to say "does not count other brackets" and expected 0 for [Add: Python]. The models write blanks as
  // [number], [type], [City, Region] (measured on 12 resumes), and the Fix page tells the user about them, so the last check before a file
  // leaves the app must see them too. A footnote number like [1] is still not a blank.
  it('counts any short [bracketed] blank, such as the ones the models write', () => {
    expect(countPlaceholders('Fixed [number] [type] defects in [City, Region]')).toBe(3);
    expect(countPlaceholders('Skills: SQL [Add: Python]')).toBe(1);
    expect(countPlaceholders('Cut errors by [X]% and [X]% again')).toBe(2);   // every occurrence, not each kind once
  });
  it('does not count a footnote number, or round brackets', () => {
    expect(countPlaceholders('See [1] and [2], and (include only skills you can support)')).toBe(0);
  });
});

describe('confirmExport', () => {
  it('goes ahead without asking when there is no placeholder', () => {
    const confirm = vi.fn(); vi.stubGlobal('confirm', confirm);
    expect(confirmExport('Clean text')).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });
  it('asks once, says how many blanks, and follows the answer', () => {
    const confirm = vi.fn(() => false); vi.stubGlobal('confirm', confirm);
    expect(confirmExport('Up [X]% and [X] clients')).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toMatch(/2 blanks/);
    expect(confirm.mock.calls[0][0]).toMatch(/\[square brackets\]/);
    confirm.mockReturnValue(true);
    expect(confirmExport('Up [X]%')).toBe(true);
    expect(confirm.mock.calls[1][0]).toMatch(/1 blank\b/);
  });
});

describe('confirmExport asks about the blanks the models write, not only [X]', () => {
  it('asks when a [number] or a [City, Region] is still in the text', () => {
    const confirm = vi.fn(() => false); vi.stubGlobal('confirm', confirm);
    expect(confirmExport('Fixed [number] defects | [City, Region]')).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toMatch(/2 blanks/);
  });
  it('does not ask for a footnote number', () => {
    const confirm = vi.fn(); vi.stubGlobal('confirm', confirm);
    expect(confirmExport('See reference [1]')).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });
});
