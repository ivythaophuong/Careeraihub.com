import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import StructurePanel from './StructurePanel';

afterEach(cleanup);
const scored = { status: 'scored', score: 63, language: 'en', score_version: 'v1', evidence: [
  { id: 'length', label: 'Length', score: 100, weight: 0.1, outcome: 'pass', value: { words: 34 }, note: '' },
  { id: 'specificity', label: 'Specific details (numbers, names, tools)', score: 40, weight: 0.25, outcome: 'fail', value: { numbers: 0 }, note: 'No number found.' },
], notes: [] };

describe('StructurePanel', () => {
  it('shows the score, every check with its outcome, and says what the score is not', () => {
    render(<StructurePanel result={scored} />);
    expect(screen.getByText(/Structure Score/)).toBeTruthy();
    expect(screen.getByLabelText('Structure Score')).toHaveProperty('textContent', '63');
    expect(screen.getByText('Length')).toBeTruthy();
    expect(screen.getByText(/No number found/)).toBeTruthy();
    expect(screen.getByRole('note').textContent).toMatch(/how the answer is built/i);
    expect(screen.getByRole('note').textContent).toMatch(/not how good it is/i);
  });
  it('is labelled as a beta preview of rules, separate from the AI feedback, and says nothing is saved', () => {
    render(<StructurePanel result={scored} />);
    const t = screen.getByRole('region', { name: /Structure Score/ }).textContent;
    expect(t).toMatch(/beta/i); expect(t).toMatch(/rules/i); expect(t).toMatch(/preview/i);
    expect(t).toMatch(/not saved/i); expect(t).toMatch(/does not change your score/i);
  });
  it.each([
    ['insufficient_data', /too short|not enough/i],
    ['unsupported_language', /language/i],
    ['processing_error', /could not/i],
  ])('shows %s as its own state, with no number', (status, text) => {
    render(<StructurePanel result={{ status, score: null, evidence: [], notes: [] }} />);
    expect(screen.queryByLabelText('Structure Score')).toBeNull();
    expect(screen.getByRole('region', { name: /Structure Score/ }).textContent).toMatch(text);
    expect(screen.getByRole('region').textContent).not.toMatch(/\b0\b/);
  });
});
