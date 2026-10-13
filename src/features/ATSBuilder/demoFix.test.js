// A development-only demo: a synthetic resume and issues so the Fix page can be tried where the AI call is blocked (localhost, CORS).
import { describe, it, expect } from 'vitest';
import { demoFixProfile, DEMO_FIX_PROFILE } from './demoFix.js';
import { fixTargets } from './fixPage.js';
import { isSkillsIssue, isDatesIssue, fieldsIssueKind } from './issueStep.js';
import { listDateEntries, dateFindings } from './datesFix.js';
import { listContactFields, listEducationFields, listJobFields, fieldFindings } from './fieldsFix.js';

// What the Builder keeps of a profile that the issue locator reads: the summary and the experience bullets.
const toData = (p) => ({ summary: p.summary || '', experience: p.workExperience.map((w, i) => ({ id: i, company: w.company || '', title: w.title || '', period: w.period || '', bullets: w.bullets })) });

describe('demoFixProfile', () => {
  it('is returned only in development and only for ?demo=fix', () => {
    expect(demoFixProfile({ dev: true, search: '?demo=fix' })).toBe(DEMO_FIX_PROFILE);
    expect(demoFixProfile({ dev: true, search: '?tab=ats&demo=fix' })).toBe(DEMO_FIX_PROFILE);
    expect(demoFixProfile({ dev: true, search: '' })).toBeNull();
    expect(demoFixProfile({ dev: true, search: '?demo=other' })).toBeNull();
    expect(demoFixProfile({ dev: true })).toBeNull();
  });

  it('is never returned in a production build, whatever the address says', () => {
    expect(demoFixProfile({ dev: false, search: '?demo=fix' })).toBeNull();
    expect(demoFixProfile({ search: '?demo=fix' })).toBeNull();
  });

  it('is synthetic: no real name, email, phone or link', () => {
    const t = JSON.stringify(DEMO_FIX_PROFILE);
    expect(t).not.toMatch(/https?:|www\.|linkedin\.com/);
    expect(t).not.toMatch(/\+\d{6,}|\b\d{3}[\s-]\d{3,4}[\s-]\d{4}\b/);   // a phone number; a period such as 2021 - 2023 is not one
    expect(DEMO_FIX_PROFILE.email).toMatch(/@example\.com$/);
  });

  it('has issues that show each case of the Fix page: one place, several places, the summary, no quoted text, another module', () => {
    const data = toData(DEMO_FIX_PROFILE);
    const kinds = DEMO_FIX_PROFILE.issues.map(i => fixTargets(data, i).kind);
    expect(kinds).toEqual(['one', 'many', 'one', 'no_before', 'no_before', 'no_before', 'no_before', 'no_before', 'no_before']);
    expect(DEMO_FIX_PROFILE.issues[8].module).toBe('scan');
    expect(fixTargets(data, DEMO_FIX_PROFILE.issues[2]).places[0].at).toEqual({ kind: 'summary' });
  });

  it('has a draft with a figure the resume does not contain, so the [X] note can be seen', () => {
    expect(DEMO_FIX_PROFILE.issues[0].after).toMatch(/30%/);
    expect(JSON.stringify(DEMO_FIX_PROFILE.workExperience)).not.toMatch(/30%/);
  });

  // The same data as the Builder keeps it (the ids are the positions, as the Builder gives them when it loads a profile).
  const builderData = () => {
    const p = DEMO_FIX_PROFILE;
    return {
      contact: { name: p.name, email: p.email, phone: p.phone, linkedin: p.linkedin, location: p.location }, summary: p.summary,
      experience: p.workExperience.map((w, i) => ({ id: i, company: w.company || '', title: w.title || '', period: w.period || '', bullets: w.bullets })),
      education: p.education.map((e, i) => ({ id: i, institution: e.institution || '', degree: e.degree || '', year: e.year || '' })), skills: p.skills, awards: [], extras: [],
    };
  };

  it('has one issue for each card of the Fix page, and each goes to its own card', () => {
    const d = builderData(); const I = DEMO_FIX_PROFILE.issues;
    expect(isSkillsIssue(I[3], d)).toBe(true);
    expect(isDatesIssue(I[4], d)).toBe(true);
    expect(fieldsIssueKind(I[5], d)).toBe('contact');
    expect(fieldsIssueKind(I[6], d)).toBe('education');
    expect(fieldsIssueKind(I[7], d)).toBe('experience');
    expect(I.slice(3, 8).every(i => !i.before && !i.after)).toBe(true);   // the demo issues carry no AI text of their own to show
  });

  it('has data that makes every card show something real: a missing phone and LinkedIn, a missing company and degree, a missing and a backwards date', () => {
    const d = builderData();
    expect(listContactFields(d).filter(f => fieldFindings(f).includes('missing')).map(f => f.ref.field)).toEqual(['phone', 'linkedin']);
    expect(listJobFields(d).filter(f => fieldFindings(f).includes('missing')).map(f => `${f.ref.field}:${f.group}`)).toEqual(['company:Intern']);
    expect(listEducationFields(d).filter(f => fieldFindings(f).includes('missing')).map(f => `${f.ref.field}:${f.group}`)).toEqual(['degree:Example College']);
    const codes = listDateEntries(d).map(e => [e.label, dateFindings(e)]);
    expect(codes).toContainEqual(['Intern', ['end_before_start']]);
    expect(codes).toContainEqual(['Example College', ['missing']]);
  });
});
