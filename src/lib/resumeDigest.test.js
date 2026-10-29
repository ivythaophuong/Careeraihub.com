import { describe, it, expect } from 'vitest';
import {
  splitSections, termInText, digestResume, digestJd, checkKeywords, prepareJdMatch,
  RESUME_BUDGET, JD_BUDGET,
} from './resumeDigest';
import { buildAnalysisPrompt } from '../features/ATSBuilder/atsBuilderUtils.js';

const filler = (chars) => 'Led cross-functional initiatives and reported progress to stakeholders.\n'
  .repeat(Math.ceil(chars / 70)).slice(0, chars);

// A long CV whose Skills section, with SQL, sits at the very end.
const cvWithSkillsAtEnd = (bodyChars) =>
  `Jane Doe\njane@example.com\n\nEXPERIENCE\nProduct Analyst, Example Co\n${filler(bodyChars)}\n\nEDUCATION\nBSc Statistics, Example University\n\nSKILLS\nSQL, Python, Tableau\n`;

const JD = 'Associate Product Manager\n\nRequirements\n- SQL for product analytics\n- Stakeholder communication\n';

describe.each([8_000, 20_000, 50_000])('keyword that only appears at the end of a %i-char CV', (size) => {
  const cv = cvWithSkillsAtEnd(size);

  it('is found by code, so it is not reported missing', () => {
    const r = checkKeywords(['SQL', 'Stakeholder communication', 'Kubernetes'], cv, `${JD}\n- Kubernetes`);
    expect(r.matched).toContain('SQL');
    expect(r.missing).not.toContain('SQL');
    expect(r.missing).toContain('Kubernetes');
  });

  it('is still visible to the AI in the condensed resume', () => {
    expect(digestResume(cv).text).toMatch(/SQL, Python, Tableau/);
  });

  it('never sends more than the budget, however long the CV is', () => {
    expect(digestResume(cv).text.length).toBeLessThanOrEqual(RESUME_BUDGET);
  });
});

describe('a huge resume', () => {
  it('is bounded at 200,000 characters and the user is told', () => {
    const cv = cvWithSkillsAtEnd(200_000);
    const p = prepareJdMatch(cv, JD);
    expect(p.resume.length).toBeLessThanOrEqual(RESUME_BUDGET);
    expect(p.notice).toMatch(/condensed/i);
    expect(p.notice).toMatch(/200,0\d\d|2\d\d,\d{3}/);
    expect(p.notice).toMatch(/keyword/i);
  });
  it('gives no notice and sends everything when it fits', () => {
    const p = prepareJdMatch('Jane Doe\nSKILLS\nSQL\n', JD);
    expect(p.notice).toBeNull();
    expect(p.resume).toBe('Jane Doe\nSKILLS\nSQL');
  });
});

describe('a long job description', () => {
  const bigJd = `About us\n${filler(5_000)}\n\nRequirements\n- Strong Kubernetes experience\n- SQL\n\nBenefits\n${filler(3_000)}`;
  it('keeps the requirements section even when it starts after the old 2000-char cut', () => {
    expect(bigJd.indexOf('Kubernetes')).toBeGreaterThan(5_000);
    const d = digestJd(bigJd);
    expect(d.text).toMatch(/Kubernetes/);
    expect(d.text.length).toBeLessThanOrEqual(JD_BUDGET);
    expect(d.truncated).toBe(true);
  });
  it('does not touch a short JD', () => {
    expect(digestJd(JD).truncated).toBe(false);
  });
});

describe('checkKeywords', () => {
  it('drops keywords the AI proposed that are not in the job description', () => {
    const r = checkKeywords(['SQL', 'AI'], 'SKILLS\nPython\n', JD);
    expect(r.dropped).toEqual(['AI']);
    expect(r.missing).toEqual(['SQL']);
    expect(r.matched).toEqual([]);
  });
  it('deduplicates ignoring case', () => {
    const r = checkKeywords(['sql', 'SQL'], 'x', JD);
    expect(r.missing).toHaveLength(1);
  });
});

describe('termInText', () => {
  it('matches whole terms only', () => {
    expect(termInText('Built MySQL and NoSQL stores', 'SQL')).toBe(false);
    expect(termInText('Wrote SQL daily', 'sql')).toBe(true);
  });
  it('handles C++, C#, Node.js and multi-word terms', () => {
    expect(termInText('Skills: C++, C#, Node.js', 'C++')).toBe(true);
    expect(termInText('Skills: C++, C#, Node.js', 'C#')).toBe(true);
    expect(termInText('Skills: C++, C#, Node.js', 'node.js')).toBe(true);
    expect(termInText('Stakeholder   communication skills', 'stakeholder communication')).toBe(true);
    expect(termInText('Skills: C++', 'C')).toBe(false);
  });
});

describe('splitSections', () => {
  it('finds common headings in any case', () => {
    const names = splitSections(cvWithSkillsAtEnd(100)).map(s => s.name);
    expect(names).toEqual(['header', 'experience', 'education', 'skills']);
  });
});

describe('ATS Builder before/after comparison', () => {
  it('no longer reads only the first 2000 characters of each resume', () => {
    const original = cvWithSkillsAtEnd(20_000);
    const improved = original.replace('Tableau', 'Tableau, Looker');
    const prompt = buildAnalysisPrompt(original, improved);
    expect(prompt).not.toMatch(/first 2000 chars/i);
    expect(prompt).toMatch(/Looker/);
    expect(prompt).toMatch(/SQL, Python, Tableau/);
    expect(prompt.length).toBeLessThan(2 * RESUME_BUDGET + 1500);
  });
});
