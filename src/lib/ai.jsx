import React from 'react';
import { SUPABASE_URL, SUPABASE_ANON } from './supabase';
import { getValidSession } from './session';

// All model calls go through the `ai` Supabase Edge Function (supabase/functions/ai), which holds
// the provider keys, picks the provider/model, and enforces limits. No API key ships to the browser.
const AI_ENDPOINT = `${SUPABASE_URL}/functions/v1/ai`;

// The function retries the provider itself and gives up after ~70s (up to 80s if tuned), so wait longer than that.
// The browser only retries when the request never got a real answer from the function (see below).
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = Number(import.meta.env.VITE_LLM_RETRY_DELAY_MS ?? 600);

export class LLMError extends Error {
  constructor(message, { status = 0, truncated = false, retryable = false, code = null } = {}) {
    super(message);
    this.name = 'LLMError';
    this.status = status;
    this.truncated = truncated;
    this.code = code; // e.g. 'busy' | 'timeout' | 'rate_limited' (from the function), when known
    // Only failures where the function never answered are worth an automatic retry.
    this.retryable = retryable;
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// POST to the function with a timeout. An error the function itself reports (busy, timeout, bad key...)
// is final: the function already retried the provider, so repeating it here would only double the wait.
// We retry once only when the request never got a real answer: a dropped connection, or a gateway error
// page that is not from the function.
async function postToProxy(token, payload) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      let data = null;
      try { data = await res.json(); } catch { /* non-JSON body (e.g. a gateway error page) */ }
      if (res.ok && typeof data?.text === 'string') return data.text;
      const err = data?.error || {};
      const message = res.status === 401
        ? 'Your session expired. Please sign in again.'
        : (typeof err === 'string' ? err : err.message) || `AI request failed (${res.status}).`;
      const fromFunction = data?.error != null; // a JSON error body means the function answered
      throw new LLMError(message, {
        status: res.status, truncated: !!err.truncated, code: err.code || null,
        retryable: !fromFunction && [502, 503, 504].includes(res.status),
      });
    } catch (e) {
      lastErr = e instanceof LLMError ? e
        : e?.name === 'AbortError' ? new LLMError('The AI took too long to respond. Please try again.', { code: 'timeout' })
        : new LLMError(`Network error: ${e?.message || e}`, { retryable: true });
      if (!lastErr.retryable) throw lastErr;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * (attempt + 1));
  }
  throw lastErr;
}

// ── callLLM ──────────────────────────────────────────────────────────────────
// messages: [{ role: 'user' | 'assistant', content: string }]
// pdfBase64: optional PDF sent alongside the prompt.
// Returns the reply text. Throws LLMError: `.status === 401` means the user must sign in;
// `.truncated` means the reply hit the length limit.
export async function callLLM(messages, maxTokens = 8192, pdfBase64 = null, { task } = {}) {
  const session = await getValidSession(); // refreshes the token if it is about to expire
  if (!session?.access_token) {
    throw new LLMError('Please sign in to use AI features.', { status: 401, retryable: false });
  }
  const payload = { messages, maxTokens };
  if (pdfBase64) payload.pdfBase64 = pdfBase64;
  if (task) payload.task = task; // a label only; the server decides which provider/model handles it
  return postToProxy(session.access_token, payload);
}

// ── extractJSON ──────────────────────────────────────────────────────────────
export function extractJSON(str) {
  try {
    // Strip markdown code fences — also handles Unicode invisible chars Gemini 2.5 sometimes prepends
    const cleaned = str
      .replace(/[​-‍⁠﻿]/g, '')  // strip zero-width / word-joiner chars
      .replace(/`{1,3}json\s*/gi, '')                // ```json or `json variants
      .replace(/`{1,3}\s*/g, '')                     // closing fences
      .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) {
      console.error('[extractJSON] No JSON found. Raw:', str.slice(0, 300));
      return { error: true, msg: 'No JSON found in AI response' };
    }
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (e) {
    console.error('[extractJSON] Parse failed. Raw:', str.slice(0, 300));
    return { error: true, msg: 'Failed to parse AI response: ' + e.message };
  }
}

// ── Markdown renderer ────────────────────────────────────────────────────────
export const Markdown = ({ text }) => {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div style={{ lineHeight: 1.6 }}>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <h3 key={i} style={{ margin: '16px 0 8px' }}>{line.slice(4)}</h3>;
        if (line.startsWith('## '))  return <h2 key={i} style={{ margin: '20px 0 10px' }}>{line.slice(3)}</h2>;
        if (line.startsWith('• ') || line.startsWith('- ')) return <li key={i} style={{ marginLeft: 20 }}>{line.slice(2)}</li>;
        if (line.trim() === '') return <div key={i} style={{ height: 10 }} />;
        return <p key={i} style={{ margin: '8px 0' }}>{line}</p>;
      })}
    </div>
  );
};
