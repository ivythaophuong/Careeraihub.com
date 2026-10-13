// The Skills field of the Fix page, as pure functions over the Builder data (no screen, no AI). Skills are plain strings with no id, so a skill is
// identified by its normalised text (NFC, spaces collapsed, case ignored), never by its position in the list.
import { describe, it, expect } from 'vitest';
import { normalizeSkill, skillKey, skillList, skillsFindings, addSkill, removeSkill, skillsStatus } from './skillsFix.js';

const base = (skills = ['SQL', 'Excel']) => ({
  contact: { name: 'Jordan Lee', email: 'jordan.lee@example.com', phone: '', linkedin: '', location: 'Singapore' },
  summary: 'Analyst who builds weekly reports.',
  experience: [{ id: 1, company: 'Acme', title: 'Analyst', period: '2021 - 2023', bullets: ['Built a dashboard for 6 managers'] }],
  education: [{ id: 0, institution: 'Example University', degree: 'BSc', year: '2019' }],
  skills, awards: [], extras: [],
});

describe('normalising a skill', () => {
  it('trims, collapses spaces (also no-break and tabs) and composes accents', () => {
    expect(normalizeSkill('  Power   BI\t')).toBe('Power BI');
    expect(normalizeSkill('Café design')).toBe('Café design');
  });
  it('the key ignores case, the shown text keeps it', () => {
    expect(skillKey('  sql ')).toBe(skillKey('SQL'));
    expect(normalizeSkill(' sql ')).toBe('sql');
  });
  it('nothing in, nothing out: not a string, blank', () => {
    expect(normalizeSkill(undefined)).toBe('');
    expect(normalizeSkill(null)).toBe('');
    expect(normalizeSkill('   ')).toBe('');
    expect(normalizeSkill(42)).toBe('');
  });
});

describe('skillList', () => {
  it('gives the filled skills, normalised, in order; the blank placeholder the Builder keeps is not a skill', () => {
    expect(skillList(base(['SQL', '', '  Excel  ']))).toEqual(['SQL', 'Excel']);
    expect(skillList(base(['']))).toEqual([]);
  });
  it('bad data gives an empty list, never a throw', () => {
    expect(skillList(null)).toEqual([]);
    expect(skillList({})).toEqual([]);
    expect(skillList({ skills: 'SQL, Excel' })).toEqual([]);
    expect(skillList({ skills: [1, null, 'SQL'] })).toEqual(['SQL']);
  });
});

describe('skillsFindings: only what code can see', () => {
  it('an empty list', () => {
    expect(skillsFindings(base([''])).empty).toBe(true);
    expect(skillsFindings(base(['SQL'])).empty).toBe(false);
  });
  it('a skill repeated after normalising, once per repeated skill, in the words of its first appearance', () => {
    expect(skillsFindings(base(['SQL', 'Excel', ' sql ', 'SQL'])).duplicates).toEqual(['SQL']);
    expect(skillsFindings(base(['SQL', 'Excel'])).duplicates).toEqual([]);
  });
  it('says nothing about which skills are missing: that is not something code knows', () => {
    expect(Object.keys(skillsFindings(base()))).toEqual(['empty', 'duplicates', 'count']);
    expect(skillsFindings(base()).count).toBe(2);
  });
});

describe('addSkill', () => {
  it('adds exactly one item, at the end, and leaves everything else as it was', () => {
    const d = base();
    const before = JSON.stringify(d);
    const r = addSkill(d, '  Power BI ');
    expect(r.data.skills).toEqual(['SQL', 'Excel', 'Power BI']);
    expect(JSON.stringify(d)).toBe(before); // the input is not changed
    const { skills: _a, ...rest } = r.data; const { skills: _b, ...restBefore } = d;
    expect(rest).toEqual(restBefore);
    expect(r.record).toEqual({ kind: 'skills', added: ['Power BI'], removed: [] });
  });
  it('drops the blank placeholder when the first real skill goes in', () => {
    expect(addSkill(base(['']), 'SQL').data.skills).toEqual(['SQL']);
  });
  it('a blank text and a skill already there (any case or spacing) are refused, the data is not touched', () => {
    expect(addSkill(base(), '   ')).toEqual({ error: 'empty' });
    expect(addSkill(base(), undefined)).toEqual({ error: 'empty' });
    expect(addSkill(base(), ' sql')).toEqual({ error: 'duplicate' });
  });
  it('bad data is refused, not thrown at', () => {
    expect(addSkill(null, 'SQL')).toEqual({ error: 'no_data' });
    expect(addSkill({ skills: 'x' }, 'SQL')).toEqual({ error: 'no_data' });
  });
});

describe('removeSkill', () => {
  it('removes one item and leaves the others unchanged and in order', () => {
    const d = base(['SQL', 'Excel', 'Tableau']);
    const r = removeSkill(d, 'excel');
    expect(r.data.skills).toEqual(['SQL', 'Tableau']);
    expect(d.skills).toEqual(['SQL', 'Excel', 'Tableau']);
    expect(r.record).toEqual({ kind: 'skills', added: [], removed: ['Excel'] });
  });
  it('with a repeated skill, one removal takes one item, not both', () => {
    expect(removeSkill(base(['SQL', 'Excel', 'sql']), 'SQL').data.skills).toEqual(['Excel', 'sql']);
  });
  it('a skill that is not there, or bad data, gives a clear error and no change', () => {
    expect(removeSkill(base(), 'Python')).toEqual({ error: 'not_found' });
    expect(removeSkill(base(['']), 'SQL')).toEqual({ error: 'not_found' });
    expect(removeSkill(null, 'SQL')).toEqual({ error: 'no_data' });
  });
  it('removing the last skill leaves the blank placeholder the Builder form needs', () => {
    expect(removeSkill(base(['SQL']), 'SQL').data.skills).toEqual(['']);
  });
});

describe('skillsStatus: read from the data as it is now, never from a button', () => {
  it('no record: open', () => {
    expect(skillsStatus(base(), null)).toBe('open');
  });
  it('a record whose changes are still in the data: applied', () => {
    const a = addSkill(base(), 'Power BI');
    expect(skillsStatus(a.data, a.record)).toBe('applied');
    const r = removeSkill(base(['SQL', 'Excel']), 'Excel');
    expect(skillsStatus(r.data, r.record)).toBe('applied');
  });
  it('the user changed it afterwards: applied_edited', () => {
    const a = addSkill(base(), 'Power BI');
    const later = removeSkill(a.data, 'Power BI').data;
    expect(skillsStatus(later, a.record)).toBe('applied_edited');
    const r = removeSkill(base(['SQL', 'Excel']), 'Excel');
    expect(skillsStatus(addSkill(r.data, 'Excel').data, r.record)).toBe('applied_edited');
  });
  it('bad data or a bad record does not throw', () => {
    expect(skillsStatus(null, { kind: 'skills', added: ['X'], removed: [] })).toBe('applied_edited');
    expect(skillsStatus(base(), { kind: 'other' })).toBe('open');
  });
});

describe('the summary and bullet targets are not touched by this module', () => {
  it('adding a skill leaves the summary, the bullets and the education exactly as they were', () => {
    const d = base();
    const r = addSkill(d, 'Power BI').data;
    expect(r.summary).toBe(d.summary);
    expect(r.experience).toEqual(d.experience);
    expect(r.education).toEqual(d.education);
  });
});
