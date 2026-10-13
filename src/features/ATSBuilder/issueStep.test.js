// Where an issue is fixed in the Builder, decided by code and not by the number the AI wrote. The AI's own step is only the last resort.
import { describe, it, expect } from 'vitest';
import { stepForIssue, draftFor, isBulletIssue, quoteInResume, isSkillsIssue, isDatesIssue, fieldsIssueKind } from './issueStep.js';

const data = () => ({
  contact: { name: 'Jordan Lee', email: 'jordan.lee@example.com', phone: '', linkedin: '', location: 'Singapore' },
  summary: 'Analyst who builds weekly reports.',
  experience: [{ id: 1, company: 'Acme', title: 'Analyst', period: '2021 - 2023', bullets: ['Handled monthly reporting', 'Built a dashboard for 6 managers'] }],
  education: [], skills: ['SQL'], awards: [], extras: [],
});
const issue = (over) => ({ severity: 'high', title: 'Something', description: '', before: '', after: '', builderStep: 2, module: null, ...over });

describe('stepForIssue', () => {
  it('a quoted sentence in the summary is fixed in the Summary step, whatever the AI said', () => {
    expect(stepForIssue(issue({ title: 'Generic', before: 'builds weekly reports', builderStep: 2 }), data())).toBe(5);
  });

  it('a quoted sentence in a bullet is fixed in the Experience step', () => {
    expect(stepForIssue(issue({ title: 'Generic', before: 'Handled monthly reporting', builderStep: 5 }), data())).toBe(2);
  });

  it.each([
    ['Missing professional summary', 5],
    ['Weak summary statement', 5],
    ['Redundant skill keywords', 4],
    ['Skills list is short', 4],
    ['No metrics in bullets', 2],
    ['Overly long bullet points', 2],
    ['Inconsistent date formatting', 2],
    ['Add a LinkedIn link', 1],
    ['Missing email address', 1],
    ['Degree is not listed', 3],
  ])('"%s" is fixed in step %i, even when the AI gave another number', (title, step) => {
    const wrong = [1, 2, 3, 4, 5].find(n => n !== step);
    expect(stepForIssue(issue({ title, builderStep: wrong }), data())).toBe(step);
  });

  it('when the title names two sections it is not decided by words: the AI step is used', () => {
    expect(stepForIssue(issue({ title: 'Missing location for education institutions', builderStep: 3 }), data())).toBe(3);
    expect(stepForIssue(issue({ title: 'Missing location for education institutions', builderStep: 1 }), data())).toBe(1);
  });

  it('when the title says nothing, the description is read the same way', () => {
    expect(stepForIssue(issue({ title: 'Needs work', description: 'There is no professional summary at the top.', builderStep: 2 }), data())).toBe(5);
  });

  it('when nothing decides, the AI step is used if it is 1 to 5, else null', () => {
    expect(stepForIssue(issue({ title: 'Needs work', builderStep: 3 }), data())).toBe(3);
    expect(stepForIssue(issue({ title: 'Needs work', builderStep: null }), data())).toBeNull();
    expect(stepForIssue(issue({ title: 'Needs work', builderStep: 9 }), data())).toBeNull();
    expect(stepForIssue(null, data())).toBeNull();
  });

  it('does not change the data', () => {
    const d = data(); const copy = JSON.stringify(d);
    stepForIssue(issue({ title: 'Missing professional summary' }), d);
    expect(JSON.stringify(d)).toBe(copy);
  });
});

describe('draftFor: the AI suggestion as it would be put in the form', () => {
  it('shows a figure the resume does not contain as [X], with the figures named', () => {
    const d = draftFor(issue({ after: 'Seasoned analyst with 7+ years delivering insights' }), data());
    expect(d.text).toContain('[X]');
    expect(d.text).not.toContain('7+');
    expect(d.placeholders).toBe(true);
    expect(d.replaced.join(' ')).toMatch(/7/);
  });

  it('keeps a figure the resume already has', () => {
    const d = draftFor(issue({ after: 'Built dashboards used by 6 managers' }), data());
    expect(d.text).toContain('6 managers');
    expect(d.placeholders).toBe(false);
  });

  it('returns nothing when there is no suggestion', () => {
    expect(draftFor(issue({ after: '' }), data())).toBeNull();
    expect(draftFor(issue({ after: '   ' }), data())).toBeNull();
  });

  it('carries the claim warnings', () => {
    const d = data(); d.summary = 'Assisted with weekly reports';
    const x = draftFor(issue({ before: 'Assisted with weekly reports', after: 'Led weekly reports company-wide' }), d);
    expect(x.warnings.length).toBeGreaterThan(0);
  });
});

describe('isBulletIssue: is the issue about the sentences under a job (so the user can pick the sentence)', () => {
  it.each([
    ['Overly long bullet points', true],
    ['No quantifiable impact for many bullets', true],
    ['Lack of quantifiable results', true],
    ['Weak action verbs', true],
    ['Responsibilities listed instead of achievements', true],
    ['Inconsistent date formatting', false],
    ['Missing professional summary', false],
    ['Redundant skill keywords', false],
    ['Missing location for education institutions', false],
  ])('"%s" -> %s', (title, expected) => {
    expect(isBulletIssue({ title, description: '' })).toBe(expected);
  });

  it('reads the description when the title says nothing, and a missing issue is not a bullet issue', () => {
    expect(isBulletIssue({ title: 'Needs work', description: 'Several bullet points describe tasks, not results.' })).toBe(true);
    expect(isBulletIssue({ title: 'Needs work', description: 'Please review.' })).toBe(false);
    expect(isBulletIssue(null)).toBe(false);
  });
});

describe('quoteInResume: show the AI\'s quote only when it really is in the resume', () => {
  it('gives the quote when its sentence is in the resume (an ellipsis is allowed)', () => {
    expect(quoteInResume(issue({ before: 'Handled monthly reporting' }), data())).toBe('Handled monthly reporting');
    expect(quoteInResume(issue({ before: 'Handled monthly...' }), data())).toBe('Handled monthly...');
  });
  it('gives nothing when it is not there, such as a stitched-together fragment of the header', () => {
    expect(quoteInResume(issue({ before: 'JORDAN LEE, CFA ... WORKING EXPERIENCE' }), data())).toBeNull();
    expect(quoteInResume(issue({ before: 'Something never written' }), data())).toBeNull();
  });
  it('gives nothing when there is no quote', () => {
    expect(quoteInResume(issue({ before: '' }), data())).toBeNull();
    expect(quoteInResume(null, data())).toBeNull();
  });
});

describe('isSkillsIssue: the Skills card on the Fix page is for an issue about the skills list, decided by words and never by the AI\'s step number', () => {
  it('the title names only skills, and no sentence of the resume is quoted', () => {
    expect(isSkillsIssue(issue({ title: 'Skills list is short', builderStep: 2 }), data())).toBe(true);
    expect(isSkillsIssue(issue({ title: 'Add keywords from the job description', before: '' }), data())).toBe(true);
  });
  it('the title names no section and the description names only skills', () => {
    expect(isSkillsIssue(issue({ title: 'Too few items', description: 'List more of the tools you use as skills.' }), data())).toBe(true);
  });
  it('the AI step number alone does not make it a skills issue', () => {
    expect(isSkillsIssue(issue({ title: 'Make it stronger', description: 'Needs work.', builderStep: 4 }), data())).toBe(false);
  });
  it('a title that names another section, or two sections, is not (a tie is not guessed)', () => {
    expect(isSkillsIssue(issue({ title: 'Education is missing a degree' }), data())).toBe(false);
    expect(isSkillsIssue(issue({ title: 'Skills and summary are generic' }), data())).toBe(false);
  });
  it('an issue whose quoted sentence is in the resume is a sentence issue, even if the title says skills', () => {
    expect(isSkillsIssue(issue({ title: 'Skills not shown', before: 'Handled monthly reporting' }), data())).toBe(false);
  });
  it('no skills field in the data, or no issue: no', () => {
    const d = data(); delete d.skills;
    expect(isSkillsIssue(issue({ title: 'Skills list is short' }), d)).toBe(false);
    expect(isSkillsIssue(null, data())).toBe(false);
    expect(isSkillsIssue(issue({ title: 'Skills list is short' }), null)).toBe(false);
  });
});

describe('isDatesIssue: the Dates card is for an issue about dates, decided by words, never by the AI\'s step number', () => {
  it('the title names dates, and the quoted text (if any) is not a sentence of the resume', () => {
    expect(isDatesIssue(issue({ title: 'Inconsistent date formatting', before: 'June 2017 – November 2021', builderStep: 5 }), data())).toBe(true);
    expect(isDatesIssue(issue({ title: 'Missing dates on one job' }), data())).toBe(true);
    expect(isDatesIssue(issue({ title: 'Employment timeline has a gap' }), data())).toBe(true);
  });
  it('the title names nothing and the description is about dates only', () => {
    expect(isDatesIssue(issue({ title: 'Needs a closer look', description: 'The dates of your jobs are written in different formats.' }), data())).toBe(true);
  });
  it('a title that names another section, or a sentence issue, is not a dates issue', () => {
    expect(isDatesIssue(issue({ title: 'Weak experience bullets' }), data())).toBe(false);
    expect(isDatesIssue(issue({ title: 'Dates and skills are unclear' }), data())).toBe(false);
    expect(isDatesIssue(issue({ title: 'No metrics in bullets', description: 'Add numbers.' }), data())).toBe(false);
  });
  it('the AI step number alone does not make it one', () => {
    expect(isDatesIssue(issue({ title: 'Make it stronger', description: 'Needs work.', builderStep: 2 }), data())).toBe(false);
  });
  it('an issue whose quoted sentence is in the resume stays a sentence issue', () => {
    expect(isDatesIssue(issue({ title: 'Date wording', before: 'Handled monthly reporting' }), data())).toBe(false);
  });
  it('no experience or education in the data, or no issue: no', () => {
    expect(isDatesIssue(issue({ title: 'Missing dates' }), { summary: 'x' })).toBe(false);
    expect(isDatesIssue(null, data())).toBe(false);
    expect(isDatesIssue(issue({ title: 'Missing dates' }), null)).toBe(false);
  });
});

describe('fieldsIssueKind: the contact card and the education card, decided by words, never by the AI\'s step number', () => {
  it('contact: the title names only the contact details, and no sentence of the resume is quoted', () => {
    expect(fieldsIssueKind(issue({ title: 'No LinkedIn link', before: 'linkedin.com/in/someone-else' }), data())).toBe('contact');
    expect(fieldsIssueKind(issue({ title: 'Email looks unprofessional' }), data())).toBe('contact');
    expect(fieldsIssueKind(issue({ title: 'Phone number missing' }), data())).toBe('contact');
  });
  it('education: the title names only the education', () => {
    expect(fieldsIssueKind(issue({ title: 'Degree is not specified' }), data())).toBe('education');
    expect(fieldsIssueKind(issue({ title: 'University name is unclear' }), data())).toBe('education');
  });
  it('the title names nothing and the description is about one of them', () => {
    expect(fieldsIssueKind(issue({ title: 'Needs a closer look', description: 'Your email address is missing.' }), data())).toBe('contact');
    expect(fieldsIssueKind(issue({ title: 'Needs a closer look', description: 'The school you attended is not named.' }), data())).toBe('education');
  });
  it('two sections named is a tie and is not guessed; a year or a date belongs to the Dates card, not this one', () => {
    expect(fieldsIssueKind(issue({ title: 'Missing location for education institutions' }), data())).toBeNull();
    expect(fieldsIssueKind(issue({ title: 'Missing graduation year' }), data())).toBeNull();
    expect(fieldsIssueKind(issue({ title: 'Education dates are unclear' }), data())).toBeNull();
  });
  it('another section, a quoted sentence of the resume, or the AI step number alone: no', () => {
    expect(fieldsIssueKind(issue({ title: 'Skills list is short' }), data())).toBeNull();
    expect(fieldsIssueKind(issue({ title: 'Email wording', before: 'Handled monthly reporting' }), data())).toBeNull();
    expect(fieldsIssueKind(issue({ title: 'Make it stronger', description: 'Needs work.', builderStep: 1 }), data())).toBeNull();
  });
  it('no contact in the data for a contact issue, no education list for an education issue, no issue: null', () => {
    const d = data(); delete d.contact;
    expect(fieldsIssueKind(issue({ title: 'No LinkedIn link' }), d)).toBeNull();
    const e = data(); delete e.education;
    expect(fieldsIssueKind(issue({ title: 'Degree is not specified' }), e)).toBeNull();
    expect(fieldsIssueKind(null, data())).toBeNull();
    expect(fieldsIssueKind(issue({ title: 'No LinkedIn link' }), null)).toBeNull();
  });
});
