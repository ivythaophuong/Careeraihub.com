// The pure part of the model-evaluation scripts in this folder (providerCompare, blindTest, rewriteTest, rewriteReport): no network, no keys, no files.
// Kept apart so it can be tested (tests/audit/modelEvalCore.test.js). See scripts/audit/README.md for how to run the scripts and what they cost.

// Prices in USD per million tokens [input, output], READ FROM EACH PROVIDER'S OWN PRICING PAGE ON 2026-10-14 through a page-summarising tool. They go stale:
// check the pages again before you rely on a cost figure. The real cost of a call is computed from the tokens the provider reports (costUsd), not from these
// numbers alone. `provider` and `model` are what callProviderDetailed (supabase/functions/ai/providers.js) takes.
export const PRICES_READ_ON = '2026-10-14';
export const MODEL_REGISTRY = {
  groq:   { id: 'groq',   provider: 'groq',      model: 'openai/gpt-oss-120b', price: [0.15, 0.60] },
  haiku:  { id: 'haiku',  provider: 'anthropic', model: 'claude-haiku-5-5',    price: [0.10, 0.50] },
  luna:   { id: 'luna',   provider: 'openai',    model: 'gpt-6-luna',          price: [0.10, 0.50] },
  sonnet: { id: 'sonnet', provider: 'anthropic', model: 'claude-sonnet-5-5',   price: [2.00, 10.00] },
  sol:    { id: 'sol',    provider: 'openai',    model: 'gpt-6.1-sol',         price: [2.00, 10.00] },
};

export const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);

// What the provider reported (callProviderDetailed's `usage`: { input, output, thinking }) at the model's price. null when the provider reported nothing usable.
export function costUsd(usage, price) {
  if (!usage || !Number.isFinite(usage.input) || !Number.isFinite(usage.output) || !Array.isArray(price)) return null;
  return (usage.input * price[0] + usage.output * price[1]) / 1e6;
}

// The JSON object in a model's reply: tolerates a code fence and text around it. null when there is none.
export function parseModelJson(raw) {
  const t = String(raw ?? '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a === -1 || b <= a) return null;
  try { const o = JSON.parse(t.slice(a, b + 1)); return o && typeof o === 'object' ? o : null; } catch { return null; }
}

// ── reading a resume into JSON: score a model's answer against the known answers of a case (tests/fixtures/extraction-accuracy) ──
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9+#%./]+/g, ' ').trim();
const same = (a, b) => norm(a) === norm(b);
const contains = (hay, needle) => norm(hay).includes(norm(needle));
const digits = (s) => String(s ?? '').replace(/\D/g, '');
const yearOf = (s) => (String(s ?? '').match(/\b(19|20)\d{2}\b/) || [])[0] || null;

// Each scored field is 'correct', 'wrong' or 'missing' (an empty answer where the case has one). Same normalisation as tests/audit/extractionAccuracy.test.js.
export function scoreExtraction(c, got) {
  const rows = [];
  const add = (field, expected, value, ok) => {
    const empty = value == null || value === '';
    rows.push({ field, status: empty ? (expected == null ? 'correct' : 'missing') : ok ? 'correct' : 'wrong' });
  };
  const e = c.expect;
  add('name', e.name, got.name, same(e.name, got.name));
  if ('email' in e) add('email', e.email, got.email, String(got.email ?? '').toLowerCase().trim() === String(e.email ?? '').toLowerCase());
  if ('phone' in e) add('phone', e.phone, got.phone, digits(got.phone) === digits(e.phone));
  const xs = Array.isArray(got.workExperience) ? got.workExperience : [];
  add('experience count', String(e.experiences.length), String(xs.length), xs.length === e.experiences.length);
  e.experiences.forEach((w, i) => {
    const g = xs[i] || {};
    add('exp title', w.title, g.title, same(w.title, g.title));
    add('exp company', w.company, g.company, same(w.company, g.company));
    const per = String(g.period ?? '');
    const startOk = !w.start || (yearOf(per) && yearOf(per) === String(w.start).slice(0, 4));
    add('exp start year', w.start, per, startOk);
    const endOk = w.end === 'present' ? /present|current|now|ongoing/i.test(per) : (per.match(/\b(19|20)\d{2}\b/g) || []).includes(String(w.end).slice(0, 4));
    add('exp end', w.end, per, endOk);
  });
  const eds = Array.isArray(got.education) ? got.education : [];
  e.education.forEach((w, i) => {
    const g = eds[i] || {};
    const text = [g.institution, g.degree].filter(Boolean).join(' ');
    add('edu institution', w.institution, text, contains(text, w.institution));
    add('edu year', w.year, g.year || text, String(g.year ?? text).includes(String(w.year)));
  });
  const skills = [...(Array.isArray(got.skills) ? got.skills : []), ...(Array.isArray(got.topSkills) ? got.topSkills : [])].map(String);
  e.skills.forEach((w) => add('skill', w, skills.find((s) => same(s, w)) ?? null, true));
  return rows;
}

// ── blind comparison: which model is shown first, second, third in each task ──
// Every permutation of the models is used in turn (lexicographic order), cycling when there are more tasks than permutations, then the list is shuffled with a
// seeded generator, so each model stands in each position about equally often, the order cannot be guessed, and the same seed gives the same result.
export function balancedOrders(taskCount, modelCount, seed = 20261014) {
  const perms = [];
  const build = (prefix, rest) => { if (!rest.length) { perms.push(prefix); return; } rest.forEach((x, i) => build([...prefix, x], [...rest.slice(0, i), ...rest.slice(i + 1)])); };
  build([], Array.from({ length: modelCount }, (_, i) => i));
  const picks = Array.from({ length: taskCount }, (_, i) => perms[i % perms.length]);
  let s = seed; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let i = picks.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [picks[i], picks[j]] = [picks[j], picks[i]]; }
  return picks;
}

// ── rewrite test: numbers per model from the rows rewriteTest.mjs writes ──
// A row: { model, ok, error, ms, validJson, input, output, issues: [{ before, after, evidence, unsupported, invented_numbers, claims: [{ type, words }] }] }.
const WORD_RULES = new Set(['new_content', 'invented_link', 'invented_location', 'new_skill', 'new_term', 'result', 'ownership', 'scope']);
const EVIDENCE_RULES = new Set(['bad_evidence', 'declared_addition', 'undeclared_addition']);
const YEARS = /\b\d+\+?\s*(years?|yrs?)\b/gi;
const hasType = (i, types) => (i.claims || []).some((c) => (typeof types === 'string' ? c.type === types : types.has(c.type)));
// An invented figure that is not just "N years" worked out from the dates (numberGuard cannot do that arithmetic and reports it).
const inventedFigure = (i) => {
  const rest = String(i.after ?? '').replace(YEARS, '');
  return Array.isArray(i.invented_numbers) && i.invented_numbers.some((x) => rest.includes(x)) && /\d/.test(rest);
};

export function rewriteStats(rows, model) {
  const mine = rows.filter((r) => r.model === model.id);
  const iss = mine.flatMap((r) => r.issues || []).filter((i) => String(i.after ?? '').trim());
  const n = iss.length;
  const okRows = mine.filter((r) => r.ok);
  const withUsage = mine.filter((r) => Number.isFinite(r.input) && Number.isFinite(r.output));
  const wordHits = iss.filter((i) => hasType(i, WORD_RULES));
  const costs = withUsage.map((r) => costUsd({ input: r.input, output: r.output }, model.price));
  const outs = withUsage.map((r) => r.output);
  return {
    model: model.id,
    calls: mine.length,
    ok: okRows.length,
    validJson: mine.filter((r) => r.validJson).length,
    errors: [...new Set(mine.filter((r) => !r.ok).map((r) => r.error))],
    suggestions: n,
    evidenceField: iss.filter((i) => Array.isArray(i.evidence)).length,
    unsupportedField: iss.filter((i) => Array.isArray(i.unsupported)).length,
    inventedFigures: iss.filter(inventedFigure).length,
    withBlank: iss.filter((i) => String(i.after).includes('[X]')).length,
    wordRuleHits: wordHits.length,
    badQuote: iss.filter((i) => hasType(i, 'bad_evidence')).length,
    declared: iss.filter((i) => hasType(i, 'declared_addition')).length,
    undeclared: iss.filter((i) => hasType(i, 'undeclared_addition')).length,
    anyEvidenceWarning: iss.filter((i) => hasType(i, EVIDENCE_RULES)).length,
    declaredAmongWordRuleHits: wordHits.filter((i) => hasType(i, 'declared_addition')).length,
    medianMs: median(okRows.map((r) => r.ms)),
    avgOutputTokens: outs.length ? outs.reduce((a, b) => a + b, 0) / outs.length : null,
    maxOutputTokens: outs.length ? Math.max(...outs) : null,
    costPerCall: costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : null,
  };
}

const pct = (k, n) => (n ? `${k} (${Math.round((k / n) * 100)}%)` : '-');
export function renderRewriteTable(stats) {
  const out = ['| model | calls ok | valid JSON | suggestions | invented figure | word rules hit | bad quote | declared addition | undeclared | any evidence warning | median s | out tokens avg / max | $ per call |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const s of stats) {
    out.push(`| ${s.model} | ${s.ok}/${s.calls}${s.errors.length ? ' (' + s.errors.join(', ') + ')' : ''} | ${s.validJson} | ${s.suggestions} | ${pct(s.inventedFigures, s.suggestions)} | ${pct(s.wordRuleHits, s.suggestions)} | ${s.badQuote} | ${pct(s.declared, s.suggestions)} | ${s.undeclared} | ${pct(s.anyEvidenceWarning, s.suggestions)} | ${s.medianMs == null ? '-' : (s.medianMs / 1000).toFixed(1)} | ${s.avgOutputTokens == null ? '-' : `${Math.round(s.avgOutputTokens)} / ${s.maxOutputTokens}`} | ${s.costPerCall == null ? 'n/a' : s.costPerCall.toFixed(5)} |`);
  }
  return out.join('\n');
}
