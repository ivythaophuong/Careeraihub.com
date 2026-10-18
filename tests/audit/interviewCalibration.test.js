// The harness that measures the deterministic interview Structure Score against human reviewers (docs/architecture/plans/D1-interview-structure-calibration-standard-2026-10-18.md).
// These tests check the HARNESS with invented rows and an injected scorer. They say nothing about how accurate the real scorer is.
import { describe, it, expect } from 'vitest';
import { spearman, cohenKappa, groundTruth, evaluate, CRITERIA } from '../../scripts/calibration/interviewCalibration.js';

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
      const good = i % 2 === 0;
      many.push(row(`${lang}${i}`, lang, good ? 88 : 20 + (i % 5), good ? ['complete', 'complete'] : ['incomplete', 'incomplete']));
    }
    const ok = evaluate(many, { score: fake });
    expect(ok.verdict).toBe('met');
    expect(ok.languages.en.meets).toMatchObject({ enoughAnswers: true, agreement: true, correlation: true, falsePass: true, falseFail: true });
  });
  it('fails a language that has a high false pass rate even if the other is fine', () => {
    const many = [];
    for (let i = 0; i < 60; i++) {
      many.push(row(`en${i}`, 'en', i % 2 ? 88 : 20, i % 2 ? ['complete', 'complete'] : ['incomplete', 'incomplete']));
      many.push(row(`vi${i}`, 'vi', 88, i % 2 ? ['complete', 'complete'] : ['incomplete', 'incomplete'])); // gives everything 88
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
