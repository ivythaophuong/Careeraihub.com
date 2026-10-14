// The same two jobs written in the layouts real resumes use. Each case checks every job in full (title, company, start, end, and each bullet
// word for word, in order), not only counts: a bullet moved to the wrong job, lost, or glued to another would leave the counts unchanged.
// Resumes are synthetic. This is the set of layouts that have been checked, not a promise about every resume.
import { describe, it, expect } from 'vitest';
import { extractResumeFacts } from './resumeFacts';

const JOB_A = { title: 'Senior Analyst', company: 'Acme Corp', start: '2020-01', end: '2023-03',
  bullets: ['Cut report time by 30% across four regional teams by redesigning the weekly intake process', 'Built 3 dashboards'] };
const JOB_B = { title: 'Analyst', company: 'Beta Ltd', start: '2017-06', end: '2019-12', bullets: ['Reduced errors by 25%'] };

const doc = (experience) => `Jordan A. Lee\njordan@example.com | +1 555 0100\n\nExperience\n${experience}\n\nEducation\nBSc Economics, State University, 2016\n\nSkills\nSQL, Excel, Python\n`;
const WRAP_A = ['Cut report time by 30% across four regional teams by redesigning the', 'weekly intake process'];

const LAYOUTS = {
  'title, company / dates / glyph bullets':
    `Senior Analyst, Acme Corp\nJan 2020 – Mar 2023\n• ${WRAP_A.join('\n')}\n• Built 3 dashboards\nAnalyst, Beta Ltd\nJun 2017 – Dec 2019\n• Reduced errors by 25%`,
  'title | company | dates':
    `Senior Analyst | Acme Corp | Jan 2020 – Mar 2023\n• ${WRAP_A.join(' ')}\n• Built 3 dashboards\nAnalyst | Beta Ltd | Jun 2017 – Dec 2019\n• Reduced errors by 25%`,
  'company / title / dates':
    `Acme Corp\nSenior Analyst\nJan 2020 – Mar 2023\n• ${WRAP_A.join(' ')}\n• Built 3 dashboards\nBeta Ltd\nAnalyst\nJun 2017 – Dec 2019\n• Reduced errors by 25%`,
  'title tabbed with dates, company below':
    `Senior Analyst\tJan 2020 – Mar 2023\nAcme Corp\n• ${WRAP_A.join(' ')}\n• Built 3 dashboards\nAnalyst\tJun 2017 – Dec 2019\nBeta Ltd\n• Reduced errors by 25%`,
  'dates written with "to"':
    `Senior Analyst, Acme Corp\nJanuary 2020 to March 2023\n• ${WRAP_A.join(' ')}\n• Built 3 dashboards\nAnalyst, Beta Ltd\nJune 2017 until December 2019\n• Reduced errors by 25%`,
  'numeric dates':
    `Senior Analyst, Acme Corp\n01/2020 - 03/2023\n• ${WRAP_A.join(' ')}\n• Built 3 dashboards\nAnalyst, Beta Ltd\n06/2017 - 12/2019\n• Reduced errors by 25%`,
  'dash bullets':
    `Senior Analyst, Acme Corp\nJan 2020 – Mar 2023\n- ${WRAP_A.join(' ')}\n- Built 3 dashboards\nAnalyst, Beta Ltd\nJun 2017 – Dec 2019\n- Reduced errors by 25%`,
  'no bullet markers (typical of PDFs)':
    `Senior Analyst, Acme Corp\nJan 2020 – Mar 2023\n${WRAP_A.join('\n')}\nBuilt 3 dashboards\nAnalyst, Beta Ltd\nJun 2017 – Dec 2019\nReduced errors by 25%`,
};

const read = (text) => extractResumeFacts(text).experiences.map(e => ({
  title: e.title.value, company: e.company.value, start: e.start?.normalized_value, end: e.end?.normalized_value, bullets: e.bullets.map(b => b.value.replace(/^[•\-*]\s*/, '')),
}));

describe.each(Object.entries(LAYOUTS))('layout: %s', (_name, body) => {
  it('reads both jobs completely and puts every bullet in its own job', () => {
    expect(read(doc(body))).toEqual([JOB_A, JOB_B]);
  });
});

describe('every bullet of the input appears exactly once across the jobs (none lost, repeated or glued to another job)', () => {
  it.each(Object.entries(LAYOUTS))('%s', (_name, body) => {
    const all = read(doc(body)).flatMap(j => j.bullets);
    const expected = [...JOB_A.bullets, ...JOB_B.bullets];
    expect([...all].sort()).toEqual([...expected].sort());
  });
});
