// @vitest-environment jsdom
// The Overview tab shows what the user has DONE (counts), named as counts, with a next step taken from their real state.
// It must not turn counts into skill scores, rank a "weakest" skill, lock modules that are open, or promise sessions or minutes.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../HiringManagerSim/HiringManagerSim', () => ({ default: () => <div>STUB-HIRING-MANAGER-SIM</div> }));
vi.mock('../STARBuilder/STARBuilder', () => ({ default: () => <div>STUB-STAR-BUILDER</div> }));
vi.mock('../WeaknessRadar/WeaknessRadar', () => ({ default: () => <div>STUB-WEAKNESS-RADAR</div> }));
vi.mock('../ReadinessScore/ReadinessScore', () => ({ default: () => <div>STUB-READINESS</div> }));
vi.mock('../MemoryDashboard/MemoryDashboard', () => ({ default: () => <div>STUB-MEMORY</div> }));
import InterviewCoach from './InterviewCoach';

afterEach(cleanup);
const mount = (memory = {}, setActiveModule = vi.fn()) => { render(<InterviewCoach memory={memory} setActiveModule={setActiveModule} />); return setActiveModule; };
const text = () => document.body.textContent;
const session = (n, over = {}) => ({ id: n, date: '2026-10-05T09:00:00.000Z', avgScore: 70, questionsCount: 5, ...over });

const STATES = {
  'a new user': {},
  'sessions only': { mockSessions: [session(1), session(2)] },
  'stories only': { starBank: [{}, {}, {}] },
  'sessions and stories': { resumeText: 'x'.repeat(40), mockSessions: [session(1, { avgScore: 40 })], starBank: [{}, {}] },
  'an old scan result is stored': { scanHistory: [{ result: { summary: 'old' }, score: 90 }], mockSessions: [session(1)] },
};

describe('the Overview names counts as counts and makes no claim it cannot back', () => {
  it.each(Object.entries(STATES))('%s: no skill scores, grades, locks, durations or session targets', (_n, memory) => {
    mount(memory);
    const t = text();
    expect(t).not.toMatch(/Concrete examples|STAR structure|Clarity|Overall readiness|Least practised|readiness plan/i);
    expect(t).not.toMatch(/Priority 1|Weakest|\bStrong\b|In progress|\bDone\b|Gap\b/);
    expect(t).not.toMatch(/Unlocks? at|\bLocked\b|\bUnlocked\b|unlock/i);
    expect(t).not.toMatch(/maintenance|hold score|session \d+ of \d+|\d+ min\b|targets your weakest|weakest dimension/i);
    expect(t).not.toMatch(/\d+\s*\/\s*100/);
  });

  it('says plainly that the numbers count activity and do not measure answer quality', () => {
    mount({});
    expect(text()).toMatch(/count what you have done/i);
    expect(text()).toMatch(/do not measure how well you answer/i);
  });
});

describe('the count cards', () => {
  it('show the real counts from memory', () => {
    mount({ mockSessions: [session(1, { questionsCount: 5 }), session(2, { questionsCount: 4 }), session(3, { questionsCount: 5 })], starBank: Array(7).fill({}) });
    const cards = Object.fromEntries(Array.from(document.querySelectorAll('[data-count]')).map((e) => [e.getAttribute('data-count'), e.textContent]));
    expect(cards['mock-interviews']).toBe('3');
    expect(cards['questions-answered']).toBe('14');
    expect(cards['star-stories']).toBe('7');
  });

  it('show zero as zero (no activity is a known fact, not missing data)', () => {
    mount({});
    expect(document.querySelector('[data-count="mock-interviews"]').textContent).toBe('0');
    expect(document.querySelector('[data-count="star-stories"]').textContent).toBe('0');
  });

  it('ignore a session whose question count is not a number instead of inventing one', () => {
    mount({ mockSessions: [session(1, { questionsCount: 5 }), session(2, { questionsCount: undefined }), session(3, { questionsCount: null })] });
    expect(document.querySelector('[data-count="questions-answered"]').textContent).toBe('5');
  });

  it('say when the user last practised, from the newest session, or that there is none', () => {
    mount({ mockSessions: [session(1, { date: '2026-10-05T09:00:00.000Z' })] });
    expect(document.querySelector('[data-count="last-practised"]').textContent).toMatch(/2026/);
    cleanup();
    mount({});
    expect(document.querySelector('[data-count="last-practised"]').textContent).toMatch(/No session yet/i);
  });

  it('do not use the stored scan result: it has no live writer', () => {
    mount({ scanHistory: [{ result: { summary: 'old' }, score: 90 }] });
    expect(document.querySelector('[data-count="mock-interviews"]').textContent).toBe('0');
    expect(text()).not.toMatch(/90|scan/i);
  });
});

describe('What to do next', () => {
  it('a new user is asked to add a resume, and the button opens the Resume Builder', () => {
    const setActiveModule = mount({});
    const card = screen.getByRole('region', { name: /what to do next/i });
    fireEvent.click(card.querySelector('button'));
    expect(setActiveModule).toHaveBeenCalledWith('ats');
  });

  it('with a resume and no practice: the mock interview button opens the Live Session tab, the STAR button opens the STAR Bank tab', () => {
    mount({ resumeText: 'x'.repeat(40) });
    const card = screen.getByRole('region', { name: /what to do next/i });
    expect(card.textContent).toMatch(/No mock interview yet/i);
    expect(card.textContent).toMatch(/0 of 5 STAR stories/i);
    fireEvent.click(Array.from(card.querySelectorAll('button')).find((b) => /mock interview/i.test(b.textContent)));
    expect(screen.getByText('STUB-HIRING-MANAGER-SIM')).toBeTruthy();
    cleanup();
    mount({ resumeText: 'x'.repeat(40) });
    fireEvent.click(Array.from(screen.getByRole('region', { name: /what to do next/i }).querySelectorAll('button')).find((b) => /STAR/i.test(b.textContent)));
    expect(screen.getByText('STUB-STAR-BUILDER')).toBeTruthy();
  });

  it('the interview average, when named, is called an AI estimate', () => {
    mount({ resumeText: 'x'.repeat(40), mockSessions: [session(1, { avgScore: 60 })], starBank: Array(5).fill({}) });
    const card = screen.getByRole('region', { name: /what to do next/i });
    expect(card.textContent).toMatch(/60%/);
    expect(card.textContent).toMatch(/AI estimate/i);
  });

  it('once the interview steps are done, the next step is the Career Roadmap (this tab does not load the practice score)', () => {
    const setActiveModule = mount({ resumeText: 'x'.repeat(40), mockSessions: [session(1, { avgScore: 80 })], starBank: Array(5).fill({}), skillsGap: { result: {} } });
    const card = screen.getByRole('region', { name: /what to do next/i });
    fireEvent.click(Array.from(card.querySelectorAll('button')).find((b) => /roadmap/i.test(b.textContent)));
    expect(setActiveModule).toHaveBeenCalledWith('roadmap');
  });
});

describe('what is not touched', () => {
  it('the Study Modules and Live Session tabs still render the same screen, and the tab strip is unchanged', () => {
    mount({});
    for (const label of ['Overview', 'Study Modules', 'Live Session', 'Weakness Radar', 'STAR Bank', 'AI Memory']) expect(screen.getByRole('button', { name: label })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Study Modules' }));
    expect(screen.getByText('STUB-HIRING-MANAGER-SIM')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Live Session' }));
    expect(screen.getByText('STUB-HIRING-MANAGER-SIM')).toBeTruthy();
  });
});
