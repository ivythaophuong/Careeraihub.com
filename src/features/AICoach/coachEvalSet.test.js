// @vitest-environment node
// The evaluation set (tests/fixtures/coach-eval) must really exercise the history window: an early fact is outside what the coach is sent at the
// recall turn, a recent one is inside. Run through the real request builder with placeholder replies (the set contains no model output).
import { describe, it, expect } from 'vitest';
import set from '../../../tests/fixtures/coach-eval/conversations.json';
import { buildCoachRequest } from './coachRequest.js';

const historyBefore = (turns, recallTurn) => {
  const h = [{ role: 'assistant', content: 'Hi! I am your coach.' }];
  for (let t = 0; t < recallTurn - 1; t++) { h.push({ role: 'user', content: turns[t] }); h.push({ role: 'assistant', content: 'Here is some advice for that.' }); }
  return h;
};

describe('coach evaluation set', () => {
  it('has 20 synthetic conversations of 13 user turns, half planting the fact early and half recently', () => {
    expect(set.synthetic).toBe(true);
    expect(set.conversations).toHaveLength(20);
    expect(set.conversations.every((c) => c.userTurns.length === 13)).toBe(true);
    expect(set.conversations.filter((c) => c.kind === 'early_fact_far_recall')).toHaveLength(10);
    expect(set.conversations.filter((c) => c.kind === 'recent_fact_near_recall')).toHaveLength(10);
  });

  it('an early fact is NOT in what the coach is sent at the recall turn (this is the risk being measured)', () => {
    for (const c of set.conversations.filter((x) => x.kind === 'early_fact_far_recall')) {
      const r = buildCoachRequest({ systemPrompt: 'ctx', history: historyBefore(c.userTurns, c.recallAtUserTurn), content: c.userTurns[c.recallAtUserTurn - 1] });
      expect(r.messages.some((m) => m.content === c.userTurns[c.plantedAtUserTurn - 1]), c.id).toBe(false);
      expect(r.dropped, c.id).toBeGreaterThan(0);
    }
  });

  it('a recent fact IS in what the coach is sent (the control)', () => {
    for (const c of set.conversations.filter((x) => x.kind === 'recent_fact_near_recall')) {
      const r = buildCoachRequest({ systemPrompt: 'ctx', history: historyBefore(c.userTurns, c.recallAtUserTurn), content: c.userTurns[c.recallAtUserTurn - 1] });
      expect(r.messages.some((m) => m.content === c.userTurns[c.plantedAtUserTurn - 1]), c.id).toBe(true);
    }
  });

  it('contains no email address, phone number or other personal data', () => {
    const text = JSON.stringify(set);
    expect(text).not.toMatch(/@|\+?\d[\d\s-]{8,}\d/);
  });
});
