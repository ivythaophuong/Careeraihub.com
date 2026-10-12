import { describe, it, expect } from 'vitest';
import { builderDataToText, scoreBuilderData } from './builderText.js';

const base = () => ({
  contact: { name: 'Jordan A. Lee', email: 'jordan@example.com', phone: '+1 555 0100', location: 'Austin, TX', linkedin: '' },
  summary: 'Operations analyst with reporting experience.',
  experience: [
    { id: 1, company: 'Acme Corp', title: 'Senior Analyst', period: '2020 - 2023', bullets: ['Cut report time by 30% across 4 teams', 'Built 3 weekly dashboards'] },
    { id: 2, company: 'Beta Ltd', title: 'Analyst', period: '2017 - 2020', bullets: ['Reduced errors by 25%'] },
  ],
  education: [{ id: 1, institution: 'State University', degree: 'BSc Economics', year: '2016' }],
  skills: ['SQL', 'Excel', 'Python'],
  awards: [],
  extras: [],
});

describe('builderDataToText', () => {
  it('writes the name first, then standard section headings the reader recognises', () => {
    const t = builderDataToText(base());
    expect(t.split('\n')[0]).toBe('Jordan A. Lee');
    for (const h of ['Summary', 'Work Experience', 'Education', 'Skills']) expect(t).toMatch(new RegExp(`^${h}$`, 'm'));
  });

  it('skips empty jobs, blank bullets and blank skills, and omits empty sections', () => {
    const d = base();
    d.experience.push({ id: 3, company: '', title: '', period: '', bullets: [''] });
    d.skills = ['SQL', '', '  '];
    d.awards = [];
    const t = builderDataToText(d);
    expect(t).not.toMatch(/^Awards$/m);
    expect(t).toContain('SQL');
    expect(t.match(/Acme Corp/g)).toHaveLength(1);
  });

  it('does not crash on an empty draft', () => {
    expect(builderDataToText({ contact: {}, experience: [], education: [], skills: [] })).toBe('');
  });

  it('includes awards and extra sections under their own headings, bullets as lines', () => {
    const d = base();
    d.awards = ['Employee of the year'];
    d.extras = [{ heading: 'Certifications', items: ['PMP'] }];
    const t = builderDataToText(d);
    expect(t).toMatch(/^Certifications$/m);
    expect(t).toContain('PMP');
    expect(t).toContain('Employee of the year');
  });
});

describe('scoreBuilderData', () => {
  it('reads every section of a complete draft: all three parts score, nothing missing', () => {
    const r = scoreBuilderData(base());
    expect(r.score).toBe(100);
    expect(r.missing).toEqual([]);
  });

  it('is the same number for the same data, and moves when the user edits', () => {
    const a = scoreBuilderData(base());
    expect(scoreBuilderData(base()).score).toBe(a.score);
    const d = base();
    d.experience.forEach(j => { j.bullets = j.bullets.map(b => b.replace(/\d+%?/g, 'many')); });
    const b = scoreBuilderData(d);
    expect(b.score).toBeLessThan(a.score);
    expect(b.parts.find(p => p.id === 'measurable_impact').score).toBeLessThan(100);
  });

  it('reports a missing email through the code checks', () => {
    const d = base(); d.contact.email = '';
    const r = scoreBuilderData(d);
    expect(r.score).toBeLessThan(100);
    expect(JSON.stringify(r.parts.find(p => p.id === 'completeness').evidence)).toMatch(/email/i);
  });

  it('returns null for an empty draft instead of a made-up number', () => {
    expect(scoreBuilderData({ contact: {}, experience: [], education: [], skills: [] })).toBeNull();
  });
});
