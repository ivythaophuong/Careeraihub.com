// The dates of the Fix page, as pure functions over the Builder data (no screen, no AI). The dates a job and an education entry carry are `period` and `year`.
// An entry is identified by its `id`, never by its position, and nothing here ever makes up a date: code only reads, checks and stores what the user typed.
import { describe, it, expect } from 'vitest';
import { listDateEntries, dateFindings, setDate, mergeDateRecords, undoDates, datesStatus } from './datesFix.js';

const base = () => ({
  contact: { name: 'Jordan Lee', email: 'jordan.lee@example.com', phone: '', linkedin: '', location: 'Singapore' },
  summary: 'Analyst who builds weekly reports.',
  experience: [
    { id: 11, company: 'Acme', title: 'Analyst', period: 'Jan 2021 - Mar 2023', bullets: ['Built a dashboard'] },
    { id: 12, company: 'Beta', title: 'Lead', period: '', bullets: ['Led a team'] },
    { id: 13, company: '', title: '', period: '', bullets: [''] },
  ],
  education: [{ id: 21, institution: 'Example University', degree: 'BSc', year: '2019' }],
  skills: ['SQL'], awards: [], extras: [],
});

describe('listDateEntries', () => {
  it('lists each job and each education entry with the id, a readable label and the date text as it is', () => {
    const l = listDateEntries(base());
    expect(l.map(e => [e.ref.kind, e.ref.id, e.label, e.text])).toEqual([
      ['job', 11, 'Acme', 'Jan 2021 - Mar 2023'],
      ['job', 12, 'Beta', ''],
      ['edu', 21, 'Example University', '2019'],
    ]);
  });
  it('leaves out an entry that is completely blank (the empty row the form keeps)', () => {
    expect(listDateEntries(base()).some(e => e.ref.id === 13)).toBe(false);
  });
  it('an entry with no id is still addressable for this visit, by its place in its own list', () => {
    const d = base(); delete d.experience[0].id;
    expect(listDateEntries(d)[0].ref).toEqual({ kind: 'job', id: 'i0' });
  });
  it('two entries with the same id are both marked ambiguous', () => {
    const d = base(); d.experience[1].id = 11;
    const l = listDateEntries(d).filter(e => e.ref.kind === 'job');
    expect(l.map(e => e.ambiguous)).toEqual([true, true]);
  });
  it('bad data gives an empty list', () => {
    expect(listDateEntries(null)).toEqual([]);
    expect(listDateEntries({})).toEqual([]);
    expect(listDateEntries({ experience: 'x', education: 5 })).toEqual([]);
  });
});

describe('dateFindings: only what code can see', () => {
  const job = (period) => ({ ref: { kind: 'job', id: 1 }, text: period });
  const edu = (year) => ({ ref: { kind: 'edu', id: 1 }, text: year });
  it('a missing date', () => {
    expect(dateFindings(job(''))).toEqual(['missing']);
    expect(dateFindings(job('   '))).toEqual(['missing']);
    expect(dateFindings(edu(''))).toEqual(['missing']);
  });
  it('a date it cannot read', () => {
    expect(dateFindings(job('sometime back'))).toEqual(['unreadable']);
    expect(dateFindings(edu('long ago'))).toEqual(['unreadable']);
  });
  it('a good range, an ongoing role and a single year have no finding', () => {
    expect(dateFindings(job('Jan 2021 - Mar 2023'))).toEqual([]);
    expect(dateFindings(job('2021 – Present'))).toEqual([]);
    expect(dateFindings(job('2021 - now'))).toEqual([]);
    expect(dateFindings(edu('2019'))).toEqual([]);
    expect(dateFindings(edu('2015 - 2019'))).toEqual([]);
  });
  it('an end before the start', () => {
    expect(dateFindings(job('Mar 2023 - Jan 2021'))).toEqual(['end_before_start']);
    expect(dateFindings(job('2023 - 2021'))).toEqual(['end_before_start']);
  });
  it('the same year with different precision is not decided, so it is not a finding', () => {
    expect(dateFindings(job('2021 - Mar 2021'))).toEqual([]);
    expect(dateFindings(job('Mar 2021 - 2021'))).toEqual([]);
  });
  it('it never says what the date should be', () => {
    for (const f of dateFindings(job('2023 - 2021'))) expect(typeof f).toBe('string');
    expect(dateFindings(null)).toEqual(['missing']);
  });
});

describe('setDate', () => {
  it('writes exactly the one field of the one entry, and leaves the rest as it was; the input is not changed', () => {
    const d = base(); const snap = JSON.stringify(d);
    const r = setDate(d, { kind: 'job', id: 12 }, '  Apr 2023 –  Present ');
    expect(r.data.experience[1].period).toBe('Apr 2023 – Present');
    expect(r.data.experience[0].period).toBe('Jan 2021 - Mar 2023');
    expect(r.data.education).toEqual(d.education);
    expect(r.data.summary).toBe(d.summary);
    expect(JSON.stringify(d)).toBe(snap);
    expect(r.record).toEqual({ kind: 'dates', changes: [{ ref: { kind: 'job', id: 12 }, before: '', after: 'Apr 2023 – Present' }] });
  });
  it('an education year is written to year', () => {
    expect(setDate(base(), { kind: 'edu', id: 21 }, '2018').data.education[0].year).toBe('2018');
  });
  it('the entry is found by id even when the list has been reordered', () => {
    const d = base(); d.experience.reverse();
    const r = setDate(d, { kind: 'job', id: 11 }, '2020 - 2022');
    expect(r.data.experience.find(j => j.id === 11).period).toBe('2020 - 2022');
    expect(r.data.experience.find(j => j.id === 12).period).toBe('');
  });
  it('refuses with a clear reason and does not touch the data', () => {
    expect(setDate(base(), { kind: 'job', id: 12 }, '   ')).toEqual({ error: 'empty' });
    expect(setDate(base(), { kind: 'job', id: 99 }, '2020')).toEqual({ error: 'not_found' });
    expect(setDate(base(), { kind: 'job', id: 11 }, 'Jan 2021 - Mar 2023')).toEqual({ error: 'unchanged' });
    expect(setDate(null, { kind: 'job', id: 11 }, '2020')).toEqual({ error: 'no_data' });
    const d = base(); d.experience[1].id = 11;
    expect(setDate(d, { kind: 'job', id: 11 }, '2020')).toEqual({ error: 'ambiguous' });
  });
});

describe('mergeDateRecords: several changes in a visit become one record', () => {
  const rec = (...c) => ({ kind: 'dates', changes: c });
  const ch = (id, before, after) => ({ ref: { kind: 'job', id }, before, after });
  it('with nothing before, it is the new record', () => {
    expect(mergeDateRecords(null, rec(ch(1, 'a', 'b')))).toEqual(rec(ch(1, 'a', 'b')));
  });
  it('the same entry changed twice keeps the first before and the last after', () => {
    expect(mergeDateRecords(rec(ch(1, 'a', 'b')), rec(ch(1, 'b', 'c')))).toEqual(rec(ch(1, 'a', 'c')));
  });
  it('a change that goes back to where it started cancels out', () => {
    expect(mergeDateRecords(rec(ch(1, 'a', 'b')), rec(ch(1, 'b', 'a')))).toEqual(rec());
  });
  it('different entries add up, a bad record is ignored', () => {
    expect(mergeDateRecords(rec(ch(1, 'a', 'b')), rec(ch(2, 'x', 'y'))).changes).toHaveLength(2);
    expect(mergeDateRecords(rec(ch(1, 'a', 'b')), null)).toEqual(rec(ch(1, 'a', 'b')));
  });
});

describe('datesStatus and undoDates: read from the data as it is now', () => {
  const done = () => { const r = setDate(base(), { kind: 'job', id: 12 }, '2023 - Present'); return r; };
  it('no record is open', () => { expect(datesStatus(base(), null)).toBe('open'); expect(datesStatus(base(), { kind: 'skills' })).toBe('open'); });
  it('applied while the date is as saved; applied_edited when the user changed it after', () => {
    const r = done();
    expect(datesStatus(r.data, r.record)).toBe('applied');
    const edited = setDate(r.data, { kind: 'job', id: 12 }, '2022 - Present').data;
    expect(datesStatus(edited, r.record)).toBe('applied_edited');
    expect(datesStatus(null, r.record)).toBe('applied_edited');
  });
  it('undo puts the date back, even to a missing one, and leaves everything else', () => {
    const r = done();
    const back = undoDates(r.data, r.record);
    expect(back.experience[1].period).toBe('');
    expect(back.experience[0]).toEqual(base().experience[0]);
  });
  it('undo of an edited date is refused (null), and so is bad data', () => {
    const r = done();
    expect(undoDates(setDate(r.data, { kind: 'job', id: 12 }, '2022').data, r.record)).toBeNull();
    expect(undoDates(null, r.record)).toBeNull();
    expect(undoDates(r.data, { kind: 'skills' })).toBeNull();
  });
  it('a deleted entry means the change was edited afterwards', () => {
    const r = done(); const gone = { ...r.data, experience: r.data.experience.filter(j => j.id !== 12) };
    expect(datesStatus(gone, r.record)).toBe('applied_edited');
  });
});
