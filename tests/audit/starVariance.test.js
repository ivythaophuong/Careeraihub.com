// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import fixture from '../fixtures/star-variance/stories.json';
import { runVariance, formatReport } from '../../scripts/audit/starVariance.mjs';
import { MIN_FIELD_CHARS, MAX_FIELD_CHARS, SECTIONS } from '../../supabase/functions/_shared/starScoring.js';

const ok = (b, s = 200) => new Response(JSON.stringify(b), { status: s });
// A stand-in for the provider: it replies in Anthropic's shape with scores taken from a function of (call number), so spread is known.
function stubFetch(scoreFor, { failCalls = [], failStatus = 500 } = {}) {
  let call = 0;
  const f = async (url) => {
    if (String(url).includes('/auth/v1/user')) return ok({ id: 'local-run' });
    call++;
    if (failCalls.includes(call)) return new Response('busy', { status: failStatus });
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

  it('a call that keeps failing is recorded as a failure, never as a score, and the run goes on', async () => {
    const res = await runVariance({ env: ENV, fetchImpl: stubFetch(() => 60, { failCalls: [2, 3, 4, 5] }), stories: two.stories, runs: 2, delayMs: 0, retryWaitMs: [0, 0, 0] });
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

describe('rate limits and transient errors (the first real run lost 32 of 50 calls to them)', () => {
  const wait = { delayMs: 0, retryWaitMs: [0, 0, 0] };

  it('a 429 is retried after a wait, and the call that finally succeeds is one observation (the retries are recorded, not counted as extra scores)', async () => {
    const fetchImpl = stubFetch(() => 60, { failCalls: [1, 2], failStatus: 429 });
    const res = await runVariance({ env: ENV, fetchImpl, stories: two.stories.slice(0, 1), runs: 1, ...wait });
    expect(res.runs).toHaveLength(1);
    expect(res.runs[0]).toMatchObject({ ok: true, overall: 60, retries: 2 });
    expect(res.summary.totalFailures).toBe(0);
  });

  it('a call that is still limited after the allowed retries is a failure, with the real reason recorded', async () => {
    const fetchImpl = stubFetch(() => 60, { failCalls: [1, 2, 3, 4], failStatus: 429 });
    const res = await runVariance({ env: ENV, fetchImpl, stories: two.stories.slice(0, 1), runs: 1, ...wait });
    expect(res.runs[0]).toMatchObject({ ok: false, status: 429, retries: 3, httpStatus: 429 });
    expect(res.runs[0].errorKind).toBeDefined();
  });

  it('a provider server error (502 from the handler) is retried too; a 422 (truncated or blocked answer) is NOT, because that is a result about the answer, not a hiccup', async () => {
    const r5 = await runVariance({ env: ENV, fetchImpl: stubFetch(() => 60, { failCalls: [1], failStatus: 503 }), stories: two.stories.slice(0, 1), runs: 1, ...wait });
    expect(r5.runs[0]).toMatchObject({ ok: true, retries: 1 });
    const truncated = async (url) => (String(url).includes('/auth/v1/user') ? ok({ id: 'x' }) : ok({ content: [{ type: 'text', text: '{"scores":' }], stop_reason: 'max_tokens' }));
    const r4 = await runVariance({ env: ENV, fetchImpl: truncated, stories: two.stories.slice(0, 1), runs: 1, ...wait });
    expect(r4.runs[0]).toMatchObject({ ok: false, status: 422, retries: 0 });
  });

  it('the report says how many calls were retried and why the failures failed', async () => {
    const fetchImpl = stubFetch(() => 60, { failCalls: [1, 2, 3, 4], failStatus: 429 });
    const res = await runVariance({ env: ENV, fetchImpl, stories: two.stories.slice(0, 1), runs: 1, ...wait });
    const text = formatReport(res, 'x');
    expect(text).toMatch(/429/);
    expect(text).toMatch(/retr/i);
  });
});

describe('resuming from an earlier results file', () => {
  const wait = { delayMs: 0, retryWaitMs: [0, 0, 0] };

  it('keeps the observations that already succeeded and only runs the missing (story, run) pairs', async () => {
    const first = await runVariance({ env: ENV, fetchImpl: stubFetch(() => 60, { failCalls: [3, 4, 5, 6], failStatus: 429 }), stories: two.stories, runs: 2, ...wait });
    const okBefore = first.runs.filter((r) => r.ok).length;
    expect(okBefore).toBeLessThan(4);
    const fetchImpl = stubFetch(() => 70);
    const second = await runVariance({ env: ENV, fetchImpl, stories: two.stories, runs: 2, previous: first, ...wait });
    expect(fetchImpl.calls()).toBe(4 - okBefore);
    expect(second.runs.filter((r) => r.ok)).toHaveLength(4);
    expect(second.runs.filter((r) => r.ok && r.overall === 60)).toHaveLength(okBefore); // the old ones are untouched
    expect(second.summary.totalFailures).toBe(0);
  });

  it('refuses to resume when the configuration changed: another model, another code or another prompt would mix two measurements', async () => {
    const first = await runVariance({ env: ENV, fetchImpl: stubFetch(() => 60), stories: two.stories, runs: 1, ...wait });
    const otherModel = JSON.parse(JSON.stringify(first)); otherModel.config.model = 'some-other-model';
    await expect(runVariance({ env: ENV, fetchImpl: stubFetch(() => 60), stories: two.stories, runs: 1, previous: otherModel, ...wait })).rejects.toThrow(/model/i);
    const otherPrompt = JSON.parse(JSON.stringify(first)); otherPrompt.config.promptHashes[two.stories[0].id] = 'f'.repeat(64);
    await expect(runVariance({ env: ENV, fetchImpl: stubFetch(() => 60), stories: two.stories, runs: 1, previous: otherPrompt, ...wait })).rejects.toThrow(/prompt/i);
  });

  it('nothing missing: no call is made', async () => {
    const first = await runVariance({ env: ENV, fetchImpl: stubFetch(() => 60), stories: two.stories, runs: 1, ...wait });
    const fetchImpl = stubFetch(() => 99);
    const again = await runVariance({ env: ENV, fetchImpl, stories: two.stories, runs: 1, previous: first, ...wait });
    expect(fetchImpl.calls()).toBe(0);
    expect(again.runs).toHaveLength(2);
  });
});

describe('saving as it goes, and stopping when the provider has nothing left to give', () => {
  const wait = { delayMs: 0, retryWaitMs: [0, 0, 0] };

  it('reports the partial result after every review, so an interruption loses nothing', async () => {
    const seen = [];
    const res = await runVariance({ env: ENV, fetchImpl: stubFetch(() => 60), stories: two.stories, runs: 2, ...wait, onCheckpoint: (r) => seen.push(r.runs.length) });
    expect(seen).toEqual([1, 2, 3, 4]);
    expect(res.runs).toHaveLength(4);
  });

  it('stops after a number of failures in a row (quota gone) instead of waiting through every retry for every remaining review, and says so', async () => {
    const fetchImpl = stubFetch(() => 60, { failCalls: Array.from({ length: 100 }, (_, i) => i + 1), failStatus: 429 });
    const res = await runVariance({ env: ENV, fetchImpl, stories: two.stories, runs: 5, ...wait, stopAfterFailures: 2 });
    expect(res.runs).toHaveLength(2);
    expect(res.runs.every((r) => !r.ok)).toBe(true);
    expect(fetchImpl.calls()).toBe(8); // 2 reviews x (1 try + 3 retries)
    expect(res.config.stoppedEarly).toMatchObject({ reason: 'consecutive_failures', after: 2 });
  });

  it('a success resets the count of failures in a row', async () => {
    // provider calls: 1-4 fail (review 1 gives up), 5 succeeds (review 2), 6-9 fail (review 3 gives up), 10-13 fail (review 4 gives up)
    const fetchImpl = stubFetch(() => 60, { failCalls: [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13], failStatus: 429 });
    const res = await runVariance({ env: ENV, fetchImpl, stories: two.stories, runs: 5, ...wait, stopAfterFailures: 2 });
    expect(res.runs.map((r) => r.ok)).toEqual([false, true, false, false]);
    expect(res.config.stoppedEarly.reason).toBe('consecutive_failures');
  });

  it('stops after the requested number of reviews (for a daily quota), and says so', async () => {
    const res = await runVariance({ env: ENV, fetchImpl: stubFetch(() => 60), stories: two.stories, runs: 5, ...wait, maxCalls: 3 });
    expect(res.runs).toHaveLength(3);
    expect(res.config.stoppedEarly).toMatchObject({ reason: 'max_calls', after: 3 });
  });

  it('stops when asked to (Ctrl-C), after the review in progress, keeping what it has', async () => {
    let n = 0;
    const res = await runVariance({ env: ENV, fetchImpl: stubFetch(() => 60), stories: two.stories, runs: 5, ...wait, shouldStop: () => n++ >= 1 });
    expect(res.runs).toHaveLength(1);
    expect(res.config.stoppedEarly.reason).toBe('interrupted');
  });

  it('a stopped result can be resumed: only the missing reviews are run', async () => {
    const first = await runVariance({ env: ENV, fetchImpl: stubFetch(() => 60), stories: two.stories, runs: 2, ...wait, maxCalls: 2 });
    const fetchImpl = stubFetch(() => 60);
    const done = await runVariance({ env: ENV, fetchImpl, stories: two.stories, runs: 2, ...wait, previous: first });
    expect(fetchImpl.calls()).toBe(2);
    expect(done.runs.filter((r) => r.ok)).toHaveLength(4);
    expect(done.config.stoppedEarly).toBeNull();
  });

  it('the report says it stopped early and how to carry on', async () => {
    const res = await runVariance({ env: ENV, fetchImpl: stubFetch(() => 60), stories: two.stories, runs: 5, ...wait, maxCalls: 2 });
    const text = formatReport(res, '/tmp/x.json');
    expect(text).toMatch(/stopped early/i);
    expect(text).toMatch(/--resume/);
  });
});
