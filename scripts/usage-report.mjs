// Summarises AI usage from exported Supabase function logs. Usage:
//   node scripts/usage-report.mjs path/to/exported-logs.txt
// The file may contain any log text; only lines with "[usage] {json}" are read. Prints one table row per feature. Never prints content (there is none in the events).
import fs from 'node:fs';
import { parseUsageLines, summarise, summariseVoice, VOICE_PRICES } from '../supabase/functions/_shared/usageReport.js';

const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/usage-report.mjs <log-file>'); process.exit(1); }
const { events, voiceEvents, skipped } = parseUsageLines(fs.readFileSync(file, 'utf8'));
const rows = summarise(events);
console.log(`${events.length} usage events read, ${voiceEvents.length} voice lines (${skipped} unreadable lines skipped)\n`);
if (rows.length) console.table(rows.map((r) => ({
  feature: r.feature, requests: r.requests, users: r.users, ok: r.successes, errors: r.errors, 'answered by fallback': r.fallbackAnswers,
  'avg in tokens': r.avgInputTokens ?? 'n/a', 'avg out tokens': r.avgOutputTokens ?? 'n/a', 'usage unreported': r.usageUnavailable,
  'cost USD': r.costUsd ?? 'price unknown', 'calls without cost': r.callsWithoutCost, 'avg ms': r.avgDurationMs,
})));

if (voiceEvents.length) {
  const v = summariseVoice(voiceEvents);
  const usd = (n) => (n === null ? 'price unknown' : n.toFixed(4));
  console.log('\nVoice transcription (an ESTIMATE from the audio length the browser reported)');
  console.table([{ answers: v.answers, 'audio minutes': +(v.audioSeconds / 60).toFixed(1), 'avg seconds': v.avgSeconds ?? 'n/a', 'est USD': usd(v.estUsd), 'avg USD per answer': v.avgUsd === null ? 'n/a' : v.avgUsd.toFixed(5),
    'answered by OpenAI (fallback)': v.fallbackAnswers, 'failed attempts (retry / refused)': `${v.failedAttempts.retry} / ${v.failedAttempts.reject}`, 'length unreported': v.unreportedLength, 'not priced': v.unpriced }]);
  console.table(Object.entries(v.byProvider).map(([provider, r]) => ({ provider, answers: r.answers, 'audio minutes': +(r.audioSeconds / 60).toFixed(1), 'billed minutes': +(r.billedSeconds / 60).toFixed(1), 'est USD': usd(r.estUsd) })));
  console.log('Prices used: Groq ' + VOICE_PRICES.groq.perHourUsd + ' USD per hour with a ' + VOICE_PRICES.groq.minSeconds + ' second minimum (' + VOICE_PRICES.groq.source + '); OpenAI ' + VOICE_PRICES.openai.perMinuteUsd + ' USD per minute (' + VOICE_PRICES.openai.source + ').');
}
