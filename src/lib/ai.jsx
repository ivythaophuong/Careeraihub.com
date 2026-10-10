import React from 'react';
import { SUPABASE_URL, SUPABASE_ANON } from './supabase';
import { getValidSession } from './session';

// All model calls go through the `ai` Supabase Edge Function (supabase/functions/ai), which holds
// the provider keys, picks the provider/model, and enforces limits. No API key ships to the browser.
const AI_ENDPOINT = `${SUPABASE_URL}/functions/v1/ai`;

const REQUEST_TIMEOUT_MS = 100_000; // the function waits up to 80s on the provider
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = Number(import.meta.env.VITE_LLM_RETRY_DELAY_MS ?? 600);

export class LLMError extends Error {
  constructor(message, { status = 0, truncated = false, retryable } = {}) {
    super(message);
    this.name = 'LLMError';
    this.status = status;
    this.truncated = truncated;
    // Rate limits and server errors are worth one retry; bad requests and auth problems are not.
    this.retryable = retryable ?? (status === 429 || status >= 500);
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// POST to the function with timeout and one retry on transient failure.
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
      throw new LLMError(message, { status: res.status, truncated: !!err.truncated });
    } catch (e) {
      lastErr = e instanceof LLMError ? e
        : new LLMError(e?.name === 'AbortError' ? 'The AI request timed out.' : `Network error: ${e?.message || e}`, { retryable: true });
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
// A short label of where the call came from, sent so the server can attribute usage and cost to a feature (never the content of the call).
// options.feature wins; otherwise the open tool (?tab=<id>) gives "tab_<id>"; otherwise "app".
export function featureFromLocation() {
  try {
    const tab = new URLSearchParams(window.location.search).get('tab');
    return tab && /^[a-z0-9_]{1,30}$/i.test(tab) ? `tab_${tab.toLowerCase()}` : 'app';
  } catch { return 'app'; }
}

export async function callLLM(messages, maxTokens = 8192, pdfBase64 = null, options = {}) {
  const session = await getValidSession(); // refreshes the token if it is about to expire
  if (!session?.access_token) {
    throw new LLMError('Please sign in to use AI features.', { status: 401, retryable: false });
  }
  const payload = { messages, maxTokens, feature: options.feature || featureFromLocation() };
  if (pdfBase64) payload.pdfBase64 = pdfBase64;
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
