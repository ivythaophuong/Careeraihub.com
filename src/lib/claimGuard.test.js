import { describe, it, expect } from 'vitest';
import { claimWarnings, contributionLevel } from './claimGuard.js';

const resume = 'Jordan Lee\nMarketing Analyst, Acme Corp\n- Assisted the marketing team with campaign reporting.\n- Cut costs by 12%\nSkills: SQL, Excel';
const types = (before, after, source = resume) => claimWarnings({ before, after, resumeText: source }).map(w => w.type);

describe('contributionLevel', () => {
  it('ranks support below doing below leading', () => {
    expect(contributionLevel('Assisted the team with reporting')).toBe(1);
    expect(contributionLevel('Built weekly dashboards')).toBe(2);
    expect(contributionLevel('Led the migration to a new platform')).toBe(3);
    expect(contributionLevel('Spearheaded and owned the roadmap')).toBe(3);
  });
  it('reads verb forms, and uses the highest level in the text', () => {
    expect(contributionLevel('driving strategic decisions')).toBe(3);
    expect(contributionLevel('Assisted with reporting and managing vendors')).toBe(3);
  });
  it('returns 0 when there is no contribution verb', () => {
    expect(contributionLevel('Weekly reports')).toBe(0);
  });
});

describe('claimWarnings', () => {
  it('flags the role being raised from assisted to led (the case a figures check cannot see)', () => {
    const w = claimWarnings({ before: 'Assisted the marketing team with campaign reporting.', after: 'Led marketing analytics, driving strategic campaign decisions.', resumeText: resume });
    expect(w.map(x => x.type)).toContain('ownership');
    expect(w.find(x => x.type === 'ownership').message).toMatch(/assisted|supporting/i);
  });

  it('does not flag a rewrite that keeps the same level', () => {
    expect(types('Assisted the marketing team with campaign reporting.', 'Supported the marketing team by preparing campaign reports.')).toEqual([]);
    expect(types('Cut costs by 12%', 'Reduced costs by 12%')).toEqual([]);
  });

  it('does not flag lowering the level', () => {
    expect(types('Led the reporting team', 'Prepared reports')).toEqual([]);
  });

  it('flags scope words that are not in the resume', () => {
    const w = claimWarnings({ before: 'Prepared reports', after: 'Prepared company-wide reports for executive stakeholders', resumeText: resume });
    const scope = w.find(x => x.type === 'scope');
    expect(scope.words).toEqual(expect.arrayContaining(['company-wide', 'executive', 'stakeholders']));
  });

  it('does not flag a scope word that the resume already uses', () => {
    expect(types('Prepared reports', 'Prepared reports for stakeholders', resume + '\nPresented to stakeholders')).toEqual([]);
  });

  it('flags a tool or name that is not in the resume, but not words already there', () => {
    const w = claimWarnings({ before: 'Prepared reports', after: 'Prepared reports in Tableau and Salesforce for Acme Corp', resumeText: resume });
    const t = w.find(x => x.type === 'new_term');
    expect(t.words).toEqual(expect.arrayContaining(['Tableau', 'Salesforce']));
    expect(t.words).not.toContain('Acme');
  });

  it('flags an outcome claim when neither the text nor the resume has any outcome or number', () => {
    const w = claimWarnings({ before: 'Prepared weekly reports', after: 'Prepared weekly reports, improving decisions and accelerating growth', resumeText: 'Jordan\nAnalyst\n- Prepared weekly reports' });
    expect(w.map(x => x.type)).toContain('result');
  });

  it('does not flag an outcome the resume already states', () => {
    expect(types('Cut costs by 12%', 'Reduced costs by 12% through vendor renegotiation')).not.toContain('result');
  });

  it('ignores a capitalised first word and ordinary sentence words', () => {
    expect(types('Prepared reports', 'Produced weekly reports for the team')).toEqual([]);
  });

  it('returns nothing for empty input', () => {
    expect(claimWarnings({ before: '', after: '', resumeText: '' })).toEqual([]);
    expect(claimWarnings({})).toEqual([]);
  });
});
