// The logic behind the Fix page (no screen): where an issue's text is, what the draft would put there, saving one field, and the status of each issue.
import { describe, it, expect } from 'vitest';
import { fixTargets, suggestionFor, saveFix, issueStatus, nextUnresolved, firstUnresolved, summaryCounts, issueKey, fieldText, withFieldText, closestBullets, undoRecord } from './fixPage.js';
import { addSkill, removeSkill } from './skillsFix.js';
import { setDate } from './datesFix.js';
import { setField } from './fieldsFix.js';
import { undoApply } from './applyIssue.js';

const base = () => ({
  contact: { name: 'Jordan Lee', email: 'jordan.lee@example.com', phone: '', linkedin: '', location: 'Singapore' },
  summary: 'Analyst who builds weekly reports.',
  experience: [
    { id: 1, company: 'Acme', title: 'Analyst', period: '2021 - 2023', bullets: ['Handled monthly reporting for the sales team', 'Built a dashboard for 6 managers', 'Trained two new hires'] },
    { id: 2, company: '', title: 'Intern', period: '2020', bullets: ['Filed paperwork'] },
    { id: 3, company: 'Beta', title: 'Lead', period: '2023 - now', bullets: ['Trained two new hires'] },
  ],
  education: [], skills: ['SQL'], awards: [], extras: [],
});
const issue = (over = {}) => ({ severity: 'high', title: 'No metrics in bullets', description: 'Add numbers.', before: 'Handled monthly reporting', after: 'Cut monthly reporting time by 30%', builderStep: 2, module: null, ...over });

describe('fixTargets: where the issue\'s text is', () => {
  it('one place: the bullet, with a readable label, drawn in the preview', () => {
    const t = fixTargets(base(), issue());
    expect(t.kind).toBe('one');
    expect(t.places).toHaveLength(1);
    expect(t.places[0]).toMatchObject({ at: { kind: 'bullet', exp: 0, bullet: 0 }, drawn: true });
    expect(t.places[0].label).toMatch(/Acme/);
  });

  it('several places: the user has to choose, nothing is picked', () => {
    const t = fixTargets(base(), issue({ before: 'Trained two new hires' }));
    expect(t.kind).toBe('many');
    expect(t.places.map(p => p.at)).toEqual([{ kind: 'bullet', exp: 0, bullet: 2 }, { kind: 'bullet', exp: 2, bullet: 0 }]);
  });

  it('not found: no place, and nothing is guessed', () => {
    expect(fixTargets(base(), issue({ before: 'Something the resume never said' }))).toMatchObject({ kind: 'none', places: [] });
  });

  it('an issue with no quoted text cannot be placed', () => {
    expect(fixTargets(base(), issue({ before: '' })).kind).toBe('no_before');
    expect(fixTargets(base(), issue({ before: undefined })).kind).toBe('no_before');
  });

  it('the summary is a place, and it is drawn', () => {
    const t = fixTargets(base(), issue({ before: 'builds weekly reports' }));
    expect(t.places[0]).toMatchObject({ at: { kind: 'summary' }, drawn: true });
  });

  it('a bullet of a job with no company name is found but is not drawn in the preview', () => {
    const t = fixTargets(base(), issue({ before: 'Filed paperwork' }));
    expect(t.kind).toBe('one');
    expect(t.places[0].drawn).toBe(false);
  });

  it('ignores curly quotes, dash kinds and spacing in the quote, as the Builder does', () => {
    const d = base(); d.experience[0].bullets[1] = 'Built a dashboard — for 6 managers';
    expect(fixTargets(d, issue({ before: 'Built a dashboard - for 6   managers' })).kind).toBe('one');
  });
});

describe('suggestionFor: what the draft would put in that field', () => {
  it('replaces only the quoted words and keeps the rest of the bullet', () => {
    const s = suggestionFor(base(), issue({ after: 'Cut reporting time for the sales team' }), { kind: 'bullet', exp: 0, bullet: 0 });
    expect(s.text).toBe('Cut reporting time for the sales team for the sales team');
  });

  it('a figure the resume does not have becomes [X], with a note, never the AI\'s number', () => {
    const s = suggestionFor(base(), issue(), { kind: 'bullet', exp: 0, bullet: 0 });
    expect(s.text).toContain('[X]');
    expect(s.text).not.toContain('30%');
    expect(s.placeholders).toBe(true);
  });

  it('a figure the resume already has is kept', () => {
    const s = suggestionFor(base(), issue({ before: 'Built a dashboard', after: 'Built a dashboard used by 6 managers' }), { kind: 'bullet', exp: 0, bullet: 1 });
    expect(s.text).toContain('6 managers');
    expect(s.placeholders).toBe(false);
  });

  it('with one place the place need not be given; with several it must be', () => {
    expect(suggestionFor(base(), issue({ after: 'Reporting, cut' })).text).toMatch(/Reporting, cut/);
    expect(suggestionFor(base(), issue({ before: 'Trained two new hires', after: 'Coached two new hires' })).error).toBe('not_found');
  });

  it('no draft, or text that is gone: an error, not a guess', () => {
    expect(suggestionFor(base(), issue({ after: '' }), { kind: 'bullet', exp: 0, bullet: 0 }).error).toBe('empty_after');
    expect(suggestionFor(base(), issue({ before: 'Never written' }), { kind: 'bullet', exp: 0, bullet: 0 }).error).toBe('not_found');
  });

  it('does not change the data it is given', () => {
    const d = base(); const copy = JSON.stringify(d);
    suggestionFor(d, issue(), { kind: 'bullet', exp: 0, bullet: 0 });
    expect(JSON.stringify(d)).toBe(copy);
  });
});

describe('saveFix: saving what the user wrote in one field', () => {
  const at = { kind: 'bullet', exp: 0, bullet: 0 };

  it('writes only that field and leaves everything else exactly as it was', () => {
    const d = base();
    const r = saveFix(d, at, 'Cut monthly reporting time for the sales team');
    const expected = base(); expected.experience[0].bullets[0] = 'Cut monthly reporting time for the sales team';
    expect(r.data).toEqual(expected);
    expect(JSON.stringify(d)).toBe(JSON.stringify(base()));
  });

  it('writes the summary too', () => {
    const r = saveFix(base(), { kind: 'summary' }, 'Analyst focused on reporting.');
    expect(r.data.summary).toBe('Analyst focused on reporting.');
    expect(r.data.experience).toEqual(base().experience);
  });

  it('returns a record that Undo understands and that restores the original text', () => {
    const r = saveFix(base(), at, 'Cut monthly reporting time for the sales team');
    expect(undoApply(r.data, r.record)).toEqual(base());
  });

  it('an empty or blank text is refused: it would delete the bullet silently', () => {
    expect(saveFix(base(), at, '   ').error).toBe('empty');
    expect(saveFix(base(), at, '').error).toBe('empty');
  });

  it('a place that does not exist is refused', () => {
    expect(saveFix(base(), { kind: 'bullet', exp: 9, bullet: 0 }, 'x').error).toBe('not_found');
    expect(saveFix(base(), { kind: 'bullet', exp: 0, bullet: 9 }, 'x').error).toBe('not_found');
  });

  it('says how many [X] blanks are left in what was saved', () => {
    expect(saveFix(base(), at, 'Cut reporting time by [X]%').blanks).toBe(1);
    expect(saveFix(base(), at, 'Cut reporting time').blanks).toBe(0);
  });
});

describe('issueStatus: read from the text now, never "resolved"', () => {
  const at = { kind: 'bullet', exp: 0, bullet: 0 };

  it('open: nothing applied and the quoted text is still there', () => {
    expect(issueStatus(base(), issue(), null)).toBe('open');
  });

  it('changed by you: nothing applied but the quoted text is gone', () => {
    const d = base(); d.experience[0].bullets[0] = 'Something else';
    expect(issueStatus(d, issue(), null)).toBe('changed');
  });

  it('applied: saved, and the saved text is still there', () => {
    const r = saveFix(base(), at, 'Cut monthly reporting time for the sales team');
    expect(issueStatus(r.data, issue(), r.record)).toBe('applied');
  });

  it('applied, then edited by you: the saved text was changed afterwards', () => {
    const r = saveFix(base(), at, 'Cut monthly reporting time for the sales team');
    const d = JSON.parse(JSON.stringify(r.data)); d.experience[0].bullets[0] = 'Reporting, my way';
    expect(issueStatus(d, issue(), r.record)).toBe('applied_edited');
  });

  it('needs a figure: saved but a [X] blank is still in the text, so it stays open', () => {
    const r = saveFix(base(), at, 'Cut monthly reporting time by [X]%');
    expect(issueStatus(r.data, issue(), r.record)).toBe('needs_figure');
  });

  it('an issue with no quoted text is open until the user says otherwise', () => {
    expect(issueStatus(base(), issue({ before: '' }), null)).toBe('open');
  });
});

describe('moving between issues', () => {
  const s = ['applied', 'open', 'applied', 'needs_figure', 'changed'];
  it('the next unresolved issue after this one, or null at the end', () => {
    expect(nextUnresolved(s, 0)).toBe(1);
    expect(nextUnresolved(s, 1)).toBe(3);
    expect(nextUnresolved(s, 3)).toBe(4);
    expect(nextUnresolved(s, 4)).toBeNull();
  });
  it('the first unresolved issue, or null when everything is applied', () => {
    expect(firstUnresolved(s)).toBe(1);
    expect(firstUnresolved(['applied', 'applied'])).toBeNull();
    expect(firstUnresolved([])).toBeNull();
  });
  it('a skipped issue stays unresolved', () => {
    expect(nextUnresolved(['open', 'open'], 0)).toBe(1);
    expect(firstUnresolved(['open', 'open'])).toBe(0);
  });
});

describe('summaryCounts: counts of what is, never "all fixed"', () => {
  it('counts each kind, and a needed figure counts as open', () => {
    expect(summaryCounts(['applied', 'applied_edited', 'open', 'needs_figure', 'changed', 'applied']))
      .toEqual({ total: 6, applied: 2, open: 2, changedByYou: 2 });
  });
  it('an empty list is all zero', () => {
    expect(summaryCounts([])).toEqual({ total: 0, applied: 0, open: 0, changedByYou: 0 });
  });
  it('has no field that says everything is fixed or resolved', () => {
    expect(Object.keys(summaryCounts(['applied']))).not.toContain('resolved');
    expect(Object.keys(summaryCounts(['applied']))).not.toContain('allFixed');
  });
});

describe('issueKey: the same key the Suggestions panel keeps its records under', () => {
  it('is the position, the title and the quoted text', () => {
    expect(issueKey({ title: 'No metrics', before: 'Handled monthly reporting' }, 2)).toBe('2:No metrics:Handled monthly reporting');
    expect(issueKey({}, 0)).toBe('0::');
  });
});

describe('fieldText and withFieldText: reading a field and previewing a typed text without saving it', () => {
  const at = { kind: 'bullet', exp: 0, bullet: 1 };
  it('reads the summary and a bullet; a place that does not exist reads as empty', () => {
    expect(fieldText(base(), { kind: 'summary' })).toBe('Analyst who builds weekly reports.');
    expect(fieldText(base(), at)).toBe('Built a dashboard for 6 managers');
    expect(fieldText(base(), { kind: 'bullet', exp: 9, bullet: 0 })).toBe('');
  });
  it('returns a copy with that field replaced, the rest unchanged, and leaves the input alone', () => {
    const d = base(); const copy = JSON.stringify(d);
    const p = withFieldText(d, at, 'Typed but not saved');
    expect(p.experience[0].bullets[1]).toBe('Typed but not saved');
    expect(p.experience[0].bullets[0]).toBe(d.experience[0].bullets[0]);
    expect(p.summary).toBe(d.summary);
    expect(JSON.stringify(d)).toBe(copy);
  });
  it('a place that does not exist gives the data back unchanged', () => {
    expect(withFieldText(base(), { kind: 'bullet', exp: 9, bullet: 0 }, 'x')).toEqual(base());
  });
});

describe('closestBullets: the sentences nearest to a quote that is not in the resume', () => {
  const d = () => ({
    summary: 'Analyst who builds weekly reports.',
    experience: [
      { id: 1, company: 'Acme', title: 'Analyst', period: '2021 - 2023', bullets: ['Analyzed financial and operational data of target companies in 15+ M&A transactions using SQL', 'Built a dashboard for 6 managers', 'Trained two new hires'] },
      { id: 2, company: 'Beta', title: 'Lead', period: '2023 - now', bullets: ['Analyzed operational data of target companies for the board'] },
    ],
  });
  const quote = 'Analyzed financial and operational data of target companies in 15+ M&A deals';

  it('lists the bullets that share most of the quote\'s words, best first, with a score from 0 to 1', () => {
    const r = closestBullets(d(), { before: quote });
    expect(r.map(x => x.at)).toEqual([{ kind: 'bullet', exp: 0, bullet: 0 }, { kind: 'bullet', exp: 1, bullet: 0 }]);
    expect(r[0].score).toBeGreaterThan(r[1].score);
    expect(r[0].score).toBeLessThanOrEqual(1);
  });

  it('leaves out bullets that share less than half the words', () => {
    const r = closestBullets(d(), { before: quote });
    expect(r.some(x => x.at.bullet === 2)).toBe(false);
  });

  it('gives nothing when there is no quote, or nothing is close', () => {
    expect(closestBullets(d(), { before: '' })).toEqual([]);
    expect(closestBullets(d(), { before: undefined })).toEqual([]);
    expect(closestBullets(d(), { before: 'Completely unrelated text about gardening' })).toEqual([]);
  });

  it('never looks in the summary, and gives at most three', () => {
    const x = d(); x.experience[0].bullets = ['alpha beta gamma delta', 'alpha beta gamma delta one', 'alpha beta gamma delta two', 'alpha beta gamma delta three', 'alpha beta gamma delta four'];
    const r = closestBullets(x, { before: 'alpha beta gamma delta' });
    expect(r).toHaveLength(3);
    expect(closestBullets({ ...d(), summary: 'Analyzed financial and operational data of target companies' }, { before: 'summary only words nothing else' })).toEqual([]);
  });

  it('does not change the data', () => {
    const x = d(); const copy = JSON.stringify(x);
    closestBullets(x, { before: quote });
    expect(JSON.stringify(x)).toBe(copy);
  });
});

describe('a Skills change in the same records as a sentence change', () => {
  it('issueStatus reads a skills record from the list as it is now', () => {
    const a = addSkill(base(), 'Power BI');
    expect(issueStatus(a.data, issue({ before: '' }), a.record)).toBe('applied');
    expect(issueStatus(removeSkill(a.data, 'Power BI').data, issue({ before: '' }), a.record)).toBe('applied_edited');
  });
  it('undoRecord takes either kind of change back, and gives null when it was edited afterwards', () => {
    const a = addSkill(base(), 'Power BI');
    expect(undoRecord(a.data, a.record).skills).toEqual(['SQL']);
    const s = saveFix(base(), { kind: 'summary' }, 'A new summary.');
    expect(undoRecord(s.data, s.record).summary).toBe(base().summary);
    expect(undoRecord(removeSkill(a.data, 'Power BI').data, a.record)).toBeNull();
    expect(undoRecord(base(), null)).toBeNull();
  });
});

describe('a Dates change in the same records', () => {
  const withIds = () => { const d = base(); d.experience.forEach((j, i) => { j.id = 10 + i; }); return d; };
  it('issueStatus reads a dates record from the date as it is now', () => {
    const r = setDate(withIds(), { kind: 'job', id: 10 }, '2020 - 2022');
    expect(issueStatus(r.data, issue({ before: '' }), r.record)).toBe('applied');
    expect(issueStatus(setDate(r.data, { kind: 'job', id: 10 }, '2019').data, issue({ before: '' }), r.record)).toBe('applied_edited');
  });
  it('undoRecord takes a dates change back, and gives null when it was edited afterwards', () => {
    const r = setDate(withIds(), { kind: 'job', id: 10 }, '2020 - 2022');
    expect(undoRecord(r.data, r.record).experience[0].period).toBe('2021 - 2023');
    expect(undoRecord(setDate(r.data, { kind: 'job', id: 10 }, '2019').data, r.record)).toBeNull();
  });
});

describe('a contact or education change in the same records', () => {
  it('issueStatus reads a fields record from the value as it is now', () => {
    const r = setField(base(), { kind: 'contact', field: 'phone' }, '+65 9000 0000');
    expect(issueStatus(r.data, issue({ before: '' }), r.record)).toBe('applied');
    expect(issueStatus(setField(r.data, { kind: 'contact', field: 'phone' }, '1').data, issue({ before: '' }), r.record)).toBe('applied_edited');
  });
  it('undoRecord takes a fields change back, and gives null when it was edited afterwards', () => {
    const r = setField(base(), { kind: 'contact', field: 'phone' }, '+65 9000 0000');
    expect(undoRecord(r.data, r.record).contact.phone).toBe(base().contact.phone);
    expect(undoRecord(setField(r.data, { kind: 'contact', field: 'phone' }, '1').data, r.record)).toBeNull();
  });
});

describe('a blank the models write counts as unfinished, like [X]', () => {
  const at = { kind: 'bullet', exp: 0, bullet: 0 };
  it('saveFix counts [number] as a blank', () => {
    expect(saveFix(base(), at, 'Cut reporting time by [number]%').blanks).toBe(1);
    expect(saveFix(base(), at, 'Cut reporting time in [City, Region]').blanks).toBe(1);
  });
});
