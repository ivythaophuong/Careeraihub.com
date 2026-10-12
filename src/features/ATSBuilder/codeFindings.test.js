import { describe, it, expect } from 'vitest';
import { codeFindings } from './codeFindings.js';
import { scoreBuilderData } from './builderText.js';

const full = () => ({
  contact: { name: 'Jordan A. Lee', email: 'j@example.com', phone: '+1 555 0100' },
  summary: 'Analyst.',
  experience: [{ id: 1, company: 'Acme', title: 'Analyst', period: '2020 - 2023', bullets: ['Cut time by 30%', 'Served 4 teams'] }],
  education: [{ id: 1, institution: 'State University', degree: 'BSc', year: '2016' }],
  skills: ['SQL'],
});
const ids = (d) => codeFindings(scoreBuilderData(d)).map(f => f.id);

describe('codeFindings (read from the real scorer output)', () => {
  it('finds nothing to fix in a complete draft', () => {
    expect(ids(full())).toEqual([]);
  });

  it('names a missing email and sends the user to the Contact step', () => {
    const d = full(); d.contact.email = '';
    const f = codeFindings(scoreBuilderData(d));
    expect(f.map(x => x.id)).toEqual(['email']);
    expect(f[0].builderStep).toBe(1);
  });

  it('names missing skills (step 4), missing name (step 1) and missing experience/education (step 2)', () => {
    const d = full(); d.skills = []; d.contact.name = '';
    expect(ids(d).sort()).toEqual(['name', 'skills']);
    const e = full(); e.experience = []; e.education = [];
    const f = codeFindings(scoreBuilderData(e)).find(x => x.id === 'experience_or_education');
    expect(f.builderStep).toBe(2);
  });

  it('says how many bullets have no number, without writing any number for the user', () => {
    const d = full(); d.experience[0].bullets = ['Cut time by 30%', 'Helped the team', 'Wrote reports'];
    const f = codeFindings(scoreBuilderData(d)).find(x => x.id === 'numbers');
    expect(f.description).toMatch(/2 of 3/);
    expect(f.builderStep).toBe(2);
  });

  it('reports a date contradiction on the Experience step', () => {
    const d = full(); d.experience[0].period = '2023 - 2020';
    const f = codeFindings(scoreBuilderData(d)).find(x => x.id === 'dates');
    expect(f).toBeTruthy();
    expect(f.builderStep).toBe(2);
  });

  it('returns an empty list for no score', () => {
    expect(codeFindings(null)).toEqual([]);
  });
});
