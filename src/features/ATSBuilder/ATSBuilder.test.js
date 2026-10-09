import { describe, it, expect } from 'vitest';
import {
  computeLineDiff,
  sortGapsBySeverity,
  buildRebuildPrompt,
  moveCardPure,
  arrayBufferToBase64,
  SEVERITY_ORDER,
} from './atsBuilderUtils.js';

// ── computeLineDiff ────────────────────────────────────────────────────────────
describe('computeLineDiff', () => {
  it('detects added lines', () => {
    const old = 'Led a team of 5 engineers\nBuilt a payment gateway';
    const next = 'Led a team of 5 engineers\nBuilt a payment gateway\nReduced latency by 40%';
    const diff = computeLineDiff(old, next);
    expect(diff.some(d => d.type === 'added' && d.text.includes('latency'))).toBe(true);
    expect(diff.every(d => d.type !== 'removed')).toBe(true);
  });

  it('detects removed lines', () => {
    const old = 'Responsible for team tasks\nManaged stakeholders\nDid various duties';
    const next = 'Managed 8-person team · 20% velocity gain\nManaged stakeholders';
    const diff = computeLineDiff(old, next);
    expect(diff.some(d => d.type === 'removed' && d.text.includes('Responsible'))).toBe(true);
    expect(diff.some(d => d.type === 'removed' && d.text.includes('duties'))).toBe(true);
  });

  it('returns empty array for identical texts', () => {
    const text = 'Senior Product Manager at Acme Corp\nLed cross-functional teams';
    expect(computeLineDiff(text, text)).toHaveLength(0);
  });

  it('ignores very short lines (≤4 chars)', () => {
    const old = 'ok\n--\nLed a team of engineers with measurable outcomes';
    const next = 'ok\n--\nLed a team of engineers with measurable outcomes\nAdded significant improvements';
    const diff = computeLineDiff(old, next);
    // short lines "ok" and "--" should not appear in diff
    expect(diff.every(d => d.text.length > 4)).toBe(true);
  });

  it('caps output at 50 entries', () => {
    const oldLines = Array.from({ length: 60 }, (_, i) => `Old line number ${i} with content`).join('\n');
    const newLines = Array.from({ length: 60 }, (_, i) => `New line number ${i} with content`).join('\n');
    expect(computeLineDiff(oldLines, newLines).length).toBeLessThanOrEqual(50);
  });

  it('each entry has type and text fields', () => {
    const diff = computeLineDiff('First old line here', 'First new line here');
    diff.forEach(d => {
      expect(d).toHaveProperty('type');
      expect(d).toHaveProperty('text');
      expect(['added', 'removed']).toContain(d.type);
    });
  });
});

// ── sortGapsBySeverity ─────────────────────────────────────────────────────────
describe('sortGapsBySeverity', () => {
  const gaps = [
    { id: 'g1', severity: 'low',      title: 'Minor formatting' },
    { id: 'g2', severity: 'critical', title: 'Missing keywords' },
    { id: 'g3', severity: 'medium',   title: 'Weak verbs' },
    { id: 'g4', severity: 'high',     title: 'No metrics' },
    { id: 'g5', severity: 'critical', title: 'No summary' },
  ];

  it('puts critical gaps first', () => {
    const sorted = sortGapsBySeverity(gaps);
    expect(sorted[0].severity).toBe('critical');
    expect(sorted[1].severity).toBe('critical');
  });

  it('ends with low severity', () => {
    const sorted = sortGapsBySeverity(gaps);
    expect(sorted[sorted.length - 1].severity).toBe('low');
  });

  it('orders correctly: critical → high → medium → low', () => {
    const sorted = sortGapsBySeverity(gaps);
    const severities = sorted.map(g => g.severity);
    const expectedOrder = ['critical', 'critical', 'high', 'medium', 'low'];
    expect(severities).toEqual(expectedOrder);
  });

  it('does not mutate the original array', () => {
    const original = [...gaps];
    sortGapsBySeverity(gaps);
    expect(gaps.map(g => g.id)).toEqual(original.map(g => g.id));
  });

  it('handles unknown severity as lowest priority', () => {
    const withUnknown = [
      { id: 'a', severity: 'unknown' },
      { id: 'b', severity: 'critical' },
    ];
    const sorted = sortGapsBySeverity(withUnknown);
    expect(sorted[0].severity).toBe('critical');
    expect(sorted[1].severity).toBe('unknown');
  });
});

// ── buildRebuildPrompt ─────────────────────────────────────────────────────────
describe('buildRebuildPrompt', () => {
  const resumeText = 'John Smith\nSenior PM at Acme Corp\nLed a team';

  const cards = [
    { title: 'Missing metrics', section: 'Work Experience', aiSuggestion: 'Add: increased revenue by 30%', userNotes: '' },
    { title: 'Weak summary', section: 'Summary', aiSuggestion: 'Rewrite with target role keywords', userNotes: 'Focus on fintech PM roles' },
  ];

  it('includes the original resume text', () => {
    const prompt = buildRebuildPrompt(resumeText, cards);
    expect(prompt).toContain('John Smith');
    expect(prompt).toContain('Senior PM at Acme Corp');
  });

  it('includes each card title and section', () => {
    const prompt = buildRebuildPrompt(resumeText, cards);
    expect(prompt).toContain('Missing metrics');
    expect(prompt).toContain('Work Experience');
    expect(prompt).toContain('Weak summary');
    expect(prompt).toContain('Summary');
  });

  it('includes AI suggestions', () => {
    const prompt = buildRebuildPrompt(resumeText, cards);
    expect(prompt).toContain('increased revenue by 30%');
    expect(prompt).toContain('target role keywords');
  });

  it('includes user notes when present', () => {
    const prompt = buildRebuildPrompt(resumeText, cards);
    expect(prompt).toContain('fintech PM roles');
  });

  it('omits user intent line when notes are empty', () => {
    const singleCard = [cards[0]]; // no userNotes
    const prompt = buildRebuildPrompt(resumeText, singleCard);
    expect(prompt).not.toContain('User intent');
  });

  it('numbers edits sequentially', () => {
    const prompt = buildRebuildPrompt(resumeText, cards);
    expect(prompt).toContain('1. Section:');
    expect(prompt).toContain('2. Section:');
  });

  it('handles empty done cards gracefully', () => {
    const prompt = buildRebuildPrompt(resumeText, []);
    expect(prompt).toContain('ORIGINAL RESUME:');
    expect(prompt).toContain('EDITS TO APPLY:');
  });
});

// ── moveCardPure (Kanban logic) ───────────────────────────────────────────────
describe('moveCardPure', () => {
  const card = { id: 'g1', title: 'Missing keywords', severity: 'critical' };

  const emptyState = { gapCards: [card], editCards: [], doneCards: [] };

  it('moves card from gaps to edit', () => {
    const next = moveCardPure(emptyState, card, 'gaps', 'edit', false);
    expect(next.gapCards).toHaveLength(0);
    expect(next.editCards).toContainEqual(card);
  });

  it('moves card from edit to done', () => {
    const state = { gapCards: [], editCards: [card], doneCards: [] };
    const next = moveCardPure(state, card, 'edit', 'done', false);
    expect(next.editCards).toHaveLength(0);
    expect(next.doneCards).toContainEqual(card);
  });

  it('moves card from done back to edit', () => {
    const state = { gapCards: [], editCards: [], doneCards: [card] };
    const next = moveCardPure(state, card, 'done', 'edit', false);
    expect(next.doneCards).toHaveLength(0);
    expect(next.editCards).toContainEqual(card);
  });

  // The pro gate was removed from ATS Builder (397b844): any number of cards can be moved to done.
  it('moves a third card to done without any limit', () => {
    const card2 = { id: 'g2', title: 'No metrics' };
    const card3 = { id: 'g3', title: 'Weak summary' };
    const state = { gapCards: [card3], editCards: [], doneCards: [card, card2] };
    const next = moveCardPure(state, card3, 'gaps', 'done');
    expect(next.doneCards).toHaveLength(3);
    expect(next.gapCards).toHaveLength(0);
  });

  it('does not duplicate card when moved', () => {
    const next = moveCardPure(emptyState, card, 'gaps', 'edit', false);
    const allIds = [...next.gapCards, ...next.editCards, ...next.doneCards].map(c => c.id);
    const unique = new Set(allIds);
    expect(unique.size).toBe(allIds.length);
  });
});

// ── arrayBufferToBase64 ────────────────────────────────────────────────────────
describe('arrayBufferToBase64', () => {
  it('converts a buffer to valid base64 string', () => {
    const text = 'Hello resume!';
    const encoder = new TextEncoder();
    const buffer = encoder.encode(text).buffer;
    const b64 = arrayBufferToBase64(buffer);
    expect(typeof b64).toBe('string');
    expect(b64.length).toBeGreaterThan(0);
    // Verify it round-trips correctly
    expect(atob(b64)).toBe(text);
  });

  it('handles empty buffer', () => {
    const buffer = new ArrayBuffer(0);
    expect(arrayBufferToBase64(buffer)).toBe('');
  });
});

// ── SEVERITY_ORDER ─────────────────────────────────────────────────────────────
describe('SEVERITY_ORDER', () => {
  it('critical has the lowest order number (highest priority)', () => {
    expect(SEVERITY_ORDER.critical).toBeLessThan(SEVERITY_ORDER.high);
    expect(SEVERITY_ORDER.high).toBeLessThan(SEVERITY_ORDER.medium);
    expect(SEVERITY_ORDER.medium).toBeLessThan(SEVERITY_ORDER.low);
  });
});

// ── buildScanRecord / validScore ───────────────────────────────────────────────
import { buildScanRecord, validScore } from './atsBuilderUtils.js';

describe('validScore', () => {
  it('keeps a real score, including a real 0', () => {
    expect(validScore(72)).toBe(72);
    expect(validScore(0)).toBe(0);
    expect(validScore(72.4)).toBe(72);
  });
  it.each([[undefined], [null], ['78'], [NaN], [Infinity], [-1], [101], [{}]])('treats %s as unknown (null), not 0', (v) => {
    expect(validScore(v)).toBeNull();
  });
});

describe('buildScanRecord', () => {
  const parsed = { atsScore: 64, parameters: { keywords: 50, impactMetrics: 40, formatting: 80, missingSections: 70, summaryHeadline: 60 }, gaps: [{ id: 'g1' }], summary: 's' };

  it('saves the score as given', () => {
    expect(buildScanRecord(parsed).row.credibility_score).toBe(64);
  });

  it('a missing score is saved as null, never as 0 (0 would count towards the trust score)', () => {
    for (const bad of [{ ...parsed, atsScore: undefined }, { ...parsed, atsScore: null }, { ...parsed, atsScore: 'high' }]) {
      const rec = buildScanRecord(bad);
      expect(rec.row.credibility_score).toBeNull();
      expect(rec.radarResult.credibilityScore).toBeNull();
      expect(rec.score).toBeNull();
    }
  });

  it('a real 0 stays 0', () => {
    expect(buildScanRecord({ ...parsed, atsScore: 0 }).row.credibility_score).toBe(0);
  });

  it('does not save the number of score parameters as "metrics found"', () => {
    const rec = buildScanRecord(parsed);
    expect(Object.keys(parsed.parameters)).toHaveLength(5);
    expect(rec.row.metrics_found).toBeNull();
    expect(rec.radarResult.metricsFound).toBeNull();
  });

  it('tolerates a result with no gaps or parameters', () => {
    const rec = buildScanRecord({ atsScore: 50 });
    expect(rec.row).toMatchObject({ credibility_score: 50, issues: [], questions: [], summary: '' });
  });

  it('history entry carries the same score and the result', () => {
    const rec = buildScanRecord(parsed, '2026-10-08T00:00:00.000Z');
    expect(rec.historyEntry(rec.radarResult)).toEqual({ score: 64, date: '2026-10-08T00:00:00.000Z', result: rec.radarResult });
  });
});
