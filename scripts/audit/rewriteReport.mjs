// Prints the table of scripts/audit/rewriteTest.mjs again from a saved result, so two runs can be put side by side without calling any model.
//   node scripts/audit/rewriteReport.mjs <dir>/rewrite-results.json [<other>/rewrite-results.json ...]
// Reads files only; no network, no keys.
import fs from 'node:fs';
import { rewriteStats, renderRewriteTable } from './modelEvalCore.mjs';

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!files.length) { console.error('usage: node scripts/audit/rewriteReport.mjs <rewrite-results.json> [...]'); process.exit(1); }

for (const f of files) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  console.log(`\n${f}\n`);
  console.log(renderRewriteTable((d.models || []).map((m) => rewriteStats(d.rows || [], m))));
}
