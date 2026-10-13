// The four stages of the guided journey (design: docs/architecture/plans/DESIGN-guided-journey.md). Pure functions from where the user is, no screen.
// The strip says "you are here" and "visited"; it never says a stage is done, because the product does not keep whether an issue was left aside or whether a
// file was downloaded, and a guess about the resume is not allowed.
import { describe, it, expect } from 'vitest';
import { STAGES, journeyStage, addVisited, stageStates } from './journey.js';

describe('STAGES', () => {
  it('are four, in order, with plain names', () => {
    expect(STAGES.map(s => [s.id, s.label])).toEqual([
      [1, 'Add your resume'], [2, 'See what to improve'], [3, 'Improve'], [4, 'Choose a layout and download'],
    ]);
  });
  it('use none of the words the product does not allow', () => {
    for (const s of STAGES) expect(s.label).not.toMatch(/auto-?fix|real-?time|apply automatically|fix all|optimi[sz]ed|done|complete|score/i);
  });
});

describe('journeyStage: where the user is', () => {
  it('the resume tab is stage 1 until a profile is loaded, then stage 2', () => {
    expect(journeyStage({ tab: 'parse', hasProfile: false })).toBe(1);
    expect(journeyStage({ tab: 'parse', hasProfile: true })).toBe(2);
  });
  it('the Builder tab and the Fix page are stage 3, whatever the profile', () => {
    expect(journeyStage({ tab: 'builder', hasProfile: false })).toBe(3);
    expect(journeyStage({ tab: 'builder', hasProfile: true })).toBe(3);
    expect(journeyStage({ tab: 'parse', hasProfile: true, fixOpen: true })).toBe(3);
  });
  it('the Templates tab and the Version History tab are stage 4', () => {
    expect(journeyStage({ tab: 'templates', hasProfile: true })).toBe(4);
    expect(journeyStage({ tab: 'history', hasProfile: false })).toBe(4);
  });
  it('the Fix page wins over the tab it is shown in', () => {
    expect(journeyStage({ tab: 'templates', fixOpen: true })).toBe(3);
  });
  it('nothing or something unknown is read as the first tab, and never throws', () => {
    expect(journeyStage()).toBe(1);
    expect(journeyStage({})).toBe(1);
    expect(journeyStage({ tab: 'nope', hasProfile: true })).toBe(2);
    expect(journeyStage(null)).toBe(1);
    expect(journeyStage({ tab: 7, hasProfile: 'yes' })).toBe(2);
  });
});

describe('addVisited: the stages the user has been in during this visit', () => {
  it('adds a stage once, keeps the list sorted and does not change the list it was given', () => {
    const v = [3];
    expect(addVisited(v, 1)).toEqual([1, 3]);
    expect(addVisited([1, 3], 3)).toEqual([1, 3]);
    expect(v).toEqual([3]);
  });
  it('ignores a stage that is not 1 to 4, and bad input', () => {
    expect(addVisited([1], 0)).toEqual([1]);
    expect(addVisited([1], 5)).toEqual([1]);
    expect(addVisited([1], '2')).toEqual([1]);
    expect(addVisited(null, 2)).toEqual([2]);
    expect(addVisited(undefined, undefined)).toEqual([]);
    expect(addVisited([9, 2, 2, 'x'], 1)).toEqual([1, 2]);
  });
});

describe('stageStates: what the strip shows for each stage', () => {
  it('marks the stage the user is in as "here", the ones visited as "visited", the others as "other"', () => {
    expect(stageStates(3, [1, 2, 3]).map(s => [s.id, s.state])).toEqual([[1, 'visited'], [2, 'visited'], [3, 'here'], [4, 'other']]);
    expect(stageStates(1, []).map(s => s.state)).toEqual(['here', 'other', 'other', 'other']);
  });
  it('a stage that was visited and is the current one is "here", and a stage ahead that was visited stays "visited"', () => {
    expect(stageStates(2, [1, 2, 4]).map(s => s.state)).toEqual(['visited', 'here', 'other', 'visited']);
  });
  it('each stage carries its label and its number of four, for a screen reader ("step 2 of 4")', () => {
    const s = stageStates(2, [])[1];
    expect(s).toMatchObject({ id: 2, label: 'See what to improve', position: 'Step 2 of 4' });
  });
  it('never says a stage is done or complete, whatever it is given', () => {
    for (const cur of [1, 2, 3, 4, 0, 9, undefined]) for (const s of stageStates(cur, [1, 2, 3, 4])) expect(['here', 'visited', 'other']).toContain(s.state);
  });
  it('a current stage outside 1 to 4 means no stage is "here"', () => {
    expect(stageStates(0, [2]).map(s => s.state)).toEqual(['other', 'visited', 'other', 'other']);
  });
});
