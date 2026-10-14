// Measures the LIVE rewrite path: the `issues[].after` suggestions that the ats_parse prompt makes for resumes with weak bullets.
// It counts, by code, how often a suggestion adds a figure the resume does not have (numberGuard) or changes what the resume claims
// (claimGuard: ownership, scope, new tool or name, unsupported result). Invented data only. Keys come from the environment.
//   npx vite-node scripts/audit/rewriteTest.mjs --outdir <dir> [--models luna,haiku,groq] [--wait 28000] [--dry-run]
// Needs the keys of the chosen providers in your own shell (GROQ_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY). See scripts/audit/README.md for cost and limits.
// Print the table again from a saved result with: node scripts/audit/rewriteReport.mjs <dir>/rewrite-results.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MODEL_REGISTRY, parseModelJson as parseJson, rewriteStats, renderRewriteTable } from './modelEvalCore.mjs';
import { WEAK_RESUMES as CVS } from '../../tests/fixtures/model-eval/weakResumes.js';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : (process.argv[i + 1] ?? true); };
const repo = fileURLToPath(new URL('../..', import.meta.url));
const outdir = path.resolve(String(arg('outdir', './rewrite')));
const dry = process.argv.includes('--dry-run');
const waitMs = Number(arg('wait', 28000));
const imp = (p) => import(pathToFileURL(path.join(repo, p)).href);

const { buildParsePrompt } = await imp('src/features/ATSBuilder/parsePrompt.js');
const { findUnsupportedNumbers } = await imp('src/lib/numberGuard.js');
const { claimWarnings } = await imp('src/lib/claimGuard.js');
const { callProviderDetailed, KEY_ENV } = await imp('supabase/functions/ai/providers.js');

// the output limit each model gets in this test (thinking models count their thinking in it)
const MAX_TOKENS = { groq: 4000, haiku: 8000, luna: 8000, sonnet: 8000, sol: 8000 };
const REGISTRY = Object.fromEntries(Object.entries(MODEL_REGISTRY).map(([k, v]) => [k, { ...v, maxTokens: MAX_TOKENS[k] }]));
const MODELS = String(arg('models', 'luna,haiku,groq')).split(',').map((x) => REGISTRY[x.trim()]).filter(Boolean);

const pretend = (m, c) => JSON.stringify({ issues: [{ severity: 'high', title: 'Weak bullet', description: 'x', before: 'Helped customers', after: m.id === 'luna' ? 'Helped customers, boosting sales by 25% across the company' : 'Helped customers find products', evidence: ['Helped customers find products'], unsupported: m.id === 'luna' ? ['sales boost'] : [] }] });

async function call(m, c) {
  const messages = [{ role: 'user', content: buildParsePrompt(c.text, '2026-10-14') }];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (dry) return { ok: true, text: pretend(m, c), usage: { input: 1500, output: 1800 }, ms: 1 };
      const key = process.env[KEY_ENV[m.provider]];
      if (!key) throw Object.assign(new Error('no key'), { kind: 'no_key' });
      const r = await callProviderDetailed({ provider: m.provider, model: m.model, key, messages, maxTokens: m.maxTokens }, fetch, 120_000);
      return { ok: true, text: r.text, usage: r.usage, ms: r.durationMs };
    } catch (e) {
      if (!((e?.status === 429 || e?.status === 503) && attempt < 3)) return { ok: false, error: `${e?.kind ?? 'unknown'} ${e?.status ?? ''}`.trim(), ms: 0 };
      await new Promise((res) => setTimeout(res, 30_000));
    }
  }
}

const rows = [];
for (const c of CVS) {
  for (const m of MODELS) {
    const r = await call(m, c);
    const parsed = r.ok ? parseJson(r.text) : null;
    const issues = Array.isArray(parsed?.issues) ? parsed.issues : [];
    const checked = issues.map((it) => {
      const before = String(it.before ?? ''), after = String(it.after ?? '');
      const hasAfter = after.trim().length > 0;
      const numbers = hasAfter ? findUnsupportedNumbers(`${c.text}\n${before}`, after) : [];
      const claims = hasAfter ? claimWarnings({ before, after, resumeText: c.text, evidence: it.evidence, unsupported: it.unsupported }) : [];
      return { title: it.title, before, after, severity: it.severity, evidence: it.evidence ?? null, unsupported: it.unsupported ?? null, invented_numbers: numbers, claims: claims.map((w) => ({ type: w.type, words: w.words })) };
    });
    rows.push({ cv: c.id, model: m.id, ok: r.ok, error: r.error ?? null, ms: r.ms, validJson: !!parsed, input: r.usage?.input ?? null, output: r.usage?.output ?? null, thinking: r.usage?.thinking ?? null, issues: checked });
    process.stderr.write(`${c.id} ${m.id} ${r.ok ? 'ok' : 'FAIL'}\n`);
    if (!dry) await new Promise((res) => setTimeout(res, m.provider === 'groq' ? waitMs : 1500));
  }
}

fs.mkdirSync(outdir, { recursive: true });
fs.writeFileSync(path.join(outdir, 'rewrite-results.json'), JSON.stringify({ models: MODELS.map(({ id, model, price }) => ({ id, model, price })), rows }, null, 1));
console.log(renderRewriteTable(MODELS.map((m) => rewriteStats(rows, m))));