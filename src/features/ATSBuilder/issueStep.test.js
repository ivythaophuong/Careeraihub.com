// Where an issue is fixed in the Builder, decided by code and not by the number the AI wrote. The AI's own step is only the last resort.
import { describe, it, expect } from 'vitest';
import { stepForIssue, draftFor } from './issueStep.js';

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
