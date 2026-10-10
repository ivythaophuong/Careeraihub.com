// Turns exported function-log lines ("[usage] {json}") into a per-feature summary. Pure. Used by scripts/usage-report.mjs.
// It adds nothing up unless the numbers were reported: tokens that were not reported are counted as "unreported", never as zero.

export function parseUsageLines(text) {
  const events = [];
  let skipped = 0;
  for (const line of String(text || '').split('\n')) {
    const i = line.indexOf('[usage] ');
    if (i < 0) continue;
    try {
      const e = JSON.parse(line.slice(i + 8));
      if (e?.event === 'ai_usage') events.push(e); else skipped++;
    } catch { skipped++; }
  }
  return { events, skipped };
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
