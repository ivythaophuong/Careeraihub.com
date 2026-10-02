import React from 'react';

const PROVIDER = (import.meta.env.VITE_LLM_PROVIDER || 'gemini').toLowerCase();
const REQUESTED_MODEL = import.meta.env.VITE_LLM_MODEL;
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const OPENAI_KEY    = import.meta.env.VITE_OPENAI_API_KEY;
const GEMINI_KEY    = import.meta.env.VITE_GEMINI_API_KEY;

const REQUEST_TIMEOUT_MS = 90_000;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = Number(import.meta.env.VITE_LLM_RETRY_DELAY_MS ?? 600);

const DEFAULT_MODELS = { gemini: 'gemini-2.5-flash', anthropic: 'claude-sonnet-5-5', openai: 'gpt-4o-mini' };
const MODEL_FAMILY   = { gemini: /^gemini/i, anthropic: /^claude/i, openai: /^(gpt|o\d|chatgpt)/i };
const KEY_VAR        = { gemini: 'VITE_GEMINI_API_KEY', anthropic: 'VITE_ANTHROPIC_API_KEY', openai: 'VITE_OPENAI_API_KEY' };

// Anything that isn't gemini/openai is treated as anthropic (previous behaviour).
const provider = PROVIDER === 'gemini' || PROVIDER === 'openai' ? PROVIDER : 'anthropic';

// A model id that belongs to a different provider (e.g. VITE_LLM_MODEL=gemini-… with
// VITE_LLM_PROVIDER=anthropic) would 404, so fall back to that provider's default.
export const resolveModel = (prov, model) => (model && MODEL_FAMILY[prov].test(model) ? model : DEFAULT_MODELS[prov]);
const MODEL = resolveModel(provider, REQUESTED_MODEL);

export class LLMError extends Error {
  constructor(message, { status = 0, truncated = false, retryable } = {}) {
    super(message);
    this.name = 'LLMError';
    this.status = status;
    this.truncated = truncated;
    // Rate limits and server errors are worth one retry; bad requests and bad keys are not.
    this.retryable = retryable ?? (status === 429 || status >= 500);
  }
}

const truncatedError = (who) =>
  new LLMError(`${who} stopped because the response hit the length limit, so it was cut off. Please try again with shorter input.`, { truncated: true, retryable: false });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// POST with timeout, one retry on transient failure, and uniform error handling.
async function request(url, init, who) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      let data = null;
      try { data = await res.json(); } catch { /* non-JSON body */ }
      if (res.ok && data && !data.error) return data;
      const raw = data?.error?.message ?? data?.error ?? `${who} request failed (${res.status})`;
      throw new LLMError(typeof raw === 'string' ? raw : JSON.stringify(raw), { status: res.status });
    } catch (e) {
      lastErr = e instanceof LLMError ? e
        : new LLMError(e?.name === 'AbortError' ? `${who} request timed out.` : `${who} network error: ${e?.message || e}`, { retryable: true });
      if (!lastErr.retryable) throw lastErr;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * (attempt + 1));
  }
  throw lastErr;
}

function requireKey(prov, key) {
  if (!key) throw new LLMError(`No API key configured for ${prov}. Set ${KEY_VAR[prov]}.`, { retryable: false });
}

// ── callLLM ──────────────────────────────────────────────────────────────────
// Generic LLM caller. Routes to the configured provider.
// pdfBase64: optional — a PDF sent natively alongside the prompt (supported by all providers).
// Throws LLMError; `err.truncated` is true when the model hit maxTokens.
export async function callLLM(messages, maxTokens = 8192, pdfBase64 = null) {
  if (provider === 'gemini') return _callGemini(messages, maxTokens, pdfBase64);
  if (provider === 'openai') return _callOpenAI(messages, maxTokens, pdfBase64);
  return _callAnthropic(messages, maxTokens, pdfBase64);
}

async function _callGemini(messages, maxTokens, pdfBase64) {
  requireKey('gemini', GEMINI_KEY);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  // Flatten messages into a single prompt for Gemini
  const text = messages.map(m => m.content).join('\n\n');
  const parts = pdfBase64
    ? [{ inline_data: { mime_type: 'application/pdf', data: pdfBase64 } }, { text }]
    : [{ text }];

  const data = await request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.1 }
    })
  }, 'Gemini');

  const cand = data.candidates?.[0];
  if (!cand) {
    const reason = data.promptFeedback?.blockReason;
    throw new LLMError(reason ? `Gemini blocked the request (${reason}).` : 'Gemini returned no response.', { retryable: false });
  }
  if (cand.finishReason === 'MAX_TOKENS') throw truncatedError('Gemini');
  const out = (cand.content?.parts || []).map(p => p.text || '').join('');
  if (!out) throw new LLMError(`Gemini returned no text${cand.finishReason ? ` (${cand.finishReason})` : ''}.`, { retryable: false });
  return out;
}

async function _callAnthropic(messages, maxTokens, pdfBase64) {
  requireKey('anthropic', ANTHROPIC_KEY);
  let msgs = messages;
  if (pdfBase64) {
    // Attach the PDF as a document block on the last user message.
    const last = messages.map(m => m.role).lastIndexOf('user');
    msgs = messages.map((m, i) => i !== last ? m : {
      ...m,
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
        { type: 'text', text: m.content },
      ],
    });
  }
  const data = await request('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      // Required for calls made directly from a browser.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: msgs })
  }, 'Anthropic');

  if (data.stop_reason === 'max_tokens') throw truncatedError('Claude');
  const out = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  if (!out) throw new LLMError('Claude returned an empty response.', { retryable: false });
  return out;
}

async function _callOpenAI(messages, maxTokens, pdfBase64) {
  requireKey('openai', OPENAI_KEY);
  let msgs = messages;
  if (pdfBase64) {
    const last = messages.map(m => m.role).lastIndexOf('user');
    msgs = messages.map((m, i) => i !== last ? m : {
      ...m,
      content: [
        { type: 'file', file: { filename: 'resume.pdf', file_data: `data:application/pdf;base64,${pdfBase64}` } },
        { type: 'text', text: m.content },
      ],
    });
  }
  const data = await request('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: MODEL, max_completion_tokens: maxTokens, messages: msgs })
  }, 'OpenAI');

  const choice = data.choices?.[0];
  if (choice?.finish_reason === 'length') throw truncatedError('OpenAI');
  const out = choice?.message?.content;
  if (!out) throw new LLMError('OpenAI returned an empty response.', { retryable: false });
  return out;
}

// ── extractJSON ──────────────────────────────────────────────────────────────
export function extractJSON(str) {
  try {
    // Strip markdown code fences (Gemini 2.5 wraps JSON in ```json ... ```)
    const cleaned = str.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
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
