// @vitest-environment node
// The pure part of scripts/audit/*: scoring a model's reading of a resume, the blind order, cost, and the numbers of the rewrite test. No network, no keys.
import { describe, it, expect } from 'vitest';
import { MODEL_REGISTRY, median, costUsd, parseModelJson, scoreExtraction, balancedOrders, rewriteStats, renderRewriteTable } from '../../scripts/audit/modelEvalCore.mjs';
import { CASES } from '../fixtures/extraction-accuracy/cases.js';
import { WEAK_RESUMES, WEAK_RESUME_DATA } from '../fixtures/model-eval/weakResumes.js';
import { JD, ANSWERS, LETTER } from '../fixtures/model-eval/blindTasks.js';

describe('median and cost', () => {
  it('median of a list, null for none', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([])).toBeNull();
  });
  it('cost is tokens times the price per million, or null when the provider reported nothing', () => {
    expect(costUsd({ input: 1000, output: 2000 }, [0.10, 0.50])).toBeCloseTo(0.0011, 10);
    expect(costUsd(null, [1, 1])).toBeNull();
    expect(costUsd({ input: 10, output: NaN }, [1, 1])).toBeNull();
    expect(costUsd({ input: 10, output: 10 }, undefined)).toBeNull();
  });
  it('every registered model has a provider, a model name and a [in, out] price', () => {
    for (const m of Object.values(MODEL_REGISTRY)) {
      expect(m.id && m.provider && m.model).toBeTruthy();
      expect(m.price).toHaveLength(2);
      expect(m.price.every((x) => x > 0)).toBe(true);
    }
  });
});

describe('parseModelJson', () => {
  it('reads plain JSON, a fenced block and JSON with text around it', () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseModelJson('Here it is: {"a":1} Thanks.')).toEqual({ a: 1 });
  });
  it('is null for broken JSON, no object, empty and undefined', () => {
    expect(parseModelJson('{"a":')).toBeNull();
    expect(parseModelJson('no json here')).toBeNull();
    expect(parseModelJson('')).toBeNull();
    expect(parseModelJson(undefined)).toBeNull();
  });
});

describe('scoreExtraction: a model reading a resume, against the known answers', () => {
  const c = CASES[0];
  const e = c.expect;
  const perfect = () => ({
    name: e.name, email: e.email, phone: e.phone,
    workExperience: e.experiences.map((x) => ({ title: x.title, company: x.company, period: `${x.start} - ${x.end}` })),
    education: e.education.map((x) => ({ institution: x.institution, degree: '', year: x.year })),
    skills: e.skills,
  });
  const tally = (rows) => rows.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {});
  it('a perfect answer scores every field correct', () => {
    const t = tally(scoreExtraction(c, perfect()));
    expect(t.wrong).toBeUndefined();
    expect(t.missing).toBeUndefined();
    expect(t.correct).toBeGreaterThan(10);
  });
  it('a wrong name is wrong, an absent email is missing, and nothing else changes', () => {
    const a = perfect(); a.name = 'Someone Else'; delete a.email;
    const rows = scoreExtraction(c, a);
    expect(rows.find((r) => r.field === 'name').status).toBe('wrong');
    expect(rows.find((r) => r.field === 'email').status).toBe('missing');
    expect(tally(rows).wrong).toBe(1);
  });
  it('a phone number is compared by its digits, an email without case', () => {
    const a = perfect(); a.phone = '+65 5555 0100'; a.email = e.email.toUpperCase();
    const rows = scoreExtraction(c, a);
    expect(rows.find((r) => r.field === 'phone').status).toBe('correct');
    expect(rows.find((r) => r.field === 'email').status).toBe('correct');
  });
  it('an empty answer is missing for every field the case has', () => {
    const rows = scoreExtraction(c, {});
    expect(rows.filter((r) => r.field !== 'experience count').every((r) => r.status === 'missing' || r.status === 'correct')).toBe(true);
    expect(rows.find((r) => r.field === 'name').status).toBe('missing');
    expect(rows.find((r) => r.field === 'experience count').status).toBe('wrong');   // 0 jobs given, some expected: a wrong count, not a missing one
  });
});

describe('balancedOrders: which model is shown first, second, third', () => {
  const positions = (orders, m) => Array.from({ length: m }, (_, pos) => Array.from({ length: m }, (_, model) => orders.filter((o) => o[pos] === model).length));
  it('every order is a permutation of the models', () => {
    for (const o of balancedOrders(10, 3)) expect([...o].sort()).toEqual([0, 1, 2]);
  });
  it('each model stands in each position about equally often (10 tasks, 3 models: 2 to 4 times)', () => {
    for (const row of positions(balancedOrders(10, 3), 3)) for (const n of row) { expect(n).toBeGreaterThanOrEqual(2); expect(n).toBeLessThanOrEqual(4); }
  });
  it('with a multiple of the permutations, exactly equally often', () => {
    for (const row of positions(balancedOrders(12, 3), 3)) expect(row).toEqual([4, 4, 4]);
  });
  it('the same seed gives the same orders, another seed another order', () => {
    expect(balancedOrders(10, 3, 1)).toEqual(balancedOrders(10, 3, 1));
    expect(balancedOrders(10, 3, 1)).not.toEqual(balancedOrders(10, 3, 2));
  });
  it('works for two models and for no tasks', () => {
    expect(balancedOrders(4, 2).map((o) => o.join(''))).toHaveLength(4);
    expect(balancedOrders(0, 3)).toEqual([]);
  });
});

describe('rewriteStats: the numbers of the rewrite test from saved rows', () => {
  const model = { id: 'm', price: [1, 2] };
  const issue = (over) => ({ before: 'Helped customers', after: 'Helped customers find products', evidence: [], unsupported: [], invented_numbers: [], claims: [], ...over });
  const row = (over) => ({ model: 'm', ok: true, error: null, ms: 1000, validJson: true, input: 1000, output: 500, issues: [issue()], ...over });
  it('counts suggestions, calls and the cost from the tokens the provider reported', () => {
    const s = rewriteStats([row(), row({ ok: false, error: 'upstream 401', issues: [], input: null, output: null, ms: 0 })], model);
    expect(s).toMatchObject({ calls: 2, ok: 1, suggestions: 1, errors: ['upstream 401'] });
    expect(s.costPerCall).toBeCloseTo((1000 * 1 + 500 * 2) / 1e6, 10);
    expect(s.medianMs).toBe(1000);
  });
  it('ignores another model\'s rows and suggestions with no rewrite', () => {
    const s = rewriteStats([row({ model: 'other' }), row({ issues: [issue({ after: '  ' })] })], model);
    expect(s.suggestions).toBe(0);
    expect(s.calls).toBe(1);
  });
  it('an invented figure counts, but "5+ years" worked out from the dates does not', () => {
    const s = rewriteStats([row({ issues: [
      issue({ after: 'Assisted 150+ customers daily', invented_numbers: ['150'] }),
      issue({ after: 'Sales associate with 5+ years of experience', invented_numbers: ['5'] }),
      issue({ after: 'Helped customers' }),
    ] })], model);
    expect(s.inventedFigures).toBe(1);
  });
  it('counts the word rules, each evidence warning and how often the model declared what the word rules caught', () => {
    const s = rewriteStats([row({ issues: [
      issue({ claims: [{ type: 'new_content', words: ['x'] }, { type: 'declared_addition', words: ['x'] }] }),
      issue({ claims: [{ type: 'ownership', words: ['led'] }] }),
      issue({ claims: [{ type: 'bad_evidence', words: ['q'] }] }),
      issue({ claims: [{ type: 'undeclared_addition', words: ['a', 'b'] }] }),
      issue({ after: 'Cut errors by [X]%' }),
    ] })], model);
    expect(s).toMatchObject({ suggestions: 5, wordRuleHits: 2, declaredAmongWordRuleHits: 1, badQuote: 1, declared: 1, undeclared: 1, anyEvidenceWarning: 3, withBlank: 1 });
  });
  it('counts the suggestions that carry the two evidence fields', () => {
    const s = rewriteStats([row({ issues: [issue({ evidence: ['a'], unsupported: [] }), issue({ evidence: undefined, unsupported: undefined })] })], model);
    expect(s).toMatchObject({ evidenceField: 1, unsupportedField: 1 });
  });
  it('renders one line per model and says n/a when no cost is known', () => {
    const out = renderRewriteTable([rewriteStats([row({ input: null, output: null })], model)]);
    expect(out.split('\n')).toHaveLength(3);
    expect(out).toMatch(/n\/a/);
  });
});

describe('the invented test data', () => {
  it('12 weak resumes, ids w01 to w12, no real-looking address', () => {
    expect(WEAK_RESUMES).toHaveLength(12);
    expect(WEAK_RESUMES.map((r) => r.id)[11]).toBe('w12');
    expect(WEAK_RESUME_DATA).toHaveLength(12);
    for (const r of WEAK_RESUMES) expect(r.text).toMatch(/@example\.com/);
    for (const r of WEAK_RESUMES) expect(r.text).not.toMatch(/@(gmail|yahoo|outlook|hotmail)\./i);
  });
  it('three job descriptions, three answers (weak, medium, strong) and a letter with the placeholder sign-off', () => {
    expect(JD).toHaveLength(3);
    expect(ANSWERS).toHaveLength(3);
    expect(LETTER).toContain('[Your Name]');
  });
});
