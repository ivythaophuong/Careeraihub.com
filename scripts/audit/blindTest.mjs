// Blind comparison of two models on the platform's own prompts (cover letter, interview questions, answer evaluation, tone change).
// Everything sent is invented. Keys come from the environment, never printed or written.
//   npx vite-node scripts/audit/blindTest.mjs --outdir <dir> [--models groq,haiku,luna] [--repeat 3]   real run (needs the keys of the three providers in your shell)
//   npx vite-node scripts/audit/blindTest.mjs --outdir <dir> --dry-run                                     no network: checks the harness with pretend models
// See scripts/audit/README.md for what a run costs. Do not open <dir>/.sealed-key.json until you have rated the answers.
// Writes <outdir>/blind.md (what you read: Answer A / B / C, model names hidden), <outdir>/ratings.csv (to fill in),
// <outdir>/.sealed-key.json (which is which + tokens + cost + time: open it only AFTER rating).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MODEL_REGISTRY, balancedOrders } from './modelEvalCore.mjs';
import { JD, ANSWERS, LETTER } from '../../tests/fixtures/model-eval/blindTasks.js';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : (process.argv[i + 1] ?? true); };
const repo = fileURLToPath(new URL('../..', import.meta.url));
const outdir = path.resolve(String(arg('outdir', './blind')));
const dry = process.argv.includes('--dry-run');
const waitMs = Number(arg('wait', 16000));
const imp = (p) => import(pathToFileURL(path.join(repo, p)).href);

const { CASES } = await imp('tests/fixtures/extraction-accuracy/cases.js');
const { CASES_B } = await imp('tests/fixtures/extraction-accuracy/casesB.js');
const { CASES_C } = await imp('tests/fixtures/extraction-accuracy/casesC.js');
const { buildCoverLetterPrompt, buildToneChangePrompt } = await imp('src/features/CoverLetterGen/coverLetter.js');
const { buildQuestionsPrompt } = await imp('src/features/HiringManagerSim/interview.js');
const { buildEvaluationPrompt, PERSONAS } = await imp('supabase/functions/_shared/interviewScoring.js');
const { callProviderDetailed, KEY_ENV } = await imp('supabase/functions/ai/providers.js');

// the output limit each model gets in this test (thinking models count their thinking in it)
const MAX_TOKENS = { groq: 2500, haiku: 6000, luna: 8000, sonnet: 8000, sol: 8000 };
const REGISTRY = Object.fromEntries(Object.entries(MODEL_REGISTRY).map(([k, v]) => [k, { ...v, maxTokens: MAX_TOKENS[k] }]));
const MODELS = String(arg('models', 'groq,haiku,luna')).split(',').map((x) => REGISTRY[x.trim()]).filter(Boolean);
if (MODELS.length !== 3) throw new Error('pass exactly three models, e.g. --models luna,sonnet,sol');
const REPEAT = Math.max(1, Number(arg('repeat', 1)));

const personas = Object.keys(PERSONAS);
const R = (c) => ({ kind: 'text', text: c.text });

const tasks = [];
['professional', 'confident', 'storytelling'].forEach((tone, i) => {
  const c = [CASES[0], CASES_B[0], CASES_C[0]][i];
  tasks.push({ id: `T${tasks.length + 1}`, kind: 'Cover letter (JSON)', prompt: buildCoverLetterPrompt({ jd: JD[i], role: ['Product Analyst', 'Operations Analyst', 'Product Associate'][i], tone, resume: R(c), applicantName: '', company: '' }) });
});
[0, 1, 2].forEach((i) => {
  const c = [CASES[1], CASES_B[1], CASES_C[1]][i];
  tasks.push({ id: `T${tasks.length + 1}`, kind: `Interview questions, persona "${personas[i % personas.length]}" (JSON)`, prompt: buildQuestionsPrompt({ personaId: personas[i % personas.length], role: ['Product Analyst', 'Operations Analyst', 'Product Associate'][i], resume: R(c) }) });
});
ANSWERS.forEach((x, i) => {
  tasks.push({ id: `T${tasks.length + 1}`, kind: `Interview answer evaluation, answer ${['weak', 'medium', 'strong'][i]} (JSON with a score)`, answerQuality: ['weak', 'medium', 'strong'][i], prompt: buildEvaluationPrompt({ personaId: personas[0], role: 'Product Analyst', question: x.q, answer: x.a, resume: R(CASES[0]) }) });
});
tasks.push({ id: `T${tasks.length + 1}`, kind: 'Cover letter tone change to "concise"', prompt: buildToneChangePrompt({ letter: LETTER, tone: 'concise' }) });

const pretend = (m, t) => `[pretend answer from ${m.id} for ${t.id}] ` + (t.kind.includes('evaluation') ? JSON.stringify({ score: 40 + (m.id.length * 7) % 30, worked: 'x', missed: 'y', tip: 'z', betterAnswerOutline: ['a', 'b', 'c'] }) : 'text');

async function call(m, t) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      if (dry) return { ok: true, text: pretend(m, t), usage: { input: 1000, output: 400, thinking: null }, ms: 1 };
      const key = process.env[KEY_ENV[m.provider]];
      if (!key) throw Object.assign(new Error(`no ${KEY_ENV[m.provider]} in the environment`), { kind: 'no_key' });
      const r = await callProviderDetailed({ provider: m.provider, model: m.model, key, messages: [{ role: 'user', content: t.prompt }], maxTokens: m.maxTokens }, fetch, 120_000);
      return { ok: true, text: r.text, usage: r.usage, ms: r.durationMs };
    } catch (e) {
      const retry = (e?.status === 429 || e?.status === 503) && attempt < 4;
      if (!retry) return { ok: false, error: `${e?.kind ?? 'unknown'} ${e?.status ?? ''}`.trim(), ms: 0 };
      await new Promise((res) => setTimeout(res, 25_000));
    }
  }
}

const picks = balancedOrders(tasks.length, MODELS.length);   // each model stands in each position about equally often
const LABELS = ['A', 'B', 'C'];
const results = [];
for (const [ti, t] of tasks.entries()) {
  const order = picks[ti].map((k) => MODELS[k]);
  const answers = {};
  for (const m of MODELS) {
    answers[m.id] = await call(m, t);
    if (!dry) await new Promise((res) => setTimeout(res, m.provider === 'groq' ? waitMs : 1500));
  }
  results.push({ task: t, order: order.map((m) => m.id), answers });
  process.stderr.write(`done ${t.id}\n`);
}

// ── scoring stability: the same evaluation prompts run again, only the score is kept ──
const scoreOf = (text) => { const m = /"score"\s*:\s*(\d+)/.exec(String(text ?? '')); return m ? Number(m[1]) : null; };
const stability = {};
if (REPEAT > 1) {
  for (const r of results.filter((x) => x.task.kind.includes('evaluation'))) {
    for (const m of MODELS) {
      const scores = [scoreOf(r.answers[m.id]?.text)].filter((v) => v !== null);
      for (let i = 1; i < REPEAT; i++) {
        const a = await call(m, r.task);
        const sc = a.ok ? scoreOf(a.text) : null;
        if (sc !== null) scores.push(sc);
        if (!dry) await new Promise((res) => setTimeout(res, m.provider === 'groq' ? waitMs : 1500));
      }
      (stability[r.task.id] ??= {})[m.id] = scores;
    }
    process.stderr.write(`repeated ${r.task.id}\n`);
  }
}
fs.mkdirSync(outdir, { recursive: true });
const md = ['# Blind comparison of three models: which answer would you rather show a user?', '', 'Rate each answer 1-5 in ratings.csv (1 = unusable, 3 = acceptable, 5 = I would ship it). Do NOT open `.sealed-key.json` until you have finished.', ''];
const csv = ['task,answer,rating_1_to_5,note'];
for (const r of results) {
  md.push(`## ${r.task.id}. ${r.task.kind}`, '');
  LABELS.forEach((label, i) => {
    const a = r.answers[r.order[i]];
    md.push(`### Answer ${label}`, '', a.ok ? '```\n' + String(a.text).trim() + '\n```' : `(no answer: the call failed)`, '');
    csv.push(`${r.task.id},${label},,`);
  });
}
fs.writeFileSync(path.join(outdir, 'blind.md'), md.join('\n'));
fs.writeFileSync(path.join(outdir, 'ratings.csv'), csv.join('\n') + '\n');
const sealed = results.map((r) => ({
  task: r.task.id, kind: r.task.kind, A: r.order[0], B: r.order[1], C: r.order[2],
  models: Object.fromEntries(MODELS.map((m) => {
    const a = r.answers[m.id]; const u = a.usage || {};
    const cost = a.ok && Number.isFinite(u.input) && Number.isFinite(u.output) ? (u.input * m.price[0] + u.output * m.price[1]) / 1e6 : null;
    return [m.id, { ok: a.ok, error: a.error ?? null, ms: a.ms, input_tokens: u.input ?? null, output_tokens: u.output ?? null, thinking_tokens: u.thinking ?? null, cost_usd: cost }];
  })),
}));
fs.writeFileSync(path.join(outdir, '.sealed-key.json'), JSON.stringify({ models: MODELS.map(({ id, model, price }) => ({ id, model, price_per_million_in_out: price })), sealed, stability }, null, 1));
fs.writeFileSync(path.join(outdir, '.sealed-raw.json'), JSON.stringify(results.map((r) => ({ task: r.task.id, answers: Object.fromEntries(Object.entries(r.answers).map(([k, v]) => [k, v.ok ? v.text : null])) })), null, 1));
console.log(`wrote ${path.join(outdir, 'blind.md')} and ratings.csv. Open the key only after rating.`);
