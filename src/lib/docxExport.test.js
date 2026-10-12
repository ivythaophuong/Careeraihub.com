import { describe, it, expect } from 'vitest';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { buildResumeDocx } from './docxExport.js';

const data = {
  contact: { name: 'Jordan A. Lee', email: 'jordan@example.com', phone: '+1 555 0100', location: 'Austin, TX', linkedin: '' },
  summary: 'Operations analyst who cut report time by 30% & improved quality.',
  experience: [
    { id: 1, company: 'Acme <Corp>', title: 'Senior Analyst', period: '2020 - 2023', bullets: ['Led a team of 4', 'Cut costs by 12%', '  '] },
    { id: 2, company: 'Beta Ltd', title: 'Analyst', period: '2017 - 2020', bullets: ['Built weekly reports'] },
    { id: 3, company: '', title: 'ignored', period: '', bullets: ['ignored bullet'] },
  ],
  education: [{ id: 1, institution: 'State University', degree: 'BSc Economics', year: '2016' }],
  skills: ['SQL', 'Excel', '  ', 'Python'],
  awards: ['Employee of the year 2022'],
  extras: [{ heading: 'Certifications', items: ['PMP', 'CFA Level 1'] }],
};

const toBuffer = async (d) => Buffer.from(await buildResumeDocx(d));
const raw = async (d) => (await mammoth.extractRawText({ buffer: await toBuffer(d) })).value;
const html = async (d) => (await mammoth.convertToHtml({ buffer: await toBuffer(d) })).value;

describe('buildResumeDocx', () => {
  it('produces a valid .docx package that Word-style readers can open', async () => {
    const zip = await JSZip.loadAsync(await buildResumeDocx(data));
    for (const f of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/_rels/document.xml.rels']) {
      expect(zip.file(f), f).toBeTruthy();
    }
  });

  it('keeps the name, contact line and section headings as plain readable text', async () => {
    const text = await raw(data);
    expect(text).toContain('Jordan A. Lee');
    expect(text).toContain('jordan@example.com');
    for (const h of ['Summary', 'Work Experience', 'Education', 'Skills', 'Awards', 'Certifications']) expect(text).toContain(h);
  });

  it('writes sections as real headings and bullets as real list items', async () => {
    const h = await html(data);
    expect(h).toMatch(/<h1>Work Experience<\/h1>/);
    expect(h).toMatch(/<li>Led a team of 4<\/li>/);
    expect(h).toMatch(/<li>PMP<\/li>/);
  });

  it('keeps the order: jobs as given, and every figure exactly as written', async () => {
    const text = await raw(data);
    expect(text.indexOf('Acme')).toBeLessThan(text.indexOf('Beta Ltd'));
    expect(text).toContain('Cut costs by 12%');
    expect(text).toContain('cut report time by 30% & improved quality');
  });

  it('escapes markup characters instead of breaking the file', async () => {
    expect(await raw(data)).toContain('Acme <Corp>');
  });

  it('skips jobs with no company, blank bullets and blank skills, like the templates do', async () => {
    const text = await raw(data);
    expect(text).not.toContain('ignored');
    expect(text).toContain('SQL, Excel, Python');
  });

  it('leaves out sections that are empty and does not crash on an empty resume', async () => {
    const text = await raw({ contact: { name: 'Sam Doe' } });
    expect(text).toContain('Sam Doe');
    expect(text).not.toContain('Work Experience');
  });
});
