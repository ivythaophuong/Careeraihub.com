// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseUsageLines, summarise } from './usageReport.js';
import { buildEvent } from './usage.js';

const ev = (o) => buildEvent({ correlationId: 'c1', feature: 'scan_jd_match', userRef: 'u1', provider: 'gemini', model: 'm', attempt: 1, fallback: false, outcome: 'success', durationMs: 100, usage: { input: 100, output: 50, thinking: null, total: 150 }, ...o });
const line = (e) => `2026-10-10T10:00:00Z  info  [usage] ${JSON.stringify(e)}`;

describe('usage report', () => {
  it('reads only usage lines and counts the unreadable ones', () => {
    const text = ['[ai] answered by gemini', line(ev({})), '[usage] {not json', '[usage] {"event":"other"}', 'booted'].join('\n');
    const r = parseUsageLines(text);
    expect(r.events).toHaveLength(1);
    expect(r.skipped).toBe(2);
  });
  it('sums tokens per feature and keeps unreported usage out of the averages', () => {
    const events = [ev({}), ev({ correlationId: 'c2' }), ev({ correlationId: 'c3', usage: null }), ev({ feature: 'ats_builder_parse', correlationId: 'c4' })];
    const rows = Object.fromEntries(summarise(events).map((r) => [r.feature, r]));
    expect(rows.scan_jd_match).toMatchObject({ requests: 3, successes: 3, inputTokens: 200, outputTokens: 100, avgInputTokens: 100, usageReported: 2, usageUnavailable: 1 });
    expect(rows.ats_builder_parse.requests).toBe(1);
  });
  it('a failed attempt plus a fallback is one request with two attempts', () => {
    const rows = summarise([ev({ outcome: 'error', errorKind: 'upstream', httpStatus: 429, usage: null }), ev({ attempt: 2, fallback: true, provider: 'groq' })]);
    expect(rows[0]).toMatchObject({ requests: 1, attempts: 2, errors: 1, successes: 1, fallbackAnswers: 1 });
  });
  it('cost stays unknown (null) without a price entry; it is never summed from nothing', () => {
    const rows = summarise([ev({}), ev({ correlationId: 'c2' })]);
    expect(rows[0].costUsd).toBeNull();
    expect(rows[0].callsWithoutCost).toBe(2);
  });
  it('adds up computed costs when entries exist', () => {
    const table = { version: '1', entries: [{ provider: 'gemini', model: 'm', effective_from: '2026-01-01', effective_to: null, input_per_million_usd: 1, output_per_million_usd: 2, thinking_billed_as: 'output', free_tier: false }] };
    const rows = summarise([ev({ priceTable: table }), ev({ correlationId: 'c2', priceTable: table })]);
    expect(rows[0].costedCalls).toBe(2);
    expect(rows[0].costUsd).toBeCloseTo(2 * (100 * 1 + 50 * 2) / 1e6, 10);
  });
});
