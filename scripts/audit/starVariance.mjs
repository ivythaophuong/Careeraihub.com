// Measures how much a STAR score moves when the SAME story is reviewed again (docs/audits/STAR-VARIANCE-PROTOCOL.md).
// It runs the real `score-star` handler (same prompt, same normalisation, same provider code as production) on ten synthetic stories, several times each,
// and writes the scores. It measures stability only. It changes no weight, no threshold and writes nothing to any database.
//
// Run (your own key stays in your own shell; never paste it into a chat):
//   read -s ANTHROPIC_API_KEY && export ANTHROPIC_API_KEY      # or GEMINI_API_KEY / OPENAI_API_KEY, ONE provider only
//   export AI_MODEL=<the model you want to measure>             # optional; otherwise the code's default for that provider
//   node scripts/audit/starVariance.mjs --runs 5
import { createHash, randomBytes } from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { handleRequest, LIMITS } from '../../supabase/functions/score-star/handler.js';
import { createRateLimiter } from '../../supabase/functions/ai/handler.js';
import { providerChain, modelFor } from '../../supabase/functions/ai/providers.js';
import { buildStarPrompt } from '../../supabase/functions/_shared/starScoring.js';
import { summarize } from './starVarianceStats.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const gitHash = () => { try { return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return 'unknown'; } };

export async function runVariance({ env, fetchImpl = fetch, stories, runs = 5, delayMs = 1500, onProgress = () => {} }) {
  const chain = providerChain(env);
  if (chain.length === 0) throw new Error('No provider key found in the environment. Set ONE of ANTHROPIC_API_KEY, GEMINI_API_KEY or OPENAI_API_KEY.');
  if (chain.length > 1) throw new Error(`More than one provider has a key (${chain.join(', ')}). A fallback could mix models inside one measurement: unset all but one and run again.`);

  // Local run: a throw-away signing key (receipts are not used), and a stand-in for the auth server. Provider calls go to fetchImpl untouched.
  const runEnv = { ...env, SCORING_SIGNING_KEY: `local-variance-${randomBytes(8).toString('hex')}`, SUPABASE_URL: env.SUPABASE_URL || 'https://local.invalid', SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || 'local' };
  const fetchWithLocalAuth = (url, init) => (String(url).includes('/auth/v1/user')
    ? Promise.resolve(new Response(JSON.stringify({ id: 'local-variance-run' }), { status: 200 }))
    : fetchImpl(url, init));
  const limiter = createRateLimiter({ max: 1_000_000 });

  // The handler writes one `[usage] {...}` line per provider attempt with the provider, model and token counts the provider reported: read them back.
  const usageEvents = [];
  const originalLog = console.log;
  console.log = (...a) => { const s = String(a[0] ?? ''); if (s.startsWith('[usage] ')) { try { usageEvents.push(JSON.parse(s.slice(8))); } catch { /* ignore */ } } else originalLog(...a); };

  const results = [];
  try {
    for (let r = 1; r <= runs; r++) {          // run-major: every story once, then again, so time of day does not line up with one story
      for (const s of stories) {
        const before = usageEvents.length;
        const res = await handleRequest(new Request('https://local.invalid/functions/v1/score-star', {
          method: 'POST', headers: { authorization: 'Bearer local', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'review', story: s.story }),
        }), { env: runEnv, fetchImpl: fetchWithLocalAuth, limiter });
        const body = await res.json().catch(() => ({}));
        const events = usageEvents.slice(before);
        const last = [...events].reverse().find((e) => e.outcome === 'success') || events[events.length - 1] || {};
        const base = { storyId: s.id, run: r, attempts: events.length, fallback: events.some((e) => e.fallback), provider: last.provider ?? null, model: last.model ?? null };
        if (res.status === 200 && body.result) {
          results.push({ ...base, ok: true, scores: body.result.scores, overall: body.result.score,
            usage: { input_tokens: last.input_tokens ?? null, output_tokens: last.output_tokens ?? null, thinking_tokens: last.thinking_tokens ?? null, duration_ms: last.duration_ms ?? null } });
        } else {
          results.push({ ...base, ok: false, error: body?.error?.message || `HTTP ${res.status}`, status: res.status });
        }
        onProgress(results[results.length - 1], r, runs, stories.length);
        if (delayMs > 0) await sleep(delayMs);
      }
    }
  } finally {
    console.log = originalLog;
  }

  const used = results.find((x) => x.model) || {};
  const config = {
    startedAt: new Date().toISOString(),
    provider: used.provider ?? chain[0],
    model: used.model ?? modelFor(runEnv, chain[0]),
    modelsSeen: [...new Set(results.map((x) => x.model).filter(Boolean))],
    fallbackUsed: results.some((x) => x.fallback),
    maxTokens: LIMITS.maxTokens,
    temperature: 'not set by the code: the provider default applies',
    codeVersion: gitHash(),
    nodeVersion: process.version,
    runsPerStory: runs,
    storyCount: stories.length,
    delayMs,
    promptHashes: Object.fromEntries(stories.map((s) => [s.id, sha256(buildStarPrompt(s.story, { role: '', level: '', industry: '' }))])),
  };
  return { config, runs: results, summary: summarize(results) };
}

// ── command line ──
const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : dflt; };
const fmt = (x, d = 1) => (x === null || x === undefined ? '-' : Number(x).toFixed(d));

// The text printed at the end of a run. Pure, so it is tested.
export function formatReport(res, out) {
  const c = res.config;
  const lines = [];
  lines.push(`\nProvider ${c.provider}, model ${c.model}${c.fallbackUsed ? '  (a FALLBACK provider was used: results mix models)' : ''}; code ${String(c.codeVersion).slice(0, 10)}; ${res.summary.totalFailures} failed of ${res.summary.totalRuns}`);
  lines.push('\nstory                      n   mean    sd   min   max  range   (overall score)');
  for (const s of res.summary.stories) {
    const o = s.overall;
    lines.push(`${s.storyId.padEnd(24)} ${String(o.n).padStart(3)} ${fmt(o.mean).padStart(6)} ${fmt(o.sd).padStart(5)} ${fmt(o.min, 0).padStart(5)} ${fmt(o.max, 0).padStart(5)} ${fmt(o.range, 0).padStart(6)}`);
  }
  const o = res.summary.overall;
  lines.push(`\nSame story between runs: sd ${fmt(o.withinSd)}.  Between stories: sd ${fmt(o.betweenSd)}.  Share of spread that is run-to-run: ${fmt(o.withinShare === null ? null : o.withinShare * 100, 0)}%`);
  lines.push(`Order of the stories in each run vs their mean order (Spearman): mean ${fmt(o.rankAgreement.mean, 2)}, lowest ${fmt(o.rankAgreement.min, 2)}`);
  lines.push(`\n${res.summary.note}\nFull results written to ${out}`);
  return lines.join('\n');
}

async function main() {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const storiesPath = arg('stories', path.join(root, '../../tests/fixtures/star-variance/stories.json'));
  const set = JSON.parse(fs.readFileSync(storiesPath, 'utf8'));
  const runs = Number(arg('runs', 5));
  const outDir = path.join(os.homedir(), 'star-variance');
  const out = arg('out', path.join(outDir, `results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`));
  fs.mkdirSync(path.dirname(out), { recursive: true });

  process.stderr.write(`Reviewing ${set.stories.length} synthetic stories x ${runs} runs = ${set.stories.length * runs} calls. Nothing is saved to any database.\n`);
  const res = await runVariance({
    env: process.env, stories: set.stories, runs, delayMs: Number(arg('delay-ms', 1500)),
    onProgress: (r, run, runs_, n) => process.stderr.write(`[run ${run}/${runs_}] ${r.storyId}: ${r.ok ? `overall ${r.overall}` : `FAILED ${r.error}`}\n`),
  });
  fs.writeFileSync(out, JSON.stringify(res, null, 1) + '\n');

  console.log(formatReport(res, out));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { process.stderr.write(`\n${e.message}\n`); process.exit(1); });
}
