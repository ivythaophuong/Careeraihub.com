// The contact details and the school and degree of the Fix page, as pure functions over the Builder data (no screen, no AI). An education entry is found by
// its id, never by its position. Code checks only what it can see (a missing field, an email that is not shaped like one, too few digits in a phone number,
// a LinkedIn address that is not one); it never rewrites a value into another one and never makes one up.
import { describe, it, expect } from 'vitest';
import { listContactFields, listEducationFields, fieldFindings, setField, mergeFieldRecords, fieldsStatus, undoFields } from './fieldsFix.js';

const base = () => ({
  contact: { name: 'Jordan Lee', email: 'jordan.lee@example.com', phone: '+65 8123 4567', linkedin: 'linkedin.com/in/jordan-lee', location: 'Singapore' },
  summary: 'Analyst who builds weekly reports.',
  experience: [{ id: 1, company: 'Acme', title: 'Analyst', period: '2021 - 2023', bullets: ['Built a dashboard'] }],
  education: [
    { id: 21, institution: 'Example University', degree: 'BSc Business', year: '2019' },
    { id: 22, institution: '', degree: 'Diploma', year: '2015' },
    { id: 23, institution: '', degree: '', year: '' },
  ],
  skills: ['SQL'], awards: [], extras: [],
});

describe('listContactFields', () => {
  it('lists the five contact fields, filled or not, in a fixed order with readable labels', () => {
    expect(listContactFields(base()).map(f => [f.ref.field, f.label, f.text])).toEqual([
      ['name', 'Name', 'Jordan Lee'], ['email', 'Email', 'jordan.lee@example.com'], ['phone', 'Phone', '+65 8123 4567'],
      ['linkedin', 'LinkedIn', 'linkedin.com/in/jordan-lee'], ['location', 'Location', 'Singapore'],
    ]);
  });
  it('an empty or missing field is listed with empty text, so it can be filled in', () => {
    const d = base(); d.contact.phone = ''; delete d.contact.location;
    expect(listContactFields(d).filter(f => !f.text).map(f => f.ref.field)).toEqual(['phone', 'location']);
  });
  it('bad data gives the five fields with empty text, never a throw', () => {
    expect(listContactFields(null)).toHaveLength(5);
    expect(listContactFields({ contact: 'x' }).every(f => f.text === '')).toBe(true);
  });
});

describe('listEducationFields', () => {
  it('lists the school and the degree of each entry that has something in it, with the id of the entry', () => {
    expect(listEducationFields(base()).map(f => [f.ref.id, f.ref.field, f.label, f.group, f.text])).toEqual([
      [21, 'institution', 'School', 'Example University', 'Example University'], [21, 'degree', 'Degree', 'Example University', 'BSc Business'],
      [22, 'institution', 'School', 'Diploma', ''], [22, 'degree', 'Degree', 'Diploma', 'Diploma'],
    ]);
  });
  it('leaves out an entry that is completely blank; an entry with no id is addressable by its place for this visit', () => {
    const d = base(); delete d.education[0].id;
    const l = listEducationFields(d);
    expect(l.some(f => f.ref.id === 23)).toBe(false);
    expect(l[0].ref.id).toBe('i0');
  });
  it('two entries with the same id are both marked ambiguous', () => {
    const d = base(); d.education[1].id = 21;
    expect(listEducationFields(d).every(f => f.ambiguous)).toBe(true);
  });
  it('bad data gives an empty list', () => {
    expect(listEducationFields(null)).toEqual([]);
    expect(listEducationFields({ education: 'x' })).toEqual([]);
  });
});

describe('fieldFindings: only what code can see', () => {
  const item = (kind, field, text) => ({ ref: kind === 'contact' ? { kind, field } : { kind, id: 1, field }, text });
  it('a missing value', () => {
    for (const [k, f] of [['contact', 'name'], ['contact', 'email'], ['contact', 'phone'], ['contact', 'linkedin'], ['contact', 'location'], ['edu', 'institution'], ['edu', 'degree']]) {
      expect(fieldFindings(item(k, f, '  ')), `${k}.${f}`).toEqual(['missing']);
    }
  });
  it('an email that is not shaped like one', () => {
    expect(fieldFindings(item('contact', 'email', 'jordan.lee@example.com'))).toEqual([]);
    expect(fieldFindings(item('contact', 'email', 'jordan.lee at example.com'))).toEqual(['not_email']);
    expect(fieldFindings(item('contact', 'email', 'jordan@example'))).toEqual(['not_email']);
  });
  it('a phone number with too few or too many digits (spaces, plus and dashes are fine)', () => {
    expect(fieldFindings(item('contact', 'phone', '+65 8123-4567'))).toEqual([]);
    expect(fieldFindings(item('contact', 'phone', '8123'))).toEqual(['phone_digits']);
    expect(fieldFindings(item('contact', 'phone', '1234567890123456789'))).toEqual(['phone_digits']);
  });
  it('a LinkedIn address that is not one', () => {
    expect(fieldFindings(item('contact', 'linkedin', 'https://www.linkedin.com/in/jordan-lee'))).toEqual([]);
    expect(fieldFindings(item('contact', 'linkedin', 'linkedin.com/in/jordan-lee'))).toEqual([]);
    expect(fieldFindings(item('contact', 'linkedin', 'my profile'))).toEqual(['not_linkedin']);
  });
  it('a name, a place, a school or a degree is never judged', () => {
    expect(fieldFindings(item('contact', 'name', 'x'))).toEqual([]);
    expect(fieldFindings(item('edu', 'degree', 'whatever'))).toEqual([]);
    expect(fieldFindings(null)).toEqual(['missing']);
  });
});

describe('setField', () => {
  it('writes exactly the one contact field and leaves everything else as it was; the input is not changed', () => {
    const d = base(); const snap = JSON.stringify(d);
    const r = setField(d, { kind: 'contact', field: 'phone' }, '  +65  9000 0000 ');
    expect(r.data.contact.phone).toBe('+65 9000 0000');
    expect(r.data.contact.email).toBe(d.contact.email);
    expect(r.data.education).toEqual(d.education);
    expect(JSON.stringify(d)).toBe(snap);
    expect(r.record).toEqual({ kind: 'fields', changes: [{ ref: { kind: 'contact', field: 'phone' }, before: '+65 8123 4567', after: '+65 9000 0000' }] });
  });
  it('writes the school or the degree of the entry that has the id, even when the list was reordered', () => {
    const d = base(); d.education.reverse();
    const r = setField(d, { kind: 'edu', id: 21, field: 'degree' }, 'BSc Economics');
    expect(r.data.education.find(e => e.id === 21).degree).toBe('BSc Economics');
    expect(r.data.education.find(e => e.id === 22).degree).toBe('Diploma');
    expect(r.data.education.find(e => e.id === 21).institution).toBe('Example University');
  });
  it('a contact field that does not exist yet is created by writing it', () => {
    const d = base(); delete d.contact.location;
    expect(setField(d, { kind: 'contact', field: 'location' }, 'Hanoi').data.contact.location).toBe('Hanoi');
  });
  it('refuses with a clear reason and does not touch the data', () => {
    expect(setField(base(), { kind: 'contact', field: 'phone' }, '   ')).toEqual({ error: 'empty' });
    expect(setField(base(), { kind: 'edu', id: 99, field: 'degree' }, 'x')).toEqual({ error: 'not_found' });
    expect(setField(base(), { kind: 'contact', field: 'phone' }, '+65 8123 4567')).toEqual({ error: 'unchanged' });
    expect(setField(base(), { kind: 'contact', field: 'shoe_size' }, '42')).toEqual({ error: 'not_found' });
    expect(setField(base(), { kind: 'edu', id: 21, field: 'year' }, '2018')).toEqual({ error: 'not_found' });   // the year belongs to the Dates card
    expect(setField(null, { kind: 'contact', field: 'phone' }, '1')).toEqual({ error: 'no_data' });
    const d = base(); d.education[1].id = 21;
    expect(setField(d, { kind: 'edu', id: 21, field: 'degree' }, 'x')).toEqual({ error: 'ambiguous' });
  });
});

describe('mergeFieldRecords, fieldsStatus and undoFields', () => {
  const ch = (field, before, after) => ({ ref: { kind: 'contact', field }, before, after });
  const rec = (...c) => ({ kind: 'fields', changes: c });
  it('the same field changed twice keeps the first before and the last after; going back cancels', () => {
    expect(mergeFieldRecords(rec(ch('phone', 'a', 'b')), rec(ch('phone', 'b', 'c')))).toEqual(rec(ch('phone', 'a', 'c')));
    expect(mergeFieldRecords(rec(ch('phone', 'a', 'b')), rec(ch('phone', 'b', 'a')))).toEqual(rec());
    expect(mergeFieldRecords(null, rec(ch('email', 'x', 'y')))).toEqual(rec(ch('email', 'x', 'y')));
    expect(mergeFieldRecords(rec(ch('email', 'x', 'y')), null)).toEqual(rec(ch('email', 'x', 'y')));
  });
  const done = () => setField(base(), { kind: 'contact', field: 'phone' }, '+65 9000 0000');
  it('status: open without a record, applied while as saved, applied_edited after a change or when the data is gone', () => {
    const r = done();
    expect(fieldsStatus(base(), null)).toBe('open');
    expect(fieldsStatus(r.data, r.record)).toBe('applied');
    expect(fieldsStatus(setField(r.data, { kind: 'contact', field: 'phone' }, '1').data, r.record)).toBe('applied_edited');
    expect(fieldsStatus(null, r.record)).toBe('applied_edited');
  });
  it('undo puts the value back (even a missing one) and refuses (null) when it was edited afterwards or the data is bad', () => {
    const d = base(); d.contact.phone = '';
    const r = setField(d, { kind: 'contact', field: 'phone' }, '+65 9000 0000');
    expect(undoFields(r.data, r.record).contact.phone).toBe('');
    expect(undoFields(setField(r.data, { kind: 'contact', field: 'phone' }, '1').data, r.record)).toBeNull();
    expect(undoFields(null, r.record)).toBeNull();
    expect(undoFields(r.data, { kind: 'dates', changes: [] })).toBeNull();
  });
  it('a change to an education field is read and undone by id', () => {
    const r = setField(base(), { kind: 'edu', id: 22, field: 'institution' }, 'City College');
    expect(fieldsStatus(r.data, r.record)).toBe('applied');
    expect(undoFields(r.data, r.record).education[1].institution).toBe('');
    const gone = { ...r.data, education: r.data.education.filter(e => e.id !== 22) };
    expect(fieldsStatus(gone, r.record)).toBe('applied_edited');
  });
});
