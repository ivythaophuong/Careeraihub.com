import { describe, it, expect } from 'vitest';
import { locateBefore, applyIssue, undoApply } from './applyIssue.js';

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
