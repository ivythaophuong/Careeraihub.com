// Turns exported function-log lines ("[usage] {json}") into a per-feature summary. Pure. Used by scripts/usage-report.mjs.
// It adds nothing up unless the numbers were reported: tokens that were not reported are counted as "unreported", never as zero.

export function parseUsageLines(text) {
  const events = [];
  const voiceEvents = []; // lines of the transcribe function (voice practice)
  let skipped = 0;
  for (const line of String(text || '').split('\n')) {
    const i = line.indexOf('[usage] ');
    if (i < 0) continue;
    try {
      const e = JSON.parse(line.slice(i + 8));
      if (e?.event === 'ai_usage') events.push(e); else if (e?.event === 'voice_usage') voiceEvents.push(e); else skipped++;
    } catch { skipped++; }
  }
  return { events, voiceEvents, skipped };
}

const add = (a, b) => (Number.isFinite(b) ? (a ?? 0) + b : a);

export function summarise(events) {
  const byFeature = new Map();
  for (const e of events) {
    const f = byFeature.get(e.feature) || { feature: e.feature, attempts: 0, successes: 0, errors: 0, fallbacks: 0, requests: new Set(), users: new Set(), inputTokens: null, outputTokens: null, thinkingTokens: null, usageReported: 0, usageUnavailable: 0, costUsd: null, costComputed: 0, costUnknown: 0, durationMs: 0 };
    f.attempts++;
    f.requests.add(e.correlation_id);
    if (e.user_ref) f.users.add(e.user_ref);
    f.durationMs += e.duration_ms || 0;
    if (e.outcome === 'success') {
      f.successes++;
      if (e.fallback) f.fallbacks++;
      if (e.usage_status === 'reported') { f.usageReported++; f.inputTokens = add(f.inputTokens, e.input_tokens); f.outputTokens = add(f.outputTokens, e.output_tokens); f.thinkingTokens = add(f.thinkingTokens, e.thinking_tokens); } else f.usageUnavailable++;
      if (e.cost_status === 'computed' || e.cost_status === 'free_tier') { f.costComputed++; f.costUsd = add(f.costUsd, e.cost_usd); } else f.costUnknown++;
    } else f.errors++;
    byFeature.set(e.feature, f);
  }
  return [...byFeature.values()].map((f) => ({
    feature: f.feature, requests: f.requests.size, attempts: f.attempts, successes: f.successes, errors: f.errors, fallbackAnswers: f.fallbacks, users: f.users.size,
    inputTokens: f.inputTokens, outputTokens: f.outputTokens, thinkingTokens: f.thinkingTokens,
    avgInputTokens: f.usageReported ? Math.round((f.inputTokens ?? 0) / f.usageReported) : null,
    avgOutputTokens: f.usageReported ? Math.round((f.outputTokens ?? 0) / f.usageReported) : null,
    usageReported: f.usageReported, usageUnavailable: f.usageUnavailable,
    costUsd: f.costUsd, costedCalls: f.costComputed, callsWithoutCost: f.costUnknown,
    avgDurationMs: f.attempts ? Math.round(f.durationMs / f.attempts) : null,
  })).sort((a, b) => b.attempts - a.attempts);
}

// ── voice transcription ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Speech to text is paid by the second of audio, not by the token. The length is the one the browser reported, so every figure here is an ESTIMATE:
// a request with no usable length is counted as unreported and never as zero, and a provider without a price is never priced.
export const VOICE_PRICES = {
  groq: { perHourUsd: 0.04, minSeconds: 10, source: "Groq's own model page (price), read 2026-10-15" },
  openai: { perMinuteUsd: 0.003, minSeconds: 0, source: 'a third-party price list, not read on the OpenAI page' },
};
const priceOf = (provider, billedSeconds) => {
  const p = VOICE_PRICES[provider];
  if (!p) return null;
  return p.perHourUsd ? (billedSeconds / 3600) * p.perHourUsd : (billedSeconds / 60) * p.perMinuteUsd;
};

export function summariseVoice(voiceEvents) {
  const out = { answers: 0, audioSeconds: 0, estUsd: 0, fallbackAnswers: 0, unreportedLength: 0, unpriced: 0, failedAttempts: { retry: 0, reject: 0 }, byProvider: {}, avgSeconds: null, avgUsd: null };
  let measured = 0; let priced = 0;
  for (const e of voiceEvents || []) {
    if (e.outcome === 'retry' || e.outcome === 'reject') { out.failedAttempts[e.outcome]++; continue; }
    if (e.outcome !== 'success') continue;
    out.answers++;
    if (e.provider === 'openai') out.fallbackAnswers++; // OpenAI is the fallback of the chain
    const rec = (out.byProvider[e.provider] ||= { answers: 0, audioSeconds: 0, billedSeconds: 0, estUsd: VOICE_PRICES[e.provider] ? 0 : null });
    rec.answers++;
    const sec = Number.isFinite(e.audioSec) && e.audioSec >= 0 ? e.audioSec : null;
    if (sec === null) { out.unreportedLength++; continue; }
    measured++; out.audioSeconds += sec; rec.audioSeconds += sec;
    const billed = Math.max(sec, VOICE_PRICES[e.provider]?.minSeconds ?? 0);
    rec.billedSeconds += billed;
    const usd = priceOf(e.provider, billed);
    if (usd === null) { out.unpriced++; continue; }
    rec.estUsd += usd; out.estUsd += usd; priced++;
  }
  if (measured) out.avgSeconds = Math.round(out.audioSeconds / measured);
  if (priced) out.avgUsd = out.estUsd / priced;
  return out;
}
