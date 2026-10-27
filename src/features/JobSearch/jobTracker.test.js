import { describe, it, expect } from 'vitest';
import {
  NO_REPLY_DAYS, stageOf, groupByStage, pipelineStats, applyStatus, nextStep, attentionList, followUpDraft, thankYouDraft,
  classifyPaste, makeApplication, buildJobURL, sourcesFor, daysSince, daysUntil, toDay, appliedOn, todayYmd,
} from './jobTracker';

const NOW = new Date(2026, 9, 27, 10, 0, 0); // 27 Oct 2026, local
const ago = (n) => todayYmd(new Date(2026, 9, 27 - n));
const ahead = (n) => todayYmd(new Date(2026, 9, 27 + n));

describe('dates', () => {
  it('reads plain dates and ISO timestamps, and nothing else', () => {
    expect(toDay('2026-10-01')).toBe('2026-10-01');
    expect(toDay('2026-10-01T08:00:00Z')).toBe('2026-10-01');
    expect(toDay('yesterday')).toBeNull();
    expect(toDay(undefined)).toBeNull();
  });
  it('counts calendar days', () => {
    expect(daysSince(ago(3), NOW)).toBe(3);
    expect(daysUntil(ahead(2), NOW)).toBe(2);
    expect(daysSince('bad', NOW)).toBeNull();
  });
  it('prefers appliedOn over the old date field', () => {
    expect(appliedOn({ date: '2026-01-01', appliedOn: '2026-02-02' })).toBe('2026-02-02');
    expect(appliedOn({ date: '2026-01-01T00:00:00Z' })).toBe('2026-01-01');
  });
});

describe('stageOf', () => {
  it('derives No reply from the age of an Applied job', () => {
    expect(stageOf({ status: 'Applied', date: ago(NO_REPLY_DAYS - 1) }, NOW)).toBe('applied');
    expect(stageOf({ status: 'Applied', date: ago(NO_REPLY_DAYS) }, NOW)).toBe('noreply');
  });
  it('maps every stored status, and treats an unknown one as Applied', () => {
    const d = ago(1);
    expect(['Saved', 'Follow-up', 'Interviewing', 'Offer', 'Rejected', 'Mystery'].map(status => stageOf({ status, date: d }, NOW)))
      .toEqual(['saved', 'noreply', 'interviewing', 'offer', 'closed', 'applied']);
  });
  it('puts a job with an unreadable date in Applied rather than crashing', () => {
    expect(stageOf({ status: 'Applied', date: 'n/a' }, NOW)).toBe('applied');
  });
  it('groups into all six columns', () => {
    const g = groupByStage([{ id: 1, status: 'Offer' }], NOW);
    expect(Object.keys(g)).toEqual(['saved', 'applied', 'noreply', 'interviewing', 'offer', 'closed']);
    expect(g.offer).toHaveLength(1);
  });
});

describe('pipelineStats', () => {
  it('counts only entered data and does not count Saved as applied', () => {
    const s = pipelineStats([
      { status: 'Saved' }, { status: 'Applied' }, { status: 'Follow-up' }, { status: 'Interviewing' },
      { status: 'Rejected', reachedInterview: true }, { status: 'Rejected' }, { status: 'Offer' },
    ]);
    expect(s).toEqual({ saved: 1, applied: 6, heardBack: 4, interviews: 3, offers: 1 });
  });
  it('is all zeros for no applications', () => {
    expect(pipelineStats(undefined)).toEqual({ saved: 0, applied: 0, heardBack: 0, interviews: 0, offers: 0 });
  });
});

describe('applyStatus', () => {
  it('stamps applied dates once, from Saved', () => {
    const a = applyStatus({ id: 1, status: 'Saved', date: ago(5) }, 'Applied', NOW);
    expect(a).toMatchObject({ status: 'Applied', appliedOn: ago(0), date: ago(0) });
  });
  it('does not rewrite the applied date when moving between later statuses', () => {
    const a = applyStatus({ id: 1, status: 'Applied', date: ago(9), appliedOn: ago(9) }, 'Interviewing', NOW);
    expect(a.appliedOn).toBe(ago(9));
    expect(a.reachedInterview).toBe(true);
  });
  it('keeps reachedInterview after a rejection', () => {
    const a = applyStatus(applyStatus({ id: 1, status: 'Applied', date: ago(3) }, 'Interviewing', NOW), 'Rejected', NOW);
    expect(a).toMatchObject({ status: 'Rejected', reachedInterview: true, closedOn: ago(0) });
  });
  it('records the follow-up date and leaves a same-status call untouched', () => {
    const base = { id: 1, status: 'Applied', date: ago(8) };
    expect(applyStatus(base, 'Follow-up', NOW).followedUpOn).toBe(ago(0));
    expect(applyStatus(base, 'Applied', NOW)).toBe(base);
  });
  it('moves a follow-up out of No reply when the user hears back', () => {
    const f = applyStatus({ id: 1, status: 'Applied', date: ago(9) }, 'Follow-up', NOW);
    expect(stageOf(f, NOW)).toBe('noreply');
    expect(stageOf(applyStatus(f, 'Interviewing', NOW), NOW)).toBe('interviewing');
  });
});

describe('nextStep', () => {
  it('Saved: check fit needs a description', () => {
    expect(nextStep({ status: 'Saved', date: ago(1) }, NOW).actions[0]).toMatchObject({ module: 'jd', needs: 'jd' });
  });
  it('No reply: offers a draft, and "I sent it" only before a follow-up', () => {
    const before = nextStep({ status: 'Applied', date: ago(9) }, NOW);
    expect(before.actions.map(a => a.id)).toEqual(['followup', 'followed']);
    const after = nextStep({ status: 'Follow-up', date: ago(9), followedUpOn: ago(1) }, NOW);
    expect(after.actions.map(a => a.id)).toEqual(['followup']);
  });
  it('Interviewing: a countdown, urgent within 3 days', () => {
    const s = nextStep({ status: 'Interviewing', interviewDate: ahead(2) }, NOW);
    expect(s.title).toBe('Interview in 2 days');
    expect(s.urgency).toBe('high');
    expect(nextStep({ status: 'Interviewing', interviewDate: ahead(10) }, NOW).urgency).toBe('medium');
    expect(nextStep({ status: 'Interviewing' }, NOW).title).toBe('Prepare for your interview');
  });
  it('Offer opens Salary Coach; closed opens practice', () => {
    expect(nextStep({ status: 'Offer' }, NOW).actions[0].module).toBe('salary');
    expect(nextStep({ status: 'Rejected' }, NOW).actions[0].module).toBe('simulate');
  });
});

describe('attentionList', () => {
  it('lists interviews, offers and no-reply jobs, most urgent first, never Saved or fresh Applied', () => {
    const list = attentionList([
      { id: 1, company: 'A', status: 'Saved', date: ago(1) },
      { id: 2, company: 'B', status: 'Applied', date: ago(2) },
      { id: 3, company: 'C', status: 'Applied', date: ago(10) },
      { id: 4, company: 'D', status: 'Interviewing', interviewDate: ahead(1) },
    ], NOW);
    expect(list.map(x => x.app.company)).toEqual(['D', 'C']);
  });
});

describe('drafts', () => {
  it('fill in the job and a placeholder name, with no invented facts', () => {
    const app = { company: 'Northwind', role: 'Product Manager', date: ago(9) };
    const f = followUpDraft(app);
    expect(f).toContain('Product Manager role at Northwind');
    expect(f).toContain(`on ${ago(9)}`);
    expect(f).toContain('[Your name]');
    expect(thankYouDraft(app, 'Sam')).toContain('Sam');
  });
});

describe('adding a job', () => {
  it('treats a lone link as the link and longer text as the description', () => {
    expect(classifyPaste(' https://example.com/j/1 ')).toEqual({ link: 'https://example.com/j/1', jd: '' });
    expect(classifyPaste('We are hiring')).toEqual({ link: '', jd: 'We are hiring' });
    expect(classifyPaste('')).toEqual({ link: '', jd: '' });
  });
  it('makes a Saved application, or an Applied one with its dates', () => {
    expect(makeApplication({ company: ' A ', role: 'PM' }, NOW)).toMatchObject({ company: 'A', status: 'Saved', savedOn: ago(0) });
    expect(makeApplication({ company: 'A', role: 'PM', status: 'Applied' }, NOW)).toMatchObject({ status: 'Applied', appliedOn: ago(0) });
  });
  it('caps a stored description', () => {
    expect(makeApplication({ company: 'A', role: 'PM', jd: 'x'.repeat(20000) }, NOW).jd).toHaveLength(6000);
  });
});

describe('job boards', () => {
  it('adds the freshness filter each board supports', () => {
    expect(buildJobURL('linkedin', 'Product Manager', 'Singapore', '', 3)).toContain('f_TPR=r259200');
    expect(buildJobURL('indeed', 'Product Manager', 'Singapore', '', 1)).toContain('fromage=1');
    expect(buildJobURL('glassdoor', 'PM', 'Singapore', '', 7)).toContain('fromAge=7');
    expect(buildJobURL('jobstreet', 'Product Manager', 'Singapore', '', 3)).toContain('daterange=3');
  });
  it('encodes what the user typed', () => {
    expect(buildJobURL('linkedin', 'C++ & Go', 'São Paulo', '', 3)).toContain('keywords=C%2B%2B%20%26%20Go');
  });
  it('offers region boards only in their region', () => {
    expect(sourcesFor('Singapore').map(s => s.id).slice(0, 2)).toEqual(['mycareersfuture', 'jobstreet']);
    expect(sourcesFor('Global').map(s => s.id)).toEqual(['linkedin', 'indeed', 'glassdoor', 'wellfound']);
    expect(sourcesFor('Southeast Asia').map(s => s.id)).toContain('jobstreet');
    expect(sourcesFor('Southeast Asia').map(s => s.id)).not.toContain('mycareersfuture');
  });
});
