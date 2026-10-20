// When voice practice is offered: after one timed round with most questions answered. Kept on this device only, like the timed marker.
import { describe, it, expect, beforeEach } from 'vitest';
import { earnedVoice, loadVoiceUnlocked, markVoiceUnlocked, VOICE_UNLOCK_SHARE } from './guidance';

beforeEach(() => localStorage.clear());

describe('earnedVoice', () => {
  it('needs a timed round with at least 4 of 5 questions answered', () => {
    expect(earnedVoice({ challenge: 'timed', answered: 5, total: 5 })).toBe(true);
    expect(earnedVoice({ challenge: 'timed', answered: 4, total: 5 })).toBe(true);
    expect(earnedVoice({ challenge: 'timed', answered: 3, total: 5 })).toBe(false);
    expect(earnedVoice({ challenge: 'timed', answered: 0, total: 5 })).toBe(false);
  });
  it('an untimed round does not count, however many questions are answered', () => {
    expect(earnedVoice({ challenge: 'untimed', answered: 5, total: 5 })).toBe(false);
  });
  it('scales to a shorter round (3 to 5 questions can come back) and rounds up', () => {
    expect(VOICE_UNLOCK_SHARE).toBe(0.8);
    expect(earnedVoice({ challenge: 'timed', answered: 3, total: 3 })).toBe(true);
    expect(earnedVoice({ challenge: 'timed', answered: 2, total: 3 })).toBe(false);
    expect(earnedVoice({ challenge: 'timed', answered: 4, total: 4 })).toBe(true);
    expect(earnedVoice({ challenge: 'timed', answered: 3, total: 4 })).toBe(false);
  });
  it('is false for missing or odd input, never an error', () => {
    for (const v of [undefined, null, {}, { challenge: 'timed' }, { challenge: 'timed', answered: NaN, total: 5 }, { challenge: 'timed', answered: 5, total: 0 }, { challenge: 'timed', answered: -1, total: 5 }]) {
      expect(earnedVoice(v)).toBe(false);
    }
  });
});

describe('the unlock marker', () => {
  it('is off until marked, then on for that user only', () => {
    expect(loadVoiceUnlocked('u1')).toBe(false);
    markVoiceUnlocked('u1');
    expect(loadVoiceUnlocked('u1')).toBe(true);
    expect(loadVoiceUnlocked('u2')).toBe(false);
  });
  it('survives storage that throws: off, never an error', () => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    try { expect(loadVoiceUnlocked('u1')).toBe(false); } finally { Storage.prototype.getItem = orig; }
    const origSet = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('blocked'); };
    try { expect(() => markVoiceUnlocked('u1')).not.toThrow(); } finally { Storage.prototype.setItem = origSet; }
  });
});
