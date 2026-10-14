import { describe, it, expect } from 'vitest';
import { claimWarnings, contributionLevel, warningsForIssue } from './claimGuard.js';

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

// Layer 2, evidence: the model is asked to quote the resume for what a suggestion is based on ("evidence") and to name anything it added that the
// resume does not say ("unsupported"). Code does not trust either: a quote must really be in the resume, and a suggestion that adds words nobody
// declared is warned about. When the model returned neither field (the old format), none of these warnings appears.
describe('evidence and declared additions', () => {
  const R = 'Dana Whitfield\nHarbor Mart\n- Supported daily operations and customer service.\n- Worked at the register\nSkills\nCustomer service';
  const w = (extra) => claimWarnings({ before: 'Supported daily operations and customer service.', resumeText: R, ...extra });
  const typesOf = (extra) => w(extra).map(x => x.type);

  it('a quote that is in the resume is fine, whatever the case and punctuation', () => {
    expect(typesOf({ after: 'Supported daily store operations and customer service.', evidence: ['supported daily operations, and Customer Service'] })).not.toContain('bad_evidence');
  });
  it('a quote that is NOT in the resume is flagged, and named', () => {
    const x = w({ after: 'Supported daily operations and customer service.', evidence: ['Led a team of twelve cashiers at Harbor Mart'] }).find(y => y.type === 'bad_evidence');
    expect(x.words).toEqual(['Led a team of twelve cashiers at Harbor Mart']);
    expect(x.message).toMatch(/not in your resume/i);
  });
  it('a very short quote cannot be checked and is not flagged', () => {
    expect(typesOf({ after: 'Supported operations.', evidence: ['ops'] })).not.toContain('bad_evidence');
  });
  it('what the model says it added is passed on to the user', () => {
    const x = w({ after: 'Improved retention by implementing Salesforce workflows.', evidence: ['Supported daily operations and customer service'], unsupported: ['Salesforce workflows', 'improved retention'] }).find(y => y.type === 'declared_addition');
    expect(x.words).toEqual(['Salesforce workflows', 'improved retention']);
    expect(x.message).toMatch(/AI says/i);
  });
  it('words added without saying so are flagged when the model used the new format', () => {
    const x = w({ after: 'Trained new colleagues and handled escalated complaints.', evidence: ['Supported daily operations and customer service'], unsupported: [] }).find(y => y.type === 'undeclared_addition');
    expect(x.words).toEqual(expect.arrayContaining(['trained', 'colleagues', 'escalated', 'complaints']));
    expect(x.message).toMatch(/did not mention/i);
  });
  it('words the model declared are not also reported as undeclared', () => {
    const t = typesOf({ after: 'Trained new colleagues and handled escalated complaints.', evidence: ['Supported daily operations and customer service'], unsupported: ['trained new colleagues', 'handled escalated complaints'] });
    expect(t).toContain('declared_addition');
    expect(t).not.toContain('undeclared_addition');
  });
  it('a faithful rewrite with a real quote and nothing declared produces none of the evidence warnings', () => {
    const t = typesOf({ after: 'Supported daily store operations and customer service.', evidence: ['Supported daily operations and customer service'], unsupported: [] });
    expect(t.filter(x => ['bad_evidence', 'declared_addition', 'undeclared_addition'].includes(x))).toEqual([]);
  });
  it('one new word is a paraphrase, not an addition', () => {
    expect(typesOf({ after: 'Supported daily store operations and customer service.', evidence: ['Supported daily operations and customer service'], unsupported: [] })).not.toContain('undeclared_addition');
  });
  it('with neither field (the old format) there are no evidence warnings at all', () => {
    const t = typesOf({ after: 'Trained new colleagues and handled escalated complaints.' });
    expect(t.filter(x => ['bad_evidence', 'declared_addition', 'undeclared_addition'].includes(x))).toEqual([]);
  });
  it('odd values are ignored: not an array, not strings, too long, too many', () => {
    expect(typesOf({ after: 'Supported operations.', evidence: 'a string', unsupported: { a: 1 } }).filter(x => /evidence|addition/.test(x))).toEqual([]);
    const x = w({ after: 'Supported operations with alpha beta gamma delta epsilon zeta eta.', evidence: [], unsupported: [7, null, 'a'.repeat(300), 'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta'] }).find(y => y.type === 'declared_addition');
    expect(x.words.length).toBeLessThanOrEqual(5);
    expect(x.words.every(s => typeof s === 'string' && s.length <= 120)).toBe(true);
  });
});

// Measured 2026-10-14 (12 invented resumes): gpt-6-luna listed "number of customers assisted" as something it added, for a suggestion that already has [X]
// in that place, in 74% of its suggestions. That is the figure the user is already asked to fill; saying it again turns almost every button into
// "I confirm" and wears the warning out. Haiku's "added without saying" mostly fired on the contact line (city, region, LinkedIn).
describe('evidence warnings: no noise from figures that are already blanks, or from the contact line', () => {
  const R = 'Dana Whitfield\nHarbor Mart\n- Supported daily operations and customer service.\nSkills\nCustomer service';
  const w = (extra) => claimWarnings({ before: 'Supported daily operations and customer service.', resumeText: R, evidence: ['Supported daily operations and customer service'], ...extra });
  const typesOf = (extra) => w(extra).map(x => x.type);

  it('a declaration that only restates a figure left as a blank is not passed on', () => {
    expect(typesOf({ after: 'Helped [X] customers find products.', unsupported: ['number of customers assisted', 'headcount of staff supervised', 'percentage of tickets resolved', 'the total value', 'Number of shelves restocked'] })).not.toContain('declared_addition');
  });
  it('a real declaration next to such figures is still passed on, alone', () => {
    const x = w({ after: 'Improved retention by implementing Salesforce workflows, for [X] accounts.', unsupported: ['number of accounts', 'Salesforce workflows'] }).find(y => y.type === 'declared_addition');
    expect(x.words).toEqual(['Salesforce workflows']);
  });
  it('a declaration about a missing detail that is not a figure is kept', () => {
    expect(typesOf({ after: 'Contributed to the web app, including [X].', unsupported: ['specific web app contribution'] })).toContain('declared_addition');
  });
  it('words added to the contact line are not reported as "added without saying so"', () => {
    const t = claimWarnings({ before: 'ben@example.com | +1 555 0100', after: 'ben@example.com | +1 555 0100 | [X] city, region | linkedin.com/in/[X]', resumeText: 'Ben\nben@example.com | +1 555 0100', evidence: [], unsupported: [] }).map(x => x.type);
    expect(t).not.toContain('undeclared_addition');
  });
  it('the same kind of words added to a bullet still are', () => {
    expect(typesOf({ after: 'Trained new colleagues and handled escalated complaints.', unsupported: [] })).toContain('undeclared_addition');
  });
});

// Second round of the same measurement: after the figure filter, most of what gpt-6-luna still declared was a blank in other words ("bug count", "report
// count", "specific Excel task"). A declaration is passed on only when it points at a word the suggestion really added (a word that is in "after" and
// not in the resume), and never for the contact line.
describe('a declaration counts only when it points at something the suggestion added', () => {
  const R = 'Dana Whitfield\nHarbor Mart\n- Worked on the web app with the team\nSkills\nJavaScript';
  const w = (extra) => claimWarnings({ before: 'Worked on the web app with the team', resumeText: R, evidence: ['Worked on the web app with the team'], ...extra });
  it('is dropped when it only names a detail the person has to fill', () => {
    const t = w({ after: 'Fixed [X] bugs in the web app with the team.', unsupported: ['bug count', 'specific code review contribution', 'affected area'] }).map(x => x.type);
    expect(t).not.toContain('declared_addition');
  });
  it('is kept when it names words the suggestion really added', () => {
    const x = w({ after: 'Built a Salesforce integration for the web app.', unsupported: ['Salesforce integration', 'bug count'] }).find(y => y.type === 'declared_addition');
    expect(x.words).toEqual(['Salesforce integration']);
  });
  it('is kept for a skill or a role the suggestion added', () => {
    expect(w({ after: 'Prepared the weekly reports for the web app team.', unsupported: ["'Prepared' implies ownership of the reports"] }).map(x => x.type)).toContain('declared_addition');
  });
  it('is dropped on the contact line', () => {
    const t = claimWarnings({ before: 'ben@example.com | +1 555 0100', after: 'ben@example.com | +1 555 0100 | [X] city, region | linkedin.com/in/[X]', resumeText: 'Ben\nben@example.com | +1 555 0100', evidence: [], unsupported: ['city and region', 'LinkedIn profile URL'] }).map(x => x.type);
    expect(t).not.toContain('declared_addition');
  });
});

describe('a declaration about a quantity is a blank in other words', () => {
  const R = 'Dana Whitfield\nHarbor Mart\n- Worked on the web app with the team\nSkills\nJavaScript';
  const t = (after, unsupported) => claimWarnings({ before: 'Worked on the web app with the team', resumeText: R, evidence: ['Worked on the web app with the team'], after, unsupported }).map(x => x.type);
  it.each([['bug count'], ['route count per week'], ['invoice and payment volume'], ['call volume figure'], ['monthly transaction volume']])('%s is not passed on', (phrase) => {
    expect(t('Fixed [X] bugs, routes, invoices and payment calls in the web app with the team.', [phrase])).not.toContain('declared_addition');
  });
  it('a tool or a duty next to a blank is still passed on', () => {
    expect(t('Fixed [X] Salesforce bugs in the web app with the team.', ['Salesforce'])).toContain('declared_addition');
  });
});

describe('warningsForIssue: the messages for one suggestion, with what the model said about it', () => {
  const R = 'Dana Whitfield\nHarbor Mart\n- Supported daily operations and customer service.\nSkills\nCustomer service';
  const issue = { before: 'Supported daily operations and customer service.', after: 'Improved retention by implementing Salesforce workflows.', evidence: ['Supported daily operations and customer service'], unsupported: ['Salesforce workflows'] };
  it('returns the message strings, including the model\'s own declaration', () => {
    const m = warningsForIssue(issue, R);
    expect(m.every(x => typeof x === 'string')).toBe(true);
    expect(m.join(' ')).toMatch(/The AI says this suggestion adds: Salesforce workflows/);
  });
  it('works without the two fields (a suggestion saved before they existed)', () => {
    const { evidence, unsupported, ...old } = issue;
    expect(warningsForIssue(old, R).join(' ')).not.toMatch(/The AI says/);
  });
  it('can be asked about another text than issue.after (the draft as it would be saved)', () => {
    expect(warningsForIssue({ ...issue, unsupported: [] }, R, 'Supported daily store operations and customer service.')).toEqual([]);
  });
  it('is safe with no issue', () => {
    expect(warningsForIssue(undefined, R)).toEqual([]);
    expect(warningsForIssue({}, R)).toEqual([]);
  });
});
