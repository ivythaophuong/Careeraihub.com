import { describe, it, expect } from 'vitest';
import { locateBefore, locateAll, applyIssue, undoApply } from './applyIssue.js';

const base = () => ({
  contact: { name: 'Jordan A. Lee', email: 'jordan@example.com' },
  summary: 'Hard working analyst who likes data.',
  experience: [
    { id: 1, company: 'Acme', title: 'Analyst', period: '2020 - 2023', bullets: ['Responsible for weekly reports', 'Cut report time by 30% across 4 teams'] },
    { id: 2, company: 'Beta', title: 'Analyst', period: '2017 - 2020', bullets: ['Responsible for weekly reports'] },
  ],
  education: [], skills: ['SQL'], awards: [], extras: [],
});

describe('locateBefore', () => {
  it('finds a quote that sits in exactly one bullet', () => {
    expect(locateBefore(base(), 'Cut report time by 30%')).toEqual({ kind: 'bullet', exp: 0, bullet: 1 });
  });
  it('finds a quote in the summary', () => {
    expect(locateBefore(base(), 'Hard working analyst')).toEqual({ kind: 'summary' });
  });
  it('ignores differences in spacing', () => {
    expect(locateBefore(base(), 'Hard   working  analyst')).toEqual({ kind: 'summary' });
  });
  it('does not guess when the quote appears in more than one place', () => {
    expect(locateBefore(base(), 'Responsible for weekly reports')).toBeNull();
  });
  it('returns null when the quote is not there or is empty', () => {
    expect(locateBefore(base(), 'not in the resume')).toBeNull();
    expect(locateBefore(base(), '')).toBeNull();
    expect(locateBefore(base(), undefined)).toBeNull();
  });
});

describe('applyIssue', () => {
  it('replaces the quoted text in the right bullet and leaves everything else alone', () => {
    const d = base();
    const r = applyIssue(d, { before: 'Cut report time by 30%', after: 'Reduced report time by 30%' });
    expect(r.data.experience[0].bullets[1]).toBe('Reduced report time by 30% across 4 teams');
    expect(r.data.experience[0].bullets[0]).toBe('Responsible for weekly reports');
    expect(r.data.experience[1]).toEqual(d.experience[1]);
    expect(d.experience[0].bullets[1]).toBe('Cut report time by 30% across 4 teams'); // input not mutated
  });

  it('turns a figure the resume never had into [X] and says so', () => {
    const r = applyIssue(base(), { before: 'Hard working analyst who likes data.', after: 'Analyst who raised accuracy by 45% for 12 clients.' });
    expect(r.data.summary).toBe('Analyst who raised accuracy by [X]% for [X] clients.');
    expect(r.placeholders).toBe(true);
  });

  it('keeps a figure that is already in the resume', () => {
    const r2 = applyIssue(base(), { before: 'Hard working analyst', after: 'Analyst who cut report time by 30%' });
    expect(r2.data.summary).toContain('30%');
    expect(r2.placeholders).toBe(false);
  });

  it('refuses when the place cannot be found, instead of guessing', () => {
    expect(applyIssue(base(), { before: 'Responsible for weekly reports', after: 'Led weekly reports' })).toEqual({ error: 'not_found' });
    expect(applyIssue(base(), { before: 'zzz', after: 'y' })).toEqual({ error: 'not_found' });
  });

  it('refuses an empty suggestion', () => {
    expect(applyIssue(base(), { before: 'Hard working analyst', after: '  ' })).toEqual({ error: 'empty_after' });
  });
});

describe('undoApply', () => {
  it('puts the original text back', () => {
    const d = base();
    const r = applyIssue(d, { before: 'Cut report time by 30%', after: 'Reduced report time by 30%' });
    const back = undoApply(r.data, r.record);
    expect(back).toEqual(d);
  });
  it('says it cannot when the user already edited the inserted text', () => {
    const r = applyIssue(base(), { before: 'Cut report time by 30%', after: 'Reduced report time by 30%' });
    const edited = JSON.parse(JSON.stringify(r.data));
    edited.experience[0].bullets[1] = 'Something else entirely';
    expect(undoApply(edited, r.record)).toBeNull();
  });
  it('says it cannot when the bullet was deleted meanwhile', () => {
    const r = applyIssue(base(), { before: 'Cut report time by 30%', after: 'Reduced report time by 30%' });
    const gone = JSON.parse(JSON.stringify(r.data));
    gone.experience = [];
    expect(undoApply(gone, r.record)).toBeNull();
  });
});

describe('matching is tolerant of characters that carry no meaning', () => {
  const withText = (summary, bullet) => ({ ...base(), summary, experience: [{ id: 1, company: 'Acme', title: 'A', period: '2020 - 2023', bullets: [bullet] }] });
  it('curly quotes in the quote match straight quotes in the resume, and the reverse', () => {
    expect(locateBefore(withText('x', "Led the team's \"launch\""), 'Led the team\u2019s \u201Claunch\u201D')).toEqual({ kind: 'bullet', exp: 0, bullet: 0 });
    expect(locateBefore(withText('x', 'Led the team\u2019s launch'), "Led the team's launch")).toEqual({ kind: 'bullet', exp: 0, bullet: 0 });
  });
  it('en dash, em dash and hyphen match each other; a no-break space matches a space', () => {
    expect(locateBefore(withText('Run 2020\u20132023 reports', 'y'), 'Run 2020-2023 reports')).toEqual({ kind: 'summary' });
    expect(locateBefore(withText('Run weekly\u00A0reports', 'y'), 'Run weekly reports')).toEqual({ kind: 'summary' });
  });
  it('zero-width characters in the quote are ignored', () => {
    expect(locateBefore(withText('Run weekly reports', 'y'), 'Run\u200B weekly reports')).toEqual({ kind: 'summary' });
  });
  it('does not match different words or different numbers', () => {
    expect(locateBefore(withText('Cut costs by 12%', 'y'), 'Cut costs by 21%')).toBeNull();
  });
});

describe('several places', () => {
  it('locateAll lists every place with a readable label', () => {
    const hits = locateAll(base(), 'Responsible for weekly reports');
    expect(hits.map(h => h.at)).toEqual([{ kind: 'bullet', exp: 0, bullet: 0 }, { kind: 'bullet', exp: 1, bullet: 0 }]);
    expect(hits[1].label).toMatch(/Beta/);
  });
  it('applyIssue changes only the place the user chose', () => {
    const r = applyIssue(base(), { before: 'Responsible for weekly reports', after: 'Produced weekly reports' }, { kind: 'bullet', exp: 1, bullet: 0 });
    expect(r.data.experience[1].bullets[0]).toBe('Produced weekly reports');
    expect(r.data.experience[0].bullets[0]).toBe('Responsible for weekly reports');
  });
  it('refuses a chosen place that does not contain the quote', () => {
    expect(applyIssue(base(), { before: 'Responsible for weekly reports', after: 'x' }, { kind: 'bullet', exp: 0, bullet: 1 })).toEqual({ error: 'not_found' });
  });
});

describe('undo does not depend on positions', () => {
  const issue = { before: 'Cut report time by 30%', after: 'Reduced report time by 30%' };
  it('still works after jobs are reordered or a job is added before it', () => {
    const r = applyIssue(base(), issue);
    const moved = JSON.parse(JSON.stringify(r.data));
    moved.experience.reverse();
    const back = undoApply(moved, r.record);
    expect(JSON.stringify(back)).toContain('Cut report time by 30% across 4 teams');
    const pushed = JSON.parse(JSON.stringify(r.data));
    pushed.experience.unshift({ id: 9, company: 'New', title: 'x', period: '', bullets: ['one', 'two'] });
    expect(JSON.stringify(undoApply(pushed, r.record))).toContain('Cut report time by 30% across 4 teams');
  });
  it('undoing one change leaves a later, different change alone', () => {
    const a = applyIssue(base(), issue);
    const b = applyIssue(a.data, { before: 'Hard working analyst', after: 'Analyst' });
    const back = undoApply(b.data, a.record);
    expect(back.summary).toBe('Analyst who likes data.');
    expect(back.experience[0].bullets[1]).toBe('Cut report time by 30% across 4 teams');
  });
  it('says it cannot when the inserted text now appears in two places', () => {
    const r = applyIssue(base(), issue);
    const twice = JSON.parse(JSON.stringify(r.data));
    twice.experience[1].bullets.push(r.record.inserted);
    expect(undoApply(twice, r.record)).toBeNull();
  });
});
