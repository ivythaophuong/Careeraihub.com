// AI usage metering (step C1 of docs/product/PRICING-AND-CREDITS-STRATEGY.md): one structured log line per model call attempt, so the real
// cost of each feature can be worked out before credits are priced. Pure JS (runs under Deno and Vitest).
//
// Rules (set by the owner's review of 2026-10-10):
//  - Counts and metadata only. Never the text of a CV, a story, an answer or a prompt, never a key, never a raw user id.
//  - Tokens are what the provider reported. If the provider did not report usage the event says "usage_unavailable"; nothing is estimated.
//  - A cost is computed only from a versioned price table entry that was in force on the day of the call. No entry, no cost: "price_unknown".
//  - Logging must never break the user's request.

export const USAGE_EVENT_VERSION = 1;

// Versioned provider prices (USD per million tokens). EMPTY ON PURPOSE: the prices were not verified from the providers' own pages when this was
// written, and a wrong price is worse than none. Add entries from the provider's pricing page, with the date you read it. Shape:
//   { provider: 'gemini', model: 'gemini-3.8-flash', effective_from: '2026-10-10', effective_to: null, input_per_million_usd: 0.0, output_per_million_usd: 0.0,
//     thinking_billed_as: 'output' | 'included_in_output' | null, free_tier: false, source: 'https://...', read_on: '2026-10-10' }
// Billing quirks (thinking tokens, cached input, PDF pages, free tiers) are described by the entry; if an entry cannot describe a quirk, leave the entry out.
export const PRICE_TABLE = Object.freeze({ version: '0', entries: Object.freeze([]) });

export const sanitizeFeature = (f) => (typeof f === 'string' && /^[a-z0-9_]{1,40}$/.test(f) ? f : 'unknown');

const num = (v) => (Number.isFinite(v) && v >= 0 ? v : null);

// What each provider reports. Returns null when nothing usable was reported.
export function extractUsage(provider, data) {
  if (!data || typeof data !== 'object') return null;
  let u = null;
  if (provider === 'gemini') {
    const m = data.usageMetadata;
    if (m) u = { input: num(m.promptTokenCount), output: num(m.candidatesTokenCount), thinking: num(m.thoughtsTokenCount), total: num(m.totalTokenCount) };
  } else if (provider === 'anthropic') {
    const m = data.usage;
    if (m) u = { input: num(m.input_tokens), output: num(m.output_tokens), thinking: null, total: null };
  } else { // OpenAI and the OpenAI-compatible providers
    const m = data.usage;
    if (m) u = { input: num(m.prompt_tokens), output: num(m.completion_tokens), thinking: num(m.completion_tokens_details?.reasoning_tokens), total: num(m.total_tokens) };
  }
  if (!u || (u.input === null && u.output === null && u.total === null)) return null;
  return u;
}

// Finds the price entry in force on `dateIso` (YYYY-MM-DD) for this provider and model.
export function priceFor(table, provider, model, dateIso) {
  const hits = (table?.entries || []).filter((e) => e.provider === provider && e.model === model && e.effective_from <= dateIso && (!e.effective_to || dateIso <= e.effective_to));
  return hits.sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))[0] || null;
}

export function computeCost(usage, price, hasPdf = false) {
  if (!usage) return { cost_usd: null, cost_status: 'usage_unavailable' };
  if (!price) return { cost_usd: null, cost_status: 'price_unknown' };
  if (price.free_tier) return { cost_usd: 0, cost_status: 'free_tier' };
  if (hasPdf && !price.pdf_input_priced) return { cost_usd: null, cost_status: 'pdf_billing_unknown' }; // an entry must say it prices PDF input
  if (usage.input === null || usage.output === null) return { cost_usd: null, cost_status: 'usage_incomplete' };
  const thinkingExtra = usage.thinking && price.thinking_billed_as === 'output' ? usage.thinking : 0;
  if (usage.thinking && !price.thinking_billed_as) return { cost_usd: null, cost_status: 'thinking_billing_unknown' };
  const cost = (usage.input * price.input_per_million_usd + (usage.output + thinkingExtra) * price.output_per_million_usd) / 1e6;
  return { cost_usd: Math.round(cost * 1e8) / 1e8, cost_status: 'computed' };
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

// A stable pseudonym for a user, so cost per user can be summed without writing the user id into logs.
export async function userRef(secret, userId) {
  if (!secret || !userId) return null;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`usage-log:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(userId)))).slice(0, 16);
}

// Builds the event written for one attempt. Only fields listed here can reach the log.
export function buildEvent({ correlationId, feature, userRef: uref, provider, model, attempt, fallback, outcome, errorKind = null, httpStatus = null, durationMs, usage = null, hasPdf = false, priceTable = PRICE_TABLE, now = new Date() }) {
  const date = now.toISOString().slice(0, 10);
  const cost = outcome === 'success' ? computeCost(usage, priceFor(priceTable, provider, model, date), hasPdf) : { cost_usd: null, cost_status: 'not_applicable' };
  return {
    event: 'ai_usage', v: USAGE_EVENT_VERSION, ts: now.toISOString(), correlation_id: correlationId, feature: sanitizeFeature(feature), user_ref: uref ?? null,
    provider, model, attempt, fallback: !!fallback, outcome, error_kind: errorKind, http_status: httpStatus, duration_ms: Math.round(durationMs),
    input_tokens: usage?.input ?? null, output_tokens: usage?.output ?? null, thinking_tokens: usage?.thinking ?? null, total_tokens: usage?.total ?? null,
    usage_status: outcome !== 'success' ? 'not_applicable' : usage ? 'reported' : 'usage_unavailable',
    has_pdf: !!hasPdf, price_table_version: priceTable.version, ...cost,
  };
}

// The function that writes one event. It swallows its own failures: metering must never break a request.
export function makeRecorder(sink = (line) => console.log(line)) {
  return (event) => { try { sink(`[usage] ${JSON.stringify(event)}`); } catch { /* never throw into the request */ } };
}
