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

  it('knows irregular outcome verbs such as grew', () => {
    expect(types('Prepared reports', 'Cut report time by 20%', 'Jordan\n- Grew revenue by 20%\n- Prepared reports')).not.toContain('result');
  });

  it('ignores a capitalised first word and ordinary sentence words', () => {
    expect(types('Prepared reports', 'Produced weekly reports for the team')).toEqual([]);
  });

  it('returns nothing for empty input', () => {
    expect(claimWarnings({ before: '', after: '', resumeText: '' })).toEqual([]);
    expect(claimWarnings({})).toEqual([]);
  });
});

// Cases below are real suggestions recorded on 2026-10-14 from three models on 12 invented resumes (no real person). A rewrite may add no figure and still
// add a tool, a duty, a result, a link or a skill the resume never had; these rules look for those, by words and by form, with no AI. They are WARNINGS for
// the person to check: a word list cannot know what is true.
const SUPPORT = 'Dana Whitfield\nHarbor Mart\n- Supported daily operations and customer service.\nSkills\nCustomer service';

describe('new_content: a rewrite that talks about things the resume never mentions', () => {
  const t = (before, after, src = SUPPORT) => types(before, after, src);
  it('flags a tool, an action and a result at once (the example a product manager gave)', () => {
    expect(t('Supported daily operations and customer service.', 'Improved customer retention by implementing Salesforce workflows.')).toContain('new_content');
  });
  it('flags an invented duty that has no tool, figure or result word', () => {
    expect(t('Supported daily operations and customer service.', 'Trained new colleagues and handled escalated complaints.')).toContain('new_content');
  });
  it('names the new words', () => {
    const w = claimWarnings({ before: 'Supported daily operations and customer service.', after: 'Trained new colleagues and handled escalated complaints.', resumeText: SUPPORT }).find(x => x.type === 'new_content');
    expect(w.words).toEqual(expect.arrayContaining(['trained', 'colleagues', 'escalated', 'complaints']));
    expect(w.message).toMatch(/does not mention/i);
  });
  it('does not flag a faithful rewrite, a one-word change or a role change (that has its own warning)', () => {
    expect(t('Supported daily operations and customer service.', 'Supported daily store operations and customer service.')).not.toContain('new_content');
    expect(t('Supported daily operations and customer service.', 'Led daily operations and customer service.')).not.toContain('new_content');
  });
  it('does not flag a short paraphrase with a blank in it', () => {
    expect(t('Worked at the register and restocked shelves', 'Worked at the register, processing [X] transactions, and restocked shelves.', 'Dana\n- Worked at the register and restocked shelves')).not.toContain('new_content');
  });
  it('is only for a rewrite of text the resume has: a suggestion to add a field has no "before"', () => {
    expect(t('', 'Add location (e.g., City, State) and LinkedIn URL to contact section.')).not.toContain('new_content');
  });
});

describe('invented_link and invented_location: a concrete value the resume does not have', () => {
  const src = 'Ella Brooks\nella@example.com | +1 555 0100\nJunior Designer, Studio Nine';
  it('flags a LinkedIn address with a handle that is not in the resume', () => {
    expect(types('', 'Location: [City, State] | LinkedIn: https://linkedin.com/in/ellabrooks', src)).toContain('invented_link');
    expect(types('sofia@example.com | +1 555 0100', 'sofia@example.com | +1 555 0100 | linkedin.com/in/sofiamarin', src)).toContain('invented_link');
  });
  it('does not flag a blank handle, or a handle the resume already has', () => {
    expect(types('', 'LinkedIn: https://www.linkedin.com/in/[your-handle]', src)).not.toContain('invented_link');
    expect(types('', 'linkedin.com/in/[X]', src)).not.toContain('invented_link');
    expect(types('', 'linkedin.com/in/ellabrooks', src + '\nlinkedin.com/in/ellabrooks')).not.toContain('invented_link');
  });
  it('flags a "Location:" with a real place the resume never names, but not a blank one or one it has', () => {
    expect(types('', 'Location: Tokyo, Japan', src)).toContain('invented_location');
    expect(types('', 'Location: [City, State]', src)).not.toContain('invented_location');
    expect(types('', 'Location: Tokyo, Japan', src + '\nTokyo')).not.toContain('invented_location');
  });
});

describe('new_skill: a skills list that gains items the resume does not have', () => {
  it('flags the items that are new', () => {
    const w = claimWarnings({ before: 'Skills\nExcel, Route planning', after: 'Skills\nExcel, Route planning, Data analysis, Dispatch software, Process improvement', resumeText: 'Kenji Sato\nOperations Assistant\nSkills\nExcel, Route planning' }).find(x => x.type === 'new_skill');
    expect(w.words).toEqual(['data analysis', 'dispatch software', 'process improvement']);
  });
  it('does not flag a reorder, a fuller name for a skill that is there, or a blank', () => {
    const src = 'Omar\nSkills\nTyping, Excel, Data entry';
    expect(types('Typing, Excel, Data entry', 'Excel, Typing, Data entry', src)).not.toContain('new_skill');
    expect(types('Typing, Excel, Data entry', 'Typing, Microsoft Excel, Data entry', src)).not.toContain('new_skill');
    expect(types('Typing, Excel, Data entry', 'Typing ([X] WPM), Excel, Data entry, [X]', src)).not.toContain('new_skill');
  });
  it('does not treat an ordinary sentence with commas as a skills list', () => {
    expect(types('Built weekly dashboards, reports and alerts', 'Built weekly dashboards, reports, alerts and forecasts', 'Jordan\n- Built weekly dashboards, reports and alerts')).not.toContain('new_skill');
  });
});

describe('new_skill: skill names that contain a word like "management" are still a skills list', () => {
  const src = 'Omar Haddad\nTeaching Assistant\nSkills\nClassroom management, Lesson planning';
  it('flags new skills added to "Classroom management, Lesson planning"', () => {
    const w = claimWarnings({ before: 'Classroom management, Lesson planning', after: 'Classroom management, Lesson planning, Curriculum development, Student assessment', resumeText: src }).find(x => x.type === 'new_skill');
    expect(w.words).toEqual(['curriculum development', 'student assessment']);
  });
  it('a sentence that starts with a verb is still not a skills list', () => {
    expect(types('Managed weekly dashboards, reports and alerts', 'Managed weekly dashboards, reports, alerts and forecasts', 'Jordan\n- Managed weekly dashboards, reports and alerts')).not.toContain('new_skill');
  });
  it('a long piece of advice added after a list is not named as a skill', () => {
    const src2 = 'Lina\nSkills\nCanva, Mailchimp, Google Analytics';
    const w = claimWarnings({ before: 'Canva, Mailchimp, Google Analytics', after: 'Canva, Mailchimp, Google Analytics, plus [X] tools named in the target job description', resumeText: src2 }).find(x => x.type === 'new_skill');
    expect(w).toBeUndefined();
  });
});
