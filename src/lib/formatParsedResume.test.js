import { describe, it, expect } from 'vitest';
import { formatParsedResume, RESUME_EXTRACT_PROMPT } from './formatParsedResume';
import { computeDeterministicScore } from '../scoring/computeDeterministicScore';
import { extractResumeFacts } from '../extraction/resumeFacts';

// What the extraction prompt asks the model to return, for an invented person.
const PARSED = {
  personalInfo: { fullName: 'Jordan Lee', email: 'jordan.lee@example.com', phone: '+65 5555 0100', location: 'Singapore' },
  summary: 'Product analyst with five years of experience turning operational data into decisions for logistics and retail teams.',
  experience: [
    { company: 'Northwind Logistics', position: 'Senior Product Analyst', startDate: 'Mar 2022', endDate: 'Present', description: ['Built a weekly delivery report used by 6 regional managers', 'Cut manual data entry by 40% by redesigning the intake spreadsheet'] },
    { company: 'Harbor Retail', position: 'Product Analyst', startDate: 'Jun 2019', endDate: 'Feb 2022', description: ['Handled monthly KPI reporting for 8 stores'] },
  ],
  education: [{ school: 'National University of Singapore', degree: 'BSc Business Administration', year: '2019' }],
  skills: [{ category: 'Tools', items: ['SQL', 'Excel', 'Power BI'] }],
  projects: [{ name: 'Routing dashboard', description: ['Led a 4-person pilot that reduced late deliveries by 12%'] }],
  certifications: [{ name: 'Google Data Analytics Certificate' }],
};

describe('formatParsedResume', () => {
  it('keeps the contact details the model returned, so the rebuilt text still has an email and a phone number', () => {
    const t = formatParsedResume(PARSED);
    expect(t).toContain('jordan.lee@example.com');
    expect(t).toContain('+65 5555 0100');
    expect(extractResumeFacts(t).contact.email.value).toBe('jordan.lee@example.com');
  });

  it('gives the summary, projects and certifications their own headings, so the section reader can recognise them', () => {
    const t = formatParsedResume(PARSED);
    for (const h of ['SUMMARY', 'EXPERIENCE', 'PROJECTS', 'EDUCATION', 'SKILLS', 'CERTIFICATIONS']) expect(t).toContain(`\n${h}\n`);
    expect(t).toContain('Led a 4-person pilot');
    expect(t).toContain('Google Data Analytics Certificate');
  });

  it('reads back as the same jobs, degree and skills', () => {
    const f = extractResumeFacts(formatParsedResume(PARSED));
    expect(f.experiences.map(e => [e.title.value, e.company.value])).toEqual([['Senior Product Analyst', 'Northwind Logistics'], ['Product Analyst', 'Harbor Retail']]);
    expect(f.education).toHaveLength(1);
    expect(f.skills.map(s => s.value)).toEqual(expect.arrayContaining(['SQL', 'Excel', 'Power BI']));
  });

  it('does not lose the Completeness points: a rebuilt resume with an email scores 100 on Completeness, not 75', () => {
    const r = computeDeterministicScore(formatParsedResume(PARSED));
    expect(r.facts.extraction.status).toBe('ok');
    expect(r.score.parts.find(p => p.id === 'completeness').score).toBe(100);
  });

  it('never writes "undefined" or "null", and skips what is missing', () => {
    const t = formatParsedResume({ personalInfo: { fullName: 'Sam Roe' }, experience: [{ position: 'Analyst', company: 'Acme', startDate: 'Jan 2020' }], education: [{ school: 'State University' }], skills: [{ items: ['SQL'] }] });
    expect(t).not.toMatch(/undefined|null/);
    expect(t).toContain('Sam Roe');
    expect(t).not.toContain('PROJECTS');
    expect(t).not.toContain('CERTIFICATIONS');
  });

  it('is safe on nonsense input', () => {
    expect(formatParsedResume(null)).toBe('');
    expect(formatParsedResume({})).toBe('');
    expect(formatParsedResume({ experience: 'x', skills: [null, 5] })).toBeTypeOf('string');
  });
});

describe('RESUME_EXTRACT_PROMPT', () => {
  it('asks for the sections the rebuilt text keeps', () => {
    for (const k of ['personalInfo', 'email', 'phone', 'location', 'summary', 'experience', 'education', 'skills', 'projects', 'certifications']) expect(RESUME_EXTRACT_PROMPT).toContain(k);
  });
});
