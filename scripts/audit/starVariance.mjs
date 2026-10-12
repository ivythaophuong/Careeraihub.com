// Measures how much a STAR score moves when the SAME story is reviewed again (docs/audits/STAR-VARIANCE-PROTOCOL.md).
// It runs the real `score-star` handler (same prompt, same normalisation, same provider code as production) on ten synthetic stories, several times each,
// and writes the scores. It measures stability only. It changes no weight, no threshold and writes nothing to any database.
//
// Run (your own key stays in your own shell; never paste it into a chat):
//   read -s ANTHROPIC_API_KEY && export ANTHROPIC_API_KEY      # or GEMINI_API_KEY / OPENAI_API_KEY, ONE provider only
//   export AI_MODEL=<the model you want to measure>             # optional; otherwise the code's default for that provider
//   node scripts/audit/starVariance.mjs --runs 5
// Options: --delay-ms N, --resume <file>, --max-calls N (stop after N reviews, for a daily quota), --stop-after-failures N (default 3), --out <file>, --stories <file>
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

// Files whose content decides what a review returns. Their hash tells whether two measurements used the same scoring code.
const SCORING_FILES = ['../../supabase/functions/_shared/starScoring.js', '../../supabase/functions/score-star/handler.js', '../../supabase/functions/ai/providers.js'];
const scoringCodeHash = () => {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return sha256(SCORING_FILES.map((f) => fs.readFileSync(path.join(here, f), 'utf8')).join('\n---\n'));
  } catch { return null; }
};

// A call the provider could not serve right now (rate limit 429, or a server error that the handler reports as 502) is retried after a wait: it says
// nothing about the score, only that the provider was busy. A 422 (the answer was cut off or blocked) is NOT retried: that is a result about the answer.
const RETRYABLE = new Set([429, 502]);

// previous: the object a former run wrote. Its successful observations are kept and only the missing (story, run) pairs are run, after checking that the
// model and every prompt are the same (otherwise two different measurements would be mixed).
export async function runVariance({ env, fetchImpl = fetch, stories, runs = 5, delayMs = 1500, retryWaitMs = [30000, 65000, 120000], previous = null, maxCalls = Infinity, stopAfterFailures = 3, shouldStop = () => false, onCheckpoint = () => {}, onProgress = () => {} }) {
  const chain = providerChain(env);
  if (chain.length === 0) throw new Error('No provider key found in the environment. Set ONE of ANTHROPIC_API_KEY, GEMINI_API_KEY or OPENAI_API_KEY.');
  if (chain.length > 1) throw new Error(`More than one provider has a key (${chain.join(', ')}). A fallback could mix models inside one measurement: unset all but one and run again.`);

  // Local run: a throw-away signing key (receipts are not used), and a stand-in for the auth server. Provider calls go to fetchImpl untouched.
  const runEnv = { ...env, SCORING_SIGNING_KEY: `local-variance-${randomBytes(8).toString('hex')}`, SUPABASE_URL: env.SUPABASE_URL || 'https://local.invalid', SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || 'local' };
  const fetchWithLocalAuth = (url, init) => (String(url).includes('/auth/v1/user')
    ? Promise.resolve(new Response(JSON.stringify({ id: 'local-variance-run' }), { status: 200 }))
    : fetchImpl(url, init));
  const limiter = createRateLimiter({ max: 1_000_000 });
  // A wait that ends early when the run is asked to stop (Ctrl-C), so a long retry wait does not hold the terminal.
  const waitUnlessStopped = async (ms) => { const end = Date.now() + ms; while (Date.now() < end) { await sleep(Math.min(500, end - Date.now())); if (end - Date.now() > 1000 && shouldStop()) return; } };

  const promptHashes = Object.fromEntries(stories.map((st) => [st.id, sha256(buildStarPrompt(st.story, { role: '', level: '', industry: '' }))]));
  const codeHash = scoringCodeHash();
  const resumeNotes = [];
  let kept = [];
  if (previous) {
    const pc = previous.config || {};
    if (pc.model && pc.model !== modelFor(runEnv, chain[0])) throw new Error(`Cannot resume: the earlier results used the model ${pc.model} and this run would use ${modelFor(runEnv, chain[0])}. Set AI_MODEL to the earlier model, or start a new measurement.`);
    for (const st of stories) if (pc.promptHashes?.[st.id] && pc.promptHashes[st.id] !== promptHashes[st.id]) throw new Error(`Cannot resume: the prompt for ${st.id} is not the one the earlier results used (the story or the scoring prompt changed).`);
    if (pc.scoringCodeHash && codeHash && pc.scoringCodeHash !== codeHash) throw new Error('Cannot resume: the scoring code changed since the earlier results.');
    if (!pc.scoringCodeHash) resumeNotes.push('The earlier results did not record a hash of the scoring code, so it is not proven that it is unchanged; the prompts and the model are the same.');
    kept = (previous.runs || []).filter((r) => r.ok);
  }
  const have = new Set(kept.map((r) => `${r.storyId}#${r.run}`));

  // The handler writes one `[usage] {...}` line per provider attempt with the provider, model and token counts the provider reported: read them back.
  const usageEvents = [];
  const originalLog = console.log;
  console.log = (...a) => { const s = String(a[0] ?? ''); if (s.startsWith('[usage] ')) { try { usageEvents.push(JSON.parse(s.slice(8))); } catch { /* ignore */ } } else originalLog(...a); };

  const results = [...kept];
  const startedAt = new Date().toISOString();
  // The result as it stands: used for the final return and for the checkpoints written while the run is still going.
  const assemble = (stoppedEarly) => {
    const used = results.find((x) => x.model) || {};
    const config = {
      startedAt,
      provider: used.provider ?? chain[0],
      model: used.model ?? previous?.config?.model ?? modelFor(runEnv, chain[0]),
      modelsSeen: [...new Set(results.map((x) => x.model).filter(Boolean))],
      fallbackUsed: results.some((x) => x.fallback),
      maxTokens: LIMITS.maxTokens,
      temperature: 'not set by the code: the provider default applies',
      codeVersion: gitHash(),
      nodeVersion: process.version,
      runsPerStory: runs,
      storyCount: stories.length,
      delayMs,
      promptHashes,
      scoringCodeHash: codeHash,
      resumedFrom: previous ? { runsKept: kept.length, earlierCodeVersion: previous.config?.codeVersion ?? null, notes: resumeNotes } : null,
      stoppedEarly: stoppedEarly ?? null,
    };
    const ordered = [...results].sort((a, b) => a.run - b.run || stories.findIndex((x) => x.id === a.storyId) - stories.findIndex((x) => x.id === b.storyId));
    return { config, runs: ordered, summary: summarize(ordered) };
  };

  let stoppedEarly = null, observed = 0, failuresInARow = 0;
  try {
    outer: for (let r = 1; r <= runs; r++) {   // run-major: every story once, then again, so time of day does not line up with one story
      for (const st of stories) {
        if (have.has(`${st.id}#${r}`)) continue;
        if (shouldStop()) { stoppedEarly = { reason: 'interrupted', after: observed }; break outer; }
        if (observed >= maxCalls) { stoppedEarly = { reason: 'max_calls', after: observed }; break outer; }
        const before = usageEvents.length;
        let retries = 0, res, body;
        for (;;) {
          res = await handleRequest(new Request('https://local.invalid/functions/v1/score-star', {
            method: 'POST', headers: { authorization: 'Bearer local', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'review', story: st.story }),
          }), { env: runEnv, fetchImpl: fetchWithLocalAuth, limiter });
          body = await res.json().catch(() => ({}));
          if ((res.status === 200 && body.result) || !RETRYABLE.has(res.status) || retries >= retryWaitMs.length) break;
          await waitUnlessStopped(retryWaitMs[retries]);
          retries++;
        }
        const events = usageEvents.slice(before);
        const last = [...events].reverse().find((e) => e.outcome === 'success') || events[events.length - 1] || {};
        const base = { storyId: st.id, run: r, attempts: events.length, retries, fallback: events.some((e) => e.fallback), provider: last.provider ?? null, model: last.model ?? null };
        if (res.status === 200 && body.result) {
          results.push({ ...base, ok: true, scores: body.result.scores, overall: body.result.score,
            usage: { input_tokens: last.input_tokens ?? null, output_tokens: last.output_tokens ?? null, thinking_tokens: last.thinking_tokens ?? null, duration_ms: last.duration_ms ?? null } });
        } else {
          results.push({ ...base, ok: false, error: body?.error?.message || `HTTP ${res.status}`, status: res.status, errorKind: last.error_kind ?? null, httpStatus: last.http_status ?? null });
        }
        observed++;
        failuresInARow = results[results.length - 1].ok ? 0 : failuresInARow + 1;
        onProgress(results[results.length - 1], r, runs, stories.length);
        onCheckpoint(assemble(null));
        if (failuresInARow >= stopAfterFailures) { stoppedEarly = { reason: 'consecutive_failures', after: failuresInARow }; break outer; }
        if (delayMs > 0) await waitUnlessStopped(delayMs);
      }
    }
  } finally {
    console.log = originalLog;
  }
  return assemble(stoppedEarly);
}

// ── command line ──
const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : dflt; };
const fmt = (x, d = 1) => (x === null || x === undefined ? '-' : Number(x).toFixed(d));

// The text printed at the end of a run. Pure, so it is tested.
export function formatReport(res, out) {
  const c = res.config;
  const lines = [];
  lines.push(`\nProvider ${c.provider}, model ${c.model}${c.fallbackUsed ? '  (a FALLBACK provider was used: results mix models)' : ''}; code ${String(c.codeVersion).slice(0, 10)}; ${res.summary.totalFailures} failed of ${res.summary.totalRuns}`);
  const retried = res.runs.filter((r) => r.retries > 0);
  if (retried.length) lines.push(`Calls that needed a retry (rate limit or a provider error): ${retried.length}, ${retried.reduce((n, r) => n + r.retries, 0)} retries in all.`);
  const failed = res.runs.filter((r) => !r.ok);
  if (failed.length) {
    const why = {};
    for (const f of failed) { const k = `HTTP ${f.status}${f.errorKind ? ` (${f.errorKind})` : ''}`; why[k] = (why[k] || 0) + 1; }
    lines.push(`Failures after retries: ${Object.entries(why).map(([k, n]) => `${k} x${n}`).join(', ')}. Failed calls are not scores and are left out of the numbers.`);
  }
  if (c.stoppedEarly) {
    const why = { consecutive_failures: `the provider refused ${c.stoppedEarly.after} reviews in a row (most likely a quota that is used up)`, max_calls: `the limit of ${c.stoppedEarly.after} reviews for this session was reached`, interrupted: 'it was interrupted' }[c.stoppedEarly.reason] || c.stoppedEarly.reason;
    lines.push(`STOPPED EARLY: ${why}. What was done is saved. Run again later with --resume <this file> to carry on; the numbers below are for what exists so far and are not a complete measurement.`);
  }
  if (c.resumedFrom) lines.push(`Resumed: ${c.resumedFrom.runsKept} earlier successful reviews kept.${c.resumedFrom.notes?.length ? ' ' + c.resumedFrom.notes.join(' ') : ''}`);
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
  const resumePath = arg('resume', null);
  const previous = resumePath ? JSON.parse(fs.readFileSync(resumePath, 'utf8')) : null;
  const runs = Number(arg('runs', 5));
  const outDir = path.join(os.homedir(), 'star-variance');
  const out = arg('out', path.join(outDir, `results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`));
  fs.mkdirSync(path.dirname(out), { recursive: true });

  process.stderr.write(`Reviewing ${set.stories.length} synthetic stories x ${runs} runs = ${set.stories.length * runs} reviews${previous ? ` (resuming: ${previous.runs.filter((r) => r.ok).length} already done)` : ''}. A rate limit is retried after a wait. Nothing is saved to any database.\n`);
  process.stderr.write(`Results are saved to ${out} after EVERY review, so stopping loses nothing. Press Ctrl-C once to stop cleanly (twice to quit at once).\n`);

  // Write the file after every review: to a temporary name first, then rename, so a crash never leaves half a file.
  const save = (r) => { const tmp = `${out}.tmp`; fs.writeFileSync(tmp, JSON.stringify(r, null, 1) + '\n'); fs.renameSync(tmp, out); };
  let stopRequested = false;
  process.on('SIGINT', () => {
    if (stopRequested) process.exit(130);
    stopRequested = true;
    process.stderr.write('\nStopping after the review in progress; what is done is already saved. (Ctrl-C again to quit at once.)\n');
  });

  const res = await runVariance({
    env: process.env, stories: set.stories, runs, delayMs: Number(arg('delay-ms', 1500)), previous,
    maxCalls: arg('max-calls', null) === null ? Infinity : Number(arg('max-calls')),
    stopAfterFailures: Number(arg('stop-after-failures', 3)),
    shouldStop: () => stopRequested,
    onCheckpoint: save,
    onProgress: (r, run, runs_, n) => process.stderr.write(`[run ${run}/${runs_}] ${r.storyId}: ${r.ok ? `overall ${r.overall}${r.retries ? ` (after ${r.retries} retries)` : ''}` : `FAILED after ${r.retries} retries: HTTP ${r.status}`}\n`),
  });
  save(res);

  console.log(formatReport(res, out));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { process.stderr.write(`\n${e.message}\n`); process.exit(1); });
}
