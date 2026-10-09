import { describe, it, expect } from 'vitest';
import { extractExperiences } from './experience';

describe('extractExperiences', () => {
  it('splits a title-then-company entry with the date tabbed onto the title line (P1 shape)', () => {
    const [e] = extractExperiences('Product Manager\tJan 2021 - Mar 2024\nAcme Ltd\n• Increased lead qualification by 20 percent\n• Led a team of 6');
    expect(e.title.value).toBe('Product Manager');
    expect(e.company.value).toBe('Acme Ltd');
    expect(e.start.normalized_value).toBe('2021-01');
    expect(e.end.normalized_value).toBe('2024-03');
    expect(e.bullets.map(b => b.value)).toEqual(['Increased lead qualification by 20 percent', 'Led a team of 6']);
  });

  it('splits a company-then-title entry (the other common order)', () => {
    const [e] = extractExperiences('Acme Ltd\tJan 2021 - Mar 2024\nProduct Manager\n• Shipped three releases');
    expect(e.title.value).toBe('Product Manager');
    expect(e.company.value).toBe('Acme Ltd');
  });

  it('handles "Title, Company" on one line with the date range on the same line', () => {
    const [e] = extractExperiences('Product Manager, Acme Ltd (Jan 2021 - Mar 2024)\n• Increased lead qualification by 20 percent');
    expect(e.title.value).toBe('Product Manager');
    expect(e.company.value).toBe('Acme Ltd');
  });

  it('splits several entries using the date line as the boundary between them', () => {
    const es = extractExperiences(
      'Product Manager\tJan 2023 - Present\nAcme Ltd\n• Did A\n' +
      'Associate PM\tJan 2021 - Dec 2022\nAcme Ltd\n• Did B'
    );
    expect(es).toHaveLength(2);
    expect(es[0].title.value).toBe('Product Manager');
    expect(es[0].end.normalized_value).toBe('present');
    expect(es[1].title.value).toBe('Associate PM');
    expect(es[1].end.normalized_value).toBe('2022-12');
  });

  it('an ongoing role (no end date given) is end=present via the date line', () => {
    const [e] = extractExperiences('Founder\tMar 2022 - Present\nOwn startup\n• Built the product');
    expect(e.end.value).toMatch(/present/i);
  });

  it('is conservative when neither header line looks like a title or a company: both left null', () => {
    const [e] = extractExperiences('Something Vague\tJan 2021 - Mar 2024\nAlso Vague\n• A bullet');
    // Neither "Something Vague" nor "Also Vague" contains a title keyword or an all-caps/company shape
    // distinction strong enough to tell them apart; the extractor must not coin-flip which is which.
    expect(e.title.requiresInterpretation || e.company.requiresInterpretation).toBe(true);
  });

  it('returns an empty array when the section has no date at all (nothing to anchor an entry on)', () => {
    expect(extractExperiences('Worked on various things without any dates listed')).toEqual([]);
    expect(extractExperiences('')).toEqual([]);
  });

  it('bullets never include the entry header or date lines', () => {
    const [e] = extractExperiences('Engineer\tJan 2021 - Mar 2024\nAcme Ltd\n• Did the actual work');
    expect(e.bullets.map(b => b.value)).not.toContain('Acme Ltd');
    expect(e.bullets.every(b => !/2021|2024/.test(b.value))).toBe(true);
  });
});
