// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import fixture from '../fixtures/star-variance/stories.json';
import { runVariance, formatReport } from '../../scripts/audit/starVariance.mjs';
import { MIN_FIELD_CHARS, MAX_FIELD_CHARS, SECTIONS } from '../../supabase/functions/_shared/starScoring.js';

const ok = (b, s = 200) => new Response(JSON.stringify(b), { status: s });
// A stand-in for the provider: it replies in Anthropic's shape with scores taken from a function of (call number), so spread is known.
function stubFetch(scoreFor, { failCalls = [] } = {}) {
  let call = 0;
  const f = async (url) => {
    if (String(url).includes('/auth/v1/user')) return ok({ id: 'local-run' });
    call++;
    if (failCalls.includes(call)) return new Response('busy', { status: 500 });
    const s = scoreFor(call);
    const reply = { scores: { situation: s, task: s, action: s, result: s }, refined: { situation: 'a', task: 'b', action: 'c', result: 'd' }, oneLiner: 'x', feedback: ['y'], missingDetails: [], competencies: ['z'] };
    return ok({ content: [{ type: 'text', text: JSON.stringify(reply) }], stop_reason: 'end_turn', usage: { input_tokens: 700, output_tokens: 300 } });
  };
  f.calls = () => call;
  return f;
}
const ENV = { ANTHROPIC_API_KEY: 'sk-ant-test-not-real', AI_PROVIDER: 'anthropic', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' };
const two = { ...fixture, stories: fixture.stories.slice(0, 2) };

describe('the story set', () => {
  it('has ten synthetic stories with unique ids, every field inside the limits the server enforces', () => {
    expect(fixture.synthetic).toBe(true);
    expect(fixture.stories).toHaveLength(10);
    expect(new Set(fixture.stories.map((s) => s.id)).size).toBe(10);
    for (const s of fixture.stories) for (const k of SECTIONS) {
      expect(s.story[k].length, `${s.id}.${k}`).toBeGreaterThanOrEqual(MIN_FIELD_CHARS);
      expect(s.story[k].length, `${s.id}.${k}`).toBeLessThanOrEqual(MAX_FIELD_CHARS);
    }
  });
  it('covers a spread of writing: minimal, vague, team-heavy, no result, specific, with figures, padded', () => {
    const t = fixture.stories.map((s) => s.intended).join(' | ');
    for (const w of [/bare minimum/, /vague/, /team credit/, /no outcome/, /no metric/, /with figures/, /padded/]) expect(t).toMatch(w);
  });
  it('contains no email address, phone number or link', () => {
    expect(JSON.stringify(fixture)).not.toMatch(/@|https?:|www\.|\+?\d[\d\s-]{8,}\d/);
  });
});

describe('runVariance (the real score-star handler, a stand-in provider)', () => {
  it('reviews every story the requested number of times through the real handler and records the scores code computed', async () => {
    const fetchImpl = stubFetch(() => 60);
    const res = await runVariance({ env: ENV, fetchImpl, stories: two.stories, runs: 3, delayMs: 0 });
    expect(fetchImpl.calls()).toBe(6);
    expect(res.runs).toHaveLength(6);
    expect(res.runs.every((r) => r.ok && r.overall === 60 && r.scores.action === 60)).toBe(true);
    expect(res.summary.stories).toHaveLength(2);
  });

  it('records what was actually used: provider, model, code version, prompt hash, parameters', async () => {
    const res = await runVariance({ env: ENV, fetchImpl: stubFetch(() => 60), stories: two.stories, runs: 1, delayMs: 0 });
    expect(res.config.provider).toBe('anthropic');
    expect(res.config.model).toMatch(/claude/);
    expect(res.config.maxTokens).toBeGreaterThan(0);
    expect(res.config.promptHashes[two.stories[0].id]).toMatch(/^[0-9a-f]{64}$/);
    expect(res.config.promptHashes[two.stories[0].id]).not.toBe(res.config.promptHashes[two.stories[1].id]);
    expect(res.config.nodeVersion).toMatch(/^v\d+/);
    expect(res.config.temperature).toMatch(/provider default/i);
    expect(res.runs[0].usage).toMatchObject({ input_tokens: 700, output_tokens: 300 });
  });

  it('a call that fails is recorded as a failure, never as a score, and the run goes on', async () => {
    const res = await runVariance({ env: ENV, fetchImpl: stubFetch(() => 60, { failCalls: [2] }), stories: two.stories, runs: 2, delayMs: 0 });
    expect(res.runs.filter((r) => !r.ok)).toHaveLength(1);
    expect(res.summary.totalFailures).toBe(1);
    expect(res.runs.filter((r) => r.ok).every((r) => Number.isFinite(r.overall))).toBe(true);
  });

  it('measures real spread: scores that move are reported as spread', async () => {
    const res = await runVariance({ env: ENV, fetchImpl: stubFetch((n) => 40 + (n % 2) * 20), stories: two.stories.slice(0, 1), runs: 4, delayMs: 0 });
    const o = res.summary.stories[0].overall;
    expect(o.range).toBe(20);
    expect(o.sd).toBeGreaterThan(0);
  });

  it('refuses to run when more than one provider has a key, because a fallback could mix models inside one measurement', async () => {
    await expect(runVariance({ env: { ...ENV, GEMINI_API_KEY: 'g-test' }, fetchImpl: stubFetch(() => 60), stories: two.stories, runs: 1, delayMs: 0 }))
      .rejects.toThrow(/more than one provider/i);
  });

  it('refuses to run with no provider key', async () => {
    await expect(runVariance({ env: { SUPABASE_URL: 'https://x', SUPABASE_ANON_KEY: 'a' }, fetchImpl: stubFetch(() => 60), stories: two.stories, runs: 1, delayMs: 0 }))
      .rejects.toThrow(/no provider key/i);
  });

  it('never puts a key in the result', async () => {
    const res = await runVariance({ env: ENV, fetchImpl: stubFetch(() => 60), stories: two.stories, runs: 1, delayMs: 0 });
    expect(JSON.stringify(res)).not.toMatch(/sk-ant|test-not-real/);
  });
});

describe('the report printed at the end', () => {
  it('names the provider and model used, the failures, one row per story, and says it measures stability not accuracy', async () => {
    const res = await runVariance({ env: ENV, fetchImpl: stubFetch((n) => 50 + (n % 3) * 5), stories: two.stories, runs: 3, delayMs: 0 });
    const text = formatReport(res, '/tmp/out.json');
    expect(text).toMatch(/Provider anthropic, model claude/);
    expect(text).toMatch(/0 failed of 6/);
    for (const s of two.stories) expect(text).toContain(s.id);
    expect(text).toMatch(/stability/i);
    expect(text).toContain('/tmp/out.json');
    expect(text).not.toMatch(/NaN|undefined|null/);
  });

  it('says so when a fallback provider was used, because that mixes models', async () => {
    const res = await runVariance({ env: ENV, fetchImpl: stubFetch(() => 60), stories: two.stories, runs: 1, delayMs: 0 });
    res.config.fallbackUsed = true;
    expect(formatReport(res, 'x')).toMatch(/FALLBACK provider was used/);
  });
});
