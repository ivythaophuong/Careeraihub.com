import { describe, it, expect, beforeEach } from 'vitest';
import { nextStep, TIMED_SECONDS, loadTimedTried, markTimedTried } from './guidance';
import { STEP_COPY, OPTIONS_COPY } from './guidanceCopy';

beforeEach(() => localStorage.clear());

describe('nextStep: one next step with a reason, from the person\'s own activity', () => {
  it('after an untimed round, suggests the timed challenge', () => {
    expect(nextStep({ challenge: 'untimed', answered: 4, skipped: 1, finishedBefore: 0, timedTried: false }).id).toBe('timed');
  });

  it('after a timed round, suggests another timed round', () => {
    expect(nextStep({ challenge: 'timed', answered: 5, skipped: 0, finishedBefore: 2, timedTried: true }).id).toBe('again_timed');
  });

  it('suggests going back to untimed, in neutral words, when most questions were skipped', () => {
    expect(nextStep({ challenge: 'timed', answered: 1, skipped: 4, finishedBefore: 1, timedTried: true }).id).toBe('again_untimed');
    expect(nextStep({ challenge: 'untimed', answered: 0, skipped: 5, finishedBefore: 0, timedTried: false }).id).toBe('again_untimed');
  });

  it('never looks at an AI score: the inputs carry none', () => {
    const step = nextStep({ challenge: 'untimed', answered: 3, skipped: 0, finishedBefore: 0, timedTried: false, avgScore: 12, score: 12 });
    expect(step.id).toBe('timed');
  });

  it('gives each step a title, a reason and a button label', () => {
    for (const id of ['timed', 'again_timed', 'again_untimed']) {
      const c = STEP_COPY[id];
      expect(c.heading && c.reason && c.primaryLabel).toBeTruthy();
    }
  });

  it('uses the owner\'s default of 3 minutes per question', () => { expect(TIMED_SECONDS).toBe(180); });
});

describe('the wording', () => {
  const all = JSON.stringify({ STEP_COPY, OPTIONS_COPY });
  it('is guidance, never a grade, a rank or a lock', () => {
    expect(all).not.toMatch(/\b(rank|tier|badge|unlock|locked|level up|level \d|achieved|failed|not good enough|you are not ready|behind)\b/i);
  });
  it('offers the four ways forward', () => {
    expect(OPTIONS_COPY.review).toMatch(/Review my feedback first/);
    expect(OPTIONS_COPY.ownPace).toMatch(/Continue at my own pace/);
    expect(OPTIONS_COPY.preview).toMatch(/Preview next step/);
  });
  it('says plainly that voice and full simulation are not available yet', () => {
    expect(OPTIONS_COPY.previewText).toMatch(/not available yet/i);
  });
});

describe('what the device remembers', () => {
  it('remembers on this device that a timed round was finished', () => {
    expect(loadTimedTried('u1')).toBe(false);
    markTimedTried('u1');
    expect(loadTimedTried('u1')).toBe(true);
    expect(loadTimedTried('u2')).toBe(false);
  });
});
