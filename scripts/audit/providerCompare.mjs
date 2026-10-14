// Compares AI providers on ONE job: reading a resume into JSON with the production prompt (buildParsePrompt), on the 36 synthetic resumes whose
// answers are known (tests/fixtures/extraction-accuracy). Sends only invented data. Keys come from the environment and are never printed or written.
//
//   npx vite-node scripts/audit/providerCompare.mjs --providers groq,gemini [--limit 36] [--delay 2500] [--out results.json]
//   npx vite-node scripts/audit/providerCompare.mjs --dry-run        (no network, no keys: checks the scoring with a pretend provider)
// Needs GROQ_API_KEY / GEMINI_API_KEY ... in your own shell (never paste a key into a chat). See scripts/audit/README.md for cost and limits.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseModelJson, scoreExtraction as scoreCase } from './modelEvalCore.mjs';

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i === -1 ? def : (process.argv[i + 1] ?? true); };
const repo = fileURLToPath(new URL('../..', import.meta.url));
const dry = process.argv.includes('--dry-run');
const providers = String(arg('providers', 'groq,gemini')).split(',').map((s) => s.trim()).filter(Boolean);
const limit = Number(arg('limit', 36));
const delay = Number(arg('delay', 2500));
const outFile = arg('out', null);
const TODAY = '2026-10-14';
const imp = (p) => import(pathToFileURL(path.join(repo, p)).href);

const { CASES } = await imp('tests/fixtures/extraction-accuracy/cases.js');
const { CASES_B } = await imp('tests/fixtures/extraction-accuracy/casesB.js');
const { CASES_C } = await imp('tests/fixtures/extraction-accuracy/casesC.js');
const { buildParsePrompt } = await imp('src/features/ATSBuilder/parsePrompt.js');
const { callProviderDetailed, DEFAULT_MODELS, KEY_ENV } = await imp('supabase/functions/ai/providers.js');
const all = [...CASES, ...CASES_B, ...CASES_C].slice(0, limit);

// ── providers ──
const pretend = async ({ c }) => { // a pretend model for --dry-run: returns the right answer, with one deliberate mistake on every 3rd case
  const e = c.expect, bad = c.id.length % 3 === 0;
  return JSON.stringify({ name: bad ? 'Wrong Name' : e.name, email: e.email, phone: e.phone, workExperience: e.experiences.map((x) => ({ title: x.title, company: x.company, period: `${x.start} - ${x.end}` })), education: e.education.map((x) => ({ institution: x.institution, degree: '', year: x.year })), skills: e.skills });
};

async function callOne(provider, c) {
  const messages = [{ role: 'user', content: buildParsePrompt(c.text, TODAY) }];
  const started = Date.now();
  try {
    let text;
    if (dry) text = await pretend({ c });
    else {
      const key = process.env[KEY_ENV[provider]];
      if (!key) throw Object.assign(new Error(`no ${KEY_ENV[provider]} in the environment`), { kind: 'no_key' });
      text = (await callProviderDetailed({ provider, model: DEFAULT_MODELS[provider], key, messages, maxTokens: 4000 }, fetch, 80_000)).text;
    }
    return { ok: true, text, ms: Date.now() - started };
  } catch (e) {
    const key = process.env[KEY_ENV[provider]] || '';
    const msg = String(e?.message ?? '').split(key || '\u0000').join('[key]').replace(/AIza[0-9A-Za-z_-]{20,}|gsk_[0-9A-Za-z]{20,}/g, '[key]').slice(0, 300);
    return { ok: false, kind: e?.kind ?? 'unknown', status: e?.status ?? null, message: msg, ms: Date.now() - started };
  }
}

const results = [];
for (const c of all) {
  for (const p of (dry ? ['pretend'] : providers)) {
    const r = await callOne(p, c);
    const parsed = r.ok ? parseModelJson(r.text) : null;
    results.push({ case: c.id, provider: p, ok: r.ok, errorKind: r.ok ? null : r.kind, httpStatus: r.ok ? null : r.status, message: r.ok ? null : r.message, ms: r.ms, validJson: !!parsed, rows: parsed ? scoreCase(c, parsed) : [] });
    if (!dry) await new Promise((res) => setTimeout(res, delay));
  }
}

// ── report ──
const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);
const lines = [];
const names = [...new Set(results.map((r) => r.provider))];
lines.push(`| provider | calls | call errors | valid JSON | fields scored | correct | wrong | missing | median ms |`, `|---|---|---|---|---|---|---|---|---|`);
for (const p of names) {
  const rs = results.filter((r) => r.provider === p);
  const rows = rs.flatMap((r) => r.rows);
  const n = (s) => rows.filter((x) => x.status === s).length;
  const pct = (k) => (rows.length ? `${k} (${Math.round((k / rows.length) * 100)}%)` : '-');
  lines.push(`| ${p} | ${rs.length} | ${rs.filter((r) => !r.ok).length} | ${rs.filter((r) => r.validJson).length} | ${rows.length} | ${pct(n('correct'))} | ${pct(n('wrong'))} | ${pct(n('missing'))} | ${median(rs.filter((r) => r.ok).map((r) => r.ms))} |`);
}
const errs = {};
results.filter((r) => !r.ok).forEach((r) => { const k = `${r.provider}: ${r.errorKind}${r.httpStatus ? ' ' + r.httpStatus : ''}`; errs[k] = (errs[k] || 0) + 1; });
lines.push('', 'call errors by kind: ' + (Object.keys(errs).length ? JSON.stringify(errs) : 'none'));
const byField = {};
for (const p of names) for (const r of results.filter((x) => x.provider === p)) for (const row of r.rows) { const k = `${p} | ${row.field}`; byField[k] ??= { correct: 0, wrong: 0, missing: 0 }; byField[k][row.status]++; }
lines.push('', '| provider \\| field | correct | wrong | missing |', '|---|---|---|---|', ...Object.entries(byField).map(([k, v]) => `| ${k} | ${v.correct} | ${v.wrong} | ${v.missing} |`));
console.log(lines.join('\n'));
const firstMsg = {}; results.filter((r) => !r.ok && r.message).forEach((r) => { firstMsg[r.provider] ??= r.message; });
if (Object.keys(firstMsg).length) console.log('\nfirst error message per provider:', JSON.stringify(firstMsg, null, 1));
if (outFile) fs.writeFileSync(String(outFile), JSON.stringify({ today: TODAY, models: Object.fromEntries(providers.map((p) => [p, DEFAULT_MODELS[p]])), results }, null, 1));
