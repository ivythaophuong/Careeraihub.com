import { describe, it, expect } from 'vitest';
import { describePart, NOT_ASSESSED } from './describeScorePart';

describe('describePart', () => {
  it('turns the completeness evidence into named checks with a tick or a cross', () => {
    const d = describePart({ id: 'completeness', score: 75, evidence: ['contact.name: present', 'contact.email: missing', 'experience or education: present', 'skills: present'] });
    expect(d.items).toEqual([
      { label: 'Name', ok: true }, { label: 'Email', ok: false }, { label: 'Experience or education', ok: true }, { label: 'Skills', ok: true },
    ]);
    expect(d.text).toContain('✗ Email not found');
    expect(d.text).not.toMatch(/contact\./);
  });
  it('explains an unassessed part by what was looked for, never as "nothing to check"', () => {
    for (const id of ['measurable_impact', 'chronology_health']) {
      const d = describePart({ id, score: null, evidence: [] });
      expect(d.assessed).toBe(false);
      expect(d.text).toBe(NOT_ASSESSED[id]);
      expect(d.text).not.toMatch(/nothing to check/i);
    }
    expect(NOT_ASSESSED.measurable_impact).toMatch(/Work History/);
    expect(NOT_ASSESSED.chronology_health).toMatch(/nay/);
  });
  it('passes the evidence of the other parts through', () => {
    expect(describePart({ id: 'measurable_impact', score: 100, evidence: ['2 of 2 experience bullets contain a measurable number.'] }).text).toMatch(/2 of 2/);
  });
});
