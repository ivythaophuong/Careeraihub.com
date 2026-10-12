// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { buildCoachRequest, COACH_LIMITS } from './coachRequest.js';
import { LIMITS, handleRequest, createRateLimiter } from '../../../supabase/functions/ai/handler.js';

const CTX = '[ctx] Target role: Analyst';
const ACK = 'Understood — I have your full profile context loaded.';
// A stored conversation of `n` messages: the greeting, then user/assistant pairs.
const convo = (n, { userLen = 30, asstLen = 400 } = {}) => {
  const m = [{ role: 'assistant', content: 'Hi! I am your coach.' }];
  for (let i = 1; m.length < n; i++) {
    m.push({ role: 'user', content: `Q${i} `.padEnd(userLen, 'u') });
    if (m.length < n) m.push({ role: 'assistant', content: `A${i} `.padEnd(asstLen, 'a') });
  }
  return m.slice(0, n);
};
const chars = (msgs) => msgs.reduce((s, m) => s + m.content.length, 0);
const build = (history, content = 'New question?') => buildCoachRequest({ systemPrompt: CTX, history, content });

describe('the contract with the server (guards drift between client and server)', () => {
  it('the client limits equal the server limits', () => {
    expect(COACH_LIMITS.maxMessages).toBe(LIMITS.maxMessages);
    expect(COACH_LIMITS.maxPromptChars).toBe(LIMITS.maxPromptChars);
  });
});

describe('buildCoachRequest: a short conversation is sent whole, exactly as before', () => {
  it('context pair, the whole history, the new message', () => {
    const h = convo(5);
    const r = build(h);
    expect(r.error).toBeUndefined();
    expect(r.messages).toHaveLength(2 + 5 + 1);
    expect(r.messages[0]).toMatchObject({ role: 'user' });
    expect(r.messages[0].content).toContain('[COACH CONTEXT]');
    expect(r.messages[0].content).toContain(CTX);
    expect(r.messages[1]).toEqual({ role: 'assistant', content: ACK });
    expect(r.messages.slice(2, 7)).toEqual(h.map((m) => ({ role: m.role, content: m.content })));
    expect(r.messages[r.messages.length - 1]).toEqual({ role: 'user', content: 'New question?' });
    expect(r.dropped).toBe(0);
  });
});

describe('buildCoachRequest: never more than the server accepts, however long the conversation', () => {
  it('for every history length from 0 to 150 messages: at most maxMessages, at most maxPromptChars, context first, new question last', () => {
    for (let n = 0; n <= 150; n++) {
      const r = build(convo(n));
      expect(r.messages.length, `n=${n}`).toBeLessThanOrEqual(LIMITS.maxMessages);
      expect(chars(r.messages), `n=${n}`).toBeLessThanOrEqual(LIMITS.maxPromptChars);
      expect(r.messages[0].content).toContain('[COACH CONTEXT]');
      expect(r.messages[r.messages.length - 1]).toEqual({ role: 'user', content: 'New question?' });
    }
  });

  it('keeps the NEWEST turns and drops the oldest, and says how many were left out', () => {
    const h = convo(61);
    const r = build(h);
    expect(r.dropped).toBeGreaterThan(0);
    const kept = r.messages.slice(2, -1);
    expect(kept).toEqual(h.slice(h.length - kept.length).map((m) => ({ role: m.role, content: m.content })));
    expect(r.dropped).toBe(h.length - kept.length);
    expect(r.kept).toBe(kept.length);
  });

  it('a trimmed window starts with a user message (the greeting is not left dangling after the context reply)', () => {
    for (const n of [19, 20, 21, 40, 61]) {
      const r = build(convo(n));
      if (r.dropped > 0) expect(r.messages[2].role).toBe('user');
    }
  });

  it('uses the room it has: a trimmed window keeps at least 16 prior messages when messages are short', () => {
    expect(build(convo(61)).kept).toBeGreaterThanOrEqual(16);
  });
});

describe('buildCoachRequest: long messages', () => {
  it('long old messages are dropped to stay under the character cap, newest kept', () => {
    const h = convo(17, { userLen: 30000, asstLen: 30000 });
    const r = build(h);
    expect(chars(r.messages)).toBeLessThanOrEqual(LIMITS.maxPromptChars);
    expect(r.dropped).toBeGreaterThan(0);
    expect(r.kept).toBeGreaterThan(0);
  });

  it('a new message that alone cannot fit is refused with the limit, and nothing is built', () => {
    const r = build(convo(3), 'x'.repeat(LIMITS.maxPromptChars));
    expect(r.error).toBe('too_long');
    expect(r.maxChars).toBeGreaterThan(0);
    expect(r.messages).toBeUndefined();
  });

  it('the largest new message that fits is accepted and the history gives way to it', () => {
    const base = build(convo(0), '').messages;
    const room = LIMITS.maxPromptChars - chars(base);
    const r = build(convo(21), 'x'.repeat(room));
    expect(r.error).toBeUndefined();
    expect(chars(r.messages)).toBeLessThanOrEqual(LIMITS.maxPromptChars);
    expect(r.kept).toBe(0);
  });
});

describe('buildCoachRequest: entries that are not conversation', () => {
  it('skips the loading placeholder and error bubbles', () => {
    const h = [...convo(4), { role: 'assistant', content: 'Something went wrong: x. Try again.', error: true }, { role: 'assistant', content: '', loading: true }];
    const r = build(h);
    expect(r.messages.some((m) => /Something went wrong/.test(m.content))).toBe(false);
    expect(r.messages.length).toBe(2 + 4 + 1);
  });
});

describe('the real server accepts what the client builds, 30 turns in a row (synthetic, real handler)', () => {
  const ENV = { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'sk-ant-SECRET', AI_PROVIDER: 'anthropic' };
  const ok = (b, s = 200) => new Response(JSON.stringify(b), { status: s });
  const post = (messages, fetchImpl) => handleRequest(new Request('https://x/functions/v1/ai', {
    method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify({ messages, maxTokens: 600 }),
  }), { env: ENV, fetchImpl, limiter: createRateLimiter({ max: 1000 }) });

  it('30 consecutive turns with 2,700-character replies and 3,000-character questions all get HTTP 200', async () => {
    const reply = 'r'.repeat(2700);
    const fetchImpl = async (url) => (String(url).includes('/auth/v1/user') ? ok({ id: 'u1' }) : ok({ content: [{ type: 'text', text: reply }] }));
    let history = [{ role: 'assistant', content: 'Hi! I am your coach.' }];
    for (let turn = 1; turn <= 30; turn++) {
      const q = `Question ${turn}: ` + 'q'.repeat(3000);
      const r = build(history, q);
      expect(r.error).toBeUndefined();
      const res = await post(r.messages, fetchImpl);
      expect(res.status, `turn ${turn}`).toBe(200);
      history = [...history, { role: 'user', content: q }, { role: 'assistant', content: reply }];
    }
  });

  it('a provider failure is reported by the server as an error status, not as a limit error', async () => {
    const fetchImpl = async (url) => (String(url).includes('/auth/v1/user') ? ok({ id: 'u1' }) : new Response('boom', { status: 500 }));
    const res = await post(build(convo(61)).messages, fetchImpl);
    expect(res.status).not.toBe(200);
    expect(res.status).not.toBe(400);
  });
});
