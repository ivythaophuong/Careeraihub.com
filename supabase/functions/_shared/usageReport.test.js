// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseUsageLines, summarise, summariseVoice, VOICE_PRICES } from './usageReport.js';
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

// ── voice transcription (the transcribe function) ──────────────────────────────────────────────────────────────────────────────────────────────

const v = (over = {}) => ({ event: 'voice_usage', feature: 'voice_transcribe', provider: 'groq', audioSec: 60, outcome: 'success', ...over });
const lines = (...evs) => evs.map(e => `2026-10-20T10:00:00Z [usage] ${JSON.stringify(e)}`).join('\n');

describe('voice usage lines', () => {
  it('are read next to the ai usage lines and are not counted as unreadable', () => {
    const text = lines(v(), { event: 'ai_usage', feature: 'x', outcome: 'success' }, { event: 'something_else' });
    const r = parseUsageLines(text);
    expect(r.voiceEvents).toHaveLength(1);
    expect(r.events).toHaveLength(1);
    expect(r.skipped).toBe(1);
  });
  it('a malformed voice line is skipped, not an error', () => {
    const r = parseUsageLines('[usage] {"event":"voice_usage", broken');
    expect(r.voiceEvents).toHaveLength(0);
    expect(r.skipped).toBe(1);
  });
});

describe('summariseVoice', () => {
  it('sums the audio of successful answers and prices Groq by the hour', () => {
    const s = summariseVoice([v({ audioSec: 60 }), v({ audioSec: 120 }), v({ audioSec: 180 })]);
    expect(s.answers).toBe(3);
    expect(s.audioSeconds).toBe(360);
    expect(s.byProvider.groq.billedSeconds).toBe(360);
    expect(s.byProvider.groq.estUsd).toBeCloseTo(360 / 3600 * 0.04, 6); // 0.004
    expect(s.estUsd).toBeCloseTo(0.004, 6);
  });
  it('bills at least 10 seconds for a Groq request, and says so', () => {
    const s = summariseVoice([v({ audioSec: 2 }), v({ audioSec: 4 })]);
    expect(s.audioSeconds).toBe(6);
    expect(s.byProvider.groq.billedSeconds).toBe(20);
  });
  it('prices OpenAI by the minute, as a third-party estimate', () => {
    const s = summariseVoice([v({ provider: 'openai', audioSec: 120 })]);
    expect(s.byProvider.openai.estUsd).toBeCloseTo(0.006, 6);
    expect(VOICE_PRICES.openai.source).toMatch(/third-party/i);
  });
  it('counts answers that fell back to OpenAI after a failed Groq attempt', () => {
    const s = summariseVoice([v({ outcome: 'retry', status: 429 }), v({ provider: 'openai', audioSec: 60 })]);
    expect(s.fallbackAnswers).toBe(1);
    expect(s.failedAttempts).toEqual({ retry: 1, reject: 0 });
  });
  it('does not turn a missing length into zero: it is counted as unreported and left out of the money', () => {
    const s = summariseVoice([v({ audioSec: null }), v({ audioSec: 60 })]);
    expect(s.unreportedLength).toBe(1);
    expect(s.audioSeconds).toBe(60);
    expect(s.byProvider.groq.billedSeconds).toBe(60);
  });
  it('does not price an unknown provider', () => {
    const s = summariseVoice([v({ provider: 'mystery', audioSec: 60 })]);
    expect(s.byProvider.mystery.estUsd).toBeNull();
    expect(s.estUsd).toBe(0);
    expect(s.unpriced).toBe(1);
  });
  it('is empty and calm for no events', () => {
    const s = summariseVoice([]);
    expect(s).toMatchObject({ answers: 0, audioSeconds: 0, estUsd: 0, fallbackAnswers: 0 });
  });
  it('gives the average length and the average cost of an answer when there are answers', () => {
    const s = summariseVoice([v({ audioSec: 60 }), v({ audioSec: 120 })]);
    expect(s.avgSeconds).toBe(90);
    expect(s.avgUsd).toBeCloseTo(0.04 * 180 / 3600 / 2, 6);
    expect(summariseVoice([]).avgSeconds).toBeNull();
  });
});
