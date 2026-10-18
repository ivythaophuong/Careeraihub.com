// The harness that measures the deterministic interview Structure Score against human reviewers (docs/architecture/plans/D1-interview-structure-calibration-standard-2026-10-18.md).
// These tests check the HARNESS with invented rows and an injected scorer. They say nothing about how accurate the real scorer is.
import { describe, it, expect } from 'vitest';
import { spearman, cohenKappa, groundTruth, evaluate, wilson, CRITERIA } from '../../scripts/calibration/interviewCalibration.js';

const fake = (input) => (input.status ? { status: input.status } : { status: 'scored', score: input.fake, language: input.language });
const R = (...labels) => labels.map((label, i) => ({ rater: `r${i + 1}`, label }));
const row = (id, language, fakeScore, labels, extra = {}) => ({ id, language, question: 'Q', answer: 'A', fake: fakeScore, ratings: R(...labels), ...extra });

describe('spearman', () => {
  it('is 1 for the same order, -1 for the reverse, and handles ties', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1);
    expect(spearman([1, 1, 2, 2], [1, 2, 3, 4])).toBeGreaterThan(0.8);
  });
  it('is null when it cannot be computed (fewer than 3 pairs or no variation)', () => {
    expect(spearman([1, 2], [1, 2])).toBeNull();
    expect(spearman([1, 1, 1], [1, 2, 3])).toBeNull();
  });
});

describe('cohenKappa', () => {
  it('is 1 for perfect agreement and about 0 for chance level', () => {
    expect(cohenKappa([['a', 'a'], ['b', 'b'], ['c', 'c'], ['a', 'a']])).toBeCloseTo(1);
    expect(cohenKappa([['a', 'b'], ['b', 'a'], ['a', 'a'], ['b', 'b']])).toBeCloseTo(0);
  });
  it('is null when there is nothing to compare', () => { expect(cohenKappa([])).toBeNull(); });
});

describe('groundTruth', () => {
  it('takes the majority label, and says when the reviewers did not agree', () => {
    expect(groundTruth(R('complete', 'complete', 'partial'))).toMatchObject({ label: 'complete', raters: 3 });
    expect(groundTruth(R('complete', 'partial', 'incomplete'))).toMatchObject({ label: null, disagreement: true });
    expect(groundTruth(R('complete'))).toMatchObject({ label: 'complete', raters: 1 });
  });
  it('ignores unknown labels', () => { expect(groundTruth([{ rater: 'a', label: 'great' }]).label).toBeNull(); });
});

describe('evaluate', () => {
  const rows = [
    row('e1', 'en', 90, ['complete', 'complete']), row('e2', 'en', 85, ['incomplete', 'incomplete']), // a misleading high score
    row('e3', 'en', 30, ['complete', 'complete']),                                                   // a false fail
    row('e4', 'en', 60, ['partial', 'partial']), row('e5', 'en', 20, ['incomplete', 'incomplete']),
    row('e6', 'en', 50, ['complete', 'partial', 'incomplete']),                                      // reviewers disagree
    row('v1', 'vi', 40, ['partial', 'partial']), row('v2', 'vi', 95, ['complete', 'complete']),
    { ...row('v3', 'vi', 0, ['complete', 'complete']), status: 'insufficient_data' },                // not scored by the rules
  ];
  const rep = evaluate(rows, { score: fake });

  it('reports each language apart, never one blended average', () => {
    expect(Object.keys(rep.languages).sort()).toEqual(['en', 'vi']);
    expect(rep.languages.en.n).toBe(6); expect(rep.languages.vi.n).toBe(3);
  });
  it('counts answers the rules did not score, and reviewer disagreements, instead of hiding them', () => {
    expect(rep.languages.vi.excluded.insufficient_data).toBe(1);
    expect(rep.languages.en.disagreements).toBe(1);
  });
  it('lists the misleading high scores and the false fails by id', () => {
    expect(rep.languages.en.falsePass.ids).toEqual(['e2']);
    expect(rep.languages.en.falseFail.ids).toEqual(['e3']);
    expect(rep.languages.en.falsePass.rate).toBeCloseTo(0.5); // of the two human "incomplete" answers that were scored
  });
  it('measures agreement between reviewers', () => {
    expect(rep.languages.en.agreement.pairwise).toBeGreaterThan(0.5);
    expect(rep.languages.vi.agreement.pairwise).toBe(1);
  });
  it('says "insufficient sample" instead of a pass when there are too few answers', () => {
    expect(rep.verdict).toBe('insufficient_sample');
    expect(rep.languages.en.meets.enoughAnswers).toBe(false);
  });
  it('never turns a single reviewer into a ground truth that counts toward the sample', () => {
    const one = evaluate([row('s1', 'en', 80, ['complete'])], { score: fake });
    expect(one.languages.en.singleRater).toBe(1);
    expect(one.languages.en.withTruth).toBe(0);
  });
  it('can reach a verdict when the sample and the criteria are met', () => {
    const many = [];
    for (let i = 0; i < 60; i++) for (const lang of ['en', 'vi']) {
      const kind = i % 3; // complete, partial, incomplete in equal parts
      many.push(row(`${lang}${i}`, lang, kind === 0 ? 88 : kind === 1 ? 62 : 20 + (i % 5), kind === 0 ? ['complete', 'complete'] : kind === 1 ? ['partial', 'partial'] : ['incomplete', 'incomplete']));
    }
    const ok = evaluate(many, { score: fake });
    expect(ok.verdict).toBe('met');
    expect(ok.languages.en.meets).toMatchObject({ enoughAnswers: true, labelBalance: true, agreement: true, kappa: true, correlation: true, falsePass: true, falseFail: true });
  });
  it('fails a language that has a high false pass rate even if the other is fine', () => {
    const many = [];
    for (let i = 0; i < 60; i++) {
      const kind = i % 3;
      const labels = kind === 0 ? ['complete', 'complete'] : kind === 1 ? ['partial', 'partial'] : ['incomplete', 'incomplete'];
      many.push(row(`en${i}`, 'en', kind === 0 ? 88 : kind === 1 ? 62 : 20, labels));
      many.push(row(`vi${i}`, 'vi', 88, labels)); // gives everything 88
    }
    const bad = evaluate(many, { score: fake });
    expect(bad.verdict).toBe('not_met');
    expect(bad.languages.vi.meets.falsePass).toBe(false);
    expect(bad.languages.en.meets.falsePass).toBe(true);
  });
  it('the criteria are exported and are proposals until the owner approves them', () => {
    expect(CRITERIA.minAnswersPerLanguage).toBeGreaterThanOrEqual(50);
    expect(CRITERIA.status).toBe('proposed');
  });
});


describe('wilson interval (small samples make rates swing, so every rate comes with its range)', () => {
  it('gives the known 95 percent interval', () => {
    const [lo, hi] = wilson(0, 10); expect(lo).toBeCloseTo(0, 3); expect(hi).toBeCloseTo(0.278, 2);
    const [l2, h2] = wilson(5, 10); expect(l2).toBeCloseTo(0.237, 2); expect(h2).toBeCloseTo(0.763, 2);
  });
  it('is null when there is no denominator', () => { expect(wilson(0, 0)).toBeNull(); });
  it('is narrower with more answers', () => {
    const a = wilson(5, 10), b = wilson(50, 100);
    expect(b[1] - b[0]).toBeLessThan(a[1] - a[0]);
  });
});

describe('the report shows counts, denominators, ranges and the label mix', () => {
  const rows = [];
  for (let i = 0; i < 12; i++) rows.push(row(`en${i}`, 'en', 90, ['incomplete', 'incomplete'])); // every incomplete answer is scored high
  for (let i = 0; i < 4; i++) rows.push(row(`enc${i}`, 'en', 90, ['complete', 'complete']));
  const rep = evaluate(rows, { score: fake });
  it('gives the failure count, the denominator, the rate and its 95 percent range', () => {
    expect(rep.languages.en.falsePass).toMatchObject({ count: 12, of: 12, rate: 1 });
    expect(rep.languages.en.falsePass.ci95).toHaveLength(2);
  });
  it('shows how many answers carry each human label', () => {
    expect(rep.languages.en.labelCounts).toEqual({ incomplete: 12, partial: 0, complete: 4 });
  });
  it('does not let a set of easy cases pass: every label needs a minimum number of answers', () => {
    expect(rep.languages.en.meets.labelBalance).toBe(false);
    expect(CRITERIA.minPerLabel).toBeGreaterThanOrEqual(10);
  });
});

describe('answers the rules cannot score are never turned into a zero', () => {
  it('keeps unsupported_language, insufficient_data and errors out of every metric, and counts each apart', () => {
    const base = [];
    for (let i = 0; i < 6; i++) base.push(row(`g${i}`, 'en', 90, ['complete', 'complete']), row(`b${i}`, 'en', 10, ['incomplete', 'incomplete']));
    const clean = evaluate(base, { score: fake }).languages.en;
    const noisy = evaluate([...base,
      { ...row('u1', 'en', 0, ['complete', 'complete']), status: 'unsupported_language' },
      { ...row('i1', 'en', 0, ['complete', 'complete']), status: 'insufficient_data' },
      { ...row('p1', 'en', 0, ['complete', 'complete']), status: 'processing_error' },
    ], { score: fake }).languages.en;
    expect(noisy.excluded).toEqual({ insufficient_data: 1, unsupported_language: 1, processing_error: 1 });
    expect(noisy.falseFail).toEqual(clean.falseFail);           // a zero would have made three false fails
    expect(noisy.spearman).toBeCloseTo(clean.spearman);
    expect(noisy.scored).toBe(clean.scored);
  });
});

describe('kappa is a criterion as well as percent agreement', () => {
  it('fails agreement when percent is high but kappa is low (one label dominates)', () => {
    const rows = [];
    for (let i = 0; i < 60; i++) rows.push(row(`k${i}`, 'en', 50, i < 54 ? ['complete', 'complete'] : ['complete', 'incomplete']));
    const rep = evaluate(rows, { score: fake }).languages.en;
    expect(rep.agreement.pairwise).toBeGreaterThan(0.85);
    expect(rep.meets.kappa).toBe(false);
  });
  it('the criteria carry a kappa threshold', () => { expect(CRITERIA.minKappa).toBeGreaterThan(0); });
});

describe('with the real scorer', () => {
  it('scores with both languages switched on for the run, although the product gate is closed', async () => {
    const { ENABLED_LANGUAGES } = await import('../../supabase/functions/_shared/structure/languageGate.js');
    expect(ENABLED_LANGUAGES).toEqual([]); // the product scores nothing until a language passes its acceptance tests
    const rep = evaluate([{ id: 'g1', language: 'en', question: 'Tell me about a time you led a project.', answer: 'I led a migration of our checkout flow, split the work into phases and shipped it in six weeks, cutting errors by 30 percent.', ratings: R('complete', 'complete') }]);
    expect(rep.languages.en.scored).toBe(1);
  });
  it('runs without error on real-shaped rows (no claim about accuracy)', () => {
    const rep = evaluate([{ id: 'x1', language: 'en', question: 'Tell me about a time you led a project.', answer: 'I led a migration of our checkout flow, split the work into phases and shipped it in six weeks, cutting errors by 30 percent.', ratings: R('complete', 'complete') }]);
    expect(rep.languages.en.n).toBe(1);
  });
});
