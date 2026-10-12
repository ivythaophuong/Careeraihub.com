import { describe, it, expect } from 'vitest';
import { nextActions } from './roadmapNext.js';

const base = { hasResume: true, sessionsCount: 0, readiness: 0, starCount: 0, hasSkillsGap: false, trustScore: 0, trustVisible: false };
const mods = (r) => r.items.map(i => i.module);

describe('nextActions: what to do next, from the user\'s real state only', () => {
  it('a new user is asked to add a resume, nothing else', () => {
    const r = nextActions({ ...base, hasResume: false });
    expect(r.step).toBe(1);
    expect(mods(r)).toEqual(['ats']);
  });

  it('with a resume but no practice: mock interview and STAR stories, with the real counts', () => {
    const r = nextActions(base);
    expect(r.step).toBe(2);
    expect(mods(r)).toEqual(['simulate', 'star']);
    expect(r.items[0].text).toMatch(/no mock interview yet/i);
    expect(r.items[1].text).toMatch(/0 of 5 STAR stories/i);
  });

  it('names the latest mock interview average and what is still missing', () => {
    const r = nextActions({ ...base, sessionsCount: 2, readiness: 60, starCount: 3 });
    expect(r.items[0].text).toMatch(/60%/);
    expect(r.items[0].text).toMatch(/75/);
    expect(r.items[1].text).toMatch(/3 of 5 STAR stories/i);
  });

  it('only lists the part that is missing: enough stories, interview average too low', () => {
    const r = nextActions({ ...base, sessionsCount: 1, readiness: 70, starCount: 6 });
    expect(mods(r)).toEqual(['simulate']);
  });

  it('only lists STAR stories when the interview average is already at the target', () => {
    const r = nextActions({ ...base, sessionsCount: 1, readiness: 80, starCount: 2 });
    expect(mods(r)).toEqual(['star']);
  });

  it('skills gap done but no interview practice: the next action is interview practice, not skills gap', () => {
    const r = nextActions({ ...base, hasSkillsGap: true });
    expect(r.step).toBe(2);
    expect(mods(r)).toContain('simulate');
    expect(mods(r)).not.toContain('skillsgap');
  });

  it('interview ready, skills gap not run: skills gap', () => {
    const r = nextActions({ ...base, sessionsCount: 3, readiness: 80, starCount: 5 });
    expect(r.step).toBe(3);
    expect(mods(r)).toEqual(['skillsgap']);
  });

  it('then the practice score, with the real number', () => {
    const r = nextActions({ ...base, sessionsCount: 3, readiness: 80, starCount: 5, hasSkillsGap: true, trustScore: 40 });
    expect(r.step).toBe(4);
    expect(r.items[0].text).toMatch(/40/);
    expect(mods(r)).toEqual(['simulate']);
  });

  it('then TrustMatch', () => {
    const r = nextActions({ ...base, sessionsCount: 3, readiness: 80, starCount: 5, hasSkillsGap: true, trustScore: 70 });
    expect(r.step).toBe(5);
    expect(mods(r)).toEqual(['trustmatch']);
  });

  it('when everything is done there is nothing to do and no button', () => {
    const r = nextActions({ ...base, sessionsCount: 3, readiness: 80, starCount: 5, hasSkillsGap: true, trustScore: 70, trustVisible: true });
    expect(r.allDone).toBe(true);
    expect(r.items).toEqual([]);
  });

  it('never contains a duration or a promise', () => {
    for (const s of [base, { ...base, hasResume: false }, { ...base, sessionsCount: 2, readiness: 60, starCount: 3 }]) {
      const text = JSON.stringify(nextActions(s));
      expect(text).not.toMatch(/week|day|month|offer|certificate|unlock/i);
    }
  });

  it('calls the interview average an AI estimate', () => {
    const r = nextActions({ ...base, sessionsCount: 2, readiness: 60, starCount: 3 });
    expect(r.items[0].text).toMatch(/AI estimate/i);
  });

  it('when the practice score is not available (null), after the interview and skills gap steps it points to the Career Roadmap instead of inventing a number', () => {
    const r = nextActions({ ...base, sessionsCount: 3, readiness: 80, starCount: 5, hasSkillsGap: true, trustScore: null });
    expect(r.step).toBe(4);
    expect(r.items.map(i => i.module)).toEqual(['roadmap']);
    expect(JSON.stringify(r)).not.toMatch(/null|NaN|undefined/);
  });
});
