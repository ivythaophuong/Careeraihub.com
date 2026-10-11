// Summarises AI usage from exported Supabase function logs. Usage:
//   node scripts/usage-report.mjs path/to/exported-logs.txt
// The file may contain any log text; only lines with "[usage] {json}" are read. Prints one table row per feature. Never prints content (there is none in the events).
import fs from 'node:fs';
import { parseUsageLines, summarise } from '../supabase/functions/_shared/usageReport.js';

const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/usage-report.mjs <log-file>'); process.exit(1); }
const { events, skipped } = parseUsageLines(fs.readFileSync(file, 'utf8'));
const rows = summarise(events);
console.log(`${events.length} usage events read (${skipped} unreadable lines skipped)\n`);
console.table(rows.map((r) => ({
  feature: r.feature, requests: r.requests, users: r.users, ok: r.successes, errors: r.errors, 'answered by fallback': r.fallbackAnswers,
  'avg in tokens': r.avgInputTokens ?? 'n/a', 'avg out tokens': r.avgOutputTokens ?? 'n/a', 'usage unreported': r.usageUnavailable,
  'cost USD': r.costUsd ?? 'price unknown', 'calls without cost': r.callsWithoutCost, 'avg ms': r.avgDurationMs,
})));
