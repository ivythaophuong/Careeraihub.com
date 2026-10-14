import { describe, it, expect } from 'vitest';
import { formatParsedResume, RESUME_EXTRACT_PROMPT, readPdfForSetup, REBUILT_RESUME_NOTICE } from './formatParsedResume';
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

describe('readPdfForSetup: says when the text was rebuilt by the model', () => {
  const file = { name: 'cv.pdf' };
  const parsed = { personalInfo: { fullName: 'Ana Silva', email: 'ana@example.com' }, experience: [{ company: 'Acme', position: 'Analyst', description: ['Cut cost 20%'] }] };

  it('a PDF that reads directly is NOT marked rebuilt, and the model is never asked', async () => {
    let asked = false;
    const r = await readPdfForSetup(file, { extractText: async () => 'Ana Silva\nana@example.com', extractWithModel: async () => { asked = true; return parsed; } });
    expect(r).toEqual({ text: 'Ana Silva\nana@example.com', rebuilt: false });
    expect(asked).toBe(false);
  });

  it('a PDF that cannot be read directly is rebuilt from the model JSON and marked rebuilt', async () => {
    const r = await readPdfForSetup(file, { extractText: async () => { throw new Error('worker blocked'); }, extractWithModel: async () => parsed });
    expect(r.rebuilt).toBe(true);
    expect(r.text).toContain('ana@example.com');
  });

  it('when the model also returns nothing usable, the text is empty and it is NOT marked rebuilt (there is nothing to warn about)', async () => {
    const r = await readPdfForSetup(file, { extractText: async () => { throw new Error('x'); }, extractWithModel: async () => ({ error: true }) });
    expect(r).toEqual({ text: '', rebuilt: false });
  });

  it('an error from the model itself still reaches the caller, as before', async () => {
    await expect(readPdfForSetup(file, { extractText: async () => { throw new Error('x'); }, extractWithModel: async () => { throw new Error('429'); } })).rejects.toThrow('429');
  });
});

describe('REBUILT_RESUME_NOTICE', () => {
  it('tells the user the text was rebuilt, that it may differ, and what to do', () => {
    expect(REBUILT_RESUME_NOTICE).toMatch(/rebuilt/i);
    expect(REBUILT_RESUME_NOTICE).toMatch(/differ/i);
    expect(REBUILT_RESUME_NOTICE).toMatch(/\.docx/i);
    expect(REBUILT_RESUME_NOTICE.length).toBeLessThan(220);
  });
});
