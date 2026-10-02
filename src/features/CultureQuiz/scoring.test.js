import { describe, it, expect } from 'vitest';
import { AXES, QUESTIONS } from './questions';
import { PERSONAS } from './personas';
import { scoreAnswers, topTwoAxes, personaFor, bandFor, isComplete } from './scoring';

const answerAll = (value) => Object.fromEntries(QUESTIONS.map((q) => [q.id, value]));

describe('question design', () => {
  it('has 10 questions covering every pair of axes exactly once', () => {
    const pairs = QUESTIONS.map((q) => [q.a.axis, q.b.axis].sort().join('+'));
    expect(QUESTIONS).toHaveLength(10);
    expect(new Set(pairs).size).toBe(10);
  });

  it('has a persona for every pair of axes', () => {
    const keys = [];
    for (let i = 0; i < AXES.length; i++)
      for (let j = i + 1; j < AXES.length; j++) keys.push(`${AXES[i]}+${AXES[j]}`);
    expect(keys.sort()).toEqual(Object.keys(PERSONAS).sort());
  });
});

describe('scoreAnswers', () => {
  it('scores 0 to 100 per axis', () => {
    for (const v of [2, 1, -1, -2]) {
      const s = scoreAnswers(answerAll(v));
      for (const axis of AXES) {
        expect(s[axis]).toBeGreaterThanOrEqual(0);
        expect(s[axis]).toBeLessThanOrEqual(100);
      }
    }
  });

  it('gives 100 to an axis chosen strongly every time it appears', () => {
    // Pick the option for "pace" strongly in every question that contains it.
    const answers = {};
    for (const q of QUESTIONS) {
      if (q.a.axis === 'pace') answers[q.id] = 2;
      else if (q.b.axis === 'pace') answers[q.id] = -2;
      else answers[q.id] = 1;
    }
    expect(scoreAnswers(answers).pace).toBe(100);
  });

  it('adds points only to the chosen side', () => {
    const q = QUESTIONS[0]; // innovation vs structure
    const s = scoreAnswers({ [q.id]: 2 });
    expect(s.innovation).toBe(25);
    expect(s.structure).toBe(0);
  });
});

describe('persona selection', () => {
  it('picks the top two axes in axis order', () => {
    expect(topTwoAxes({ innovation: 10, autonomy: 90, collaboration: 20, structure: 30, pace: 80 }))
      .toEqual(['autonomy', 'pace']);
  });

  it('breaks ties by axis order', () => {
    const tie = { innovation: 50, autonomy: 50, collaboration: 50, structure: 50, pace: 50 };
    expect(topTwoAxes(tie)).toEqual(['innovation', 'autonomy']);
  });

  it('returns a persona for any complete set of answers', () => {
    for (const v of [2, 1, -1, -2]) {
      const p = personaFor(scoreAnswers(answerAll(v)));
      expect(p?.name).toBeTruthy();
    }
  });

  it('maps autonomy + pace to Startup Navigator', () => {
    expect(personaFor({ innovation: 10, autonomy: 90, collaboration: 20, structure: 30, pace: 80 }).name)
      .toBe('Startup Navigator');
  });
});

describe('helpers', () => {
  it('classifies score bands', () => {
    expect(bandFor(75)).toBe('high');
    expect(bandFor(50)).toBe('mid');
    expect(bandFor(25)).toBe('low');
  });

  it('knows when the quiz is complete', () => {
    expect(isComplete({})).toBe(false);
    expect(isComplete(answerAll(1))).toBe(true);
  });
});
