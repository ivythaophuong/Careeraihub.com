// @vitest-environment jsdom
// The Coach must never send a request the server refuses (docs/audits/AI-COACH-AUDIT-2026-10-12.md): the `ai` function accepts at most
// LIMITS.maxMessages messages and LIMITS.maxPromptChars characters. These tests drive the real component and read what it sends.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({ callLLM: vi.fn(async () => 'A short reply.'), extractJSON: vi.fn() }));
vi.mock('../Landing/LandingPage', () => ({ GetReadyTabStrip: () => null }));
import { callLLM } from '../../lib/ai.jsx';
import { LIMITS } from '../../../supabase/functions/ai/handler.js';
import AICoach from './AICoach';

afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); callLLM.mockImplementation(async () => 'A short reply.'); Element.prototype.scrollIntoView = vi.fn(); });

// A stored conversation of `exchanges` user/assistant pairs after the greeting, like memory.aiChat after that many turns.
const stored = (exchanges) => [
  { role: 'assistant', content: 'Hi! I am your coach.', ts: 1 },
  ...Array.from({ length: exchanges }, (_, i) => [{ role: 'user', content: `Question ${i}`, ts: 2 + i * 2 }, { role: 'assistant', content: `Answer ${i}`, ts: 3 + i * 2 }]).flat(),
];
const chars = (msgs) => msgs.reduce((s, m) => s + m.content.length, 0);
const mount = (memory) => render(<AICoach memory={memory} form={{ role: 'Analyst' }} updateMemory={vi.fn()} showToast={vi.fn()} />);
const type = (text) => fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
const clickSend = () => fireEvent.click(screen.getByRole('button', { name: /send/i }));
const sendOne = async (text) => { const before = callLLM.mock.calls.length; type(text); clickSend(); await waitFor(() => expect(callLLM.mock.calls.length).toBe(before + 1)); await waitFor(() => expect(screen.getByRole('button', { name: /send/i })).toBeTruthy()); return callLLM.mock.calls[before][0]; };

describe('what the Coach sends', () => {
  it('a new conversation is well inside the server limit', async () => {
    mount({ aiChat: stored(0) });
    expect((await sendOne('Hello')).length).toBeLessThanOrEqual(LIMITS.maxMessages);
  });

  it('never sends more messages than the server accepts, however long the stored conversation is', async () => {
    mount({ aiChat: stored(30) });
    expect((await sendOne('One more question?')).length).toBeLessThanOrEqual(LIMITS.maxMessages);
  });

  it('always starts with the profile context and ends with the new question', async () => {
    mount({ aiChat: stored(30) });
    const sent = await sendOne('Brand new question');
    expect(sent[0].content).toContain('[COACH CONTEXT]');
    expect(sent[sent.length - 1]).toMatchObject({ role: 'user', content: 'Brand new question' });
  });

  it('sends the newest turns, not the oldest', async () => {
    mount({ aiChat: stored(30) });
    const sent = await sendOne('Next');
    const text = sent.map((m) => m.content).join('|');
    expect(text).toContain('Answer 29');
    expect(text).not.toContain('Question 0|');
  });

  it('25 consecutive messages in one conversation: every request is within the limits', async () => {
    mount({ aiChat: stored(0) });
    for (let i = 1; i <= 25; i++) {
      const sent = await sendOne(`Turn ${i} ` + 'x'.repeat(500));
      expect(sent.length, `turn ${i}`).toBeLessThanOrEqual(LIMITS.maxMessages);
      expect(chars(sent), `turn ${i}`).toBeLessThanOrEqual(LIMITS.maxPromptChars);
    }
    expect(callLLM).toHaveBeenCalledTimes(25);
  });

  it('25 consecutive messages with long replies and long questions stay within the limits', async () => {
    callLLM.mockImplementation(async () => 'r'.repeat(2700));
    mount({ aiChat: stored(0) });
    for (let i = 1; i <= 25; i++) {
      const sent = await sendOne(`Turn ${i} ` + 'q'.repeat(3000));
      expect(sent.length).toBeLessThanOrEqual(LIMITS.maxMessages);
      expect(chars(sent)).toBeLessThanOrEqual(LIMITS.maxPromptChars);
    }
  });
});

describe('telling the user what the coach no longer sees', () => {
  it('says nothing while the whole conversation is still sent', () => {
    mount({ aiChat: stored(3) });
    expect(screen.queryByText(/no longer sees/i)).toBeNull();
  });
  it('says so, plainly, once older messages are left out; they stay on screen', async () => {
    mount({ aiChat: stored(30) });
    expect(screen.getByText(/no longer sees them/i)).toBeTruthy();
    expect(screen.getByText('Question 0')).toBeTruthy();
  });
});

describe('a message too long to send', () => {
  it('is refused with the limit, nothing is sent, and what the user typed is kept', () => {
    mount({ aiChat: stored(2) });
    const long = 'x'.repeat(LIMITS.maxPromptChars);
    type(long);
    clickSend();
    expect(callLLM).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/too long/i);
    expect(screen.getByRole('textbox').value).toBe(long);
  });
});

describe('a failure from the provider', () => {
  it('shows an error bubble, the conversation can continue, and the error text is never sent back to the model', async () => {
    mount({ aiChat: stored(1) });
    callLLM.mockRejectedValueOnce(new Error('Provider is busy'));
    type('First try'); clickSend();
    await screen.findByText(/Something went wrong: Provider is busy/);
    const sent = await sendOne('Second try');
    expect(sent.some((m) => /Something went wrong/.test(m.content))).toBe(false);
    expect(sent[sent.length - 1]).toMatchObject({ content: 'Second try' });
    expect(screen.getByText('A short reply.')).toBeTruthy();
  });

  it('the failed question stays in the conversation the model sees on the next try', async () => {
    mount({ aiChat: stored(0) });
    callLLM.mockRejectedValueOnce(new Error('boom'));
    type('Please help with my resume'); clickSend();
    await screen.findByText(/Something went wrong/);
    const sent = await sendOne('Are you there?');
    expect(sent.map((m) => m.content)).toContain('Please help with my resume');
  });
});
