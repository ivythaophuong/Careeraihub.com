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
  it('does not count other brackets', () => {
    expect(countPlaceholders('See [1] and [Add: Python]')).toBe(0);
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
    confirm.mockReturnValue(true);
    expect(confirmExport('Up [X]%')).toBe(true);
    expect(confirm.mock.calls[1][0]).toMatch(/1 blank\b/);
  });
});
