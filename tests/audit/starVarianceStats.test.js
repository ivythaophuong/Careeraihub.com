// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { summarize, spearman, mean, sd } from '../../scripts/audit/starVarianceStats.mjs';

const close = (a, b, d = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(d);

describe('basic statistics', () => {
  it('mean and sample standard deviation (n-1)', () => {
    expect(mean([2, 4, 6])).toBe(4);
    close(sd([2, 4, 6]), 2);
    expect(sd([5])).toBeNull();
    expect(sd([])).toBeNull();
    expect(mean([])).toBeNull();
  });
  it('Spearman: identical order is 1, reversed is -1, ties are handled', () => {
    close(spearman([1, 2, 3, 4], [10, 20, 30, 40]), 1);
    close(spearman([1, 2, 3, 4], [40, 30, 20, 10]), -1);
    expect(spearman([1, 1, 1], [1, 2, 3])).toBeNull(); // no variation on one side: undefined, not 0
    expect(spearman([1, 2], [1, 2])).not.toBeNull();
  });
});

// Two stories, three runs each. Overall: A = 40, 50, 60 ; B = 80, 80, 80.
const run = (storyId, overall, over = {}) => ({ storyId, ok: true, scores: { situation: overall, task: overall, action: overall, result: overall }, overall, ...over });
const RUNS = [run('A', 40), run('A', 50), run('A', 60), run('B', 80), run('B', 80), run('B', 80)];

describe('summarize', () => {
  const s = summarize(RUNS);
  it('per story: mean, sd, min, max and range of the overall score', () => {
    const a = s.stories.find((x) => x.storyId === 'A').overall;
    expect(a).toMatchObject({ n: 3, mean: 50, min: 40, max: 60, range: 20 });
    close(a.sd, 10);
    const b = s.stories.find((x) => x.storyId === 'B').overall;
    expect(b).toMatchObject({ n: 3, mean: 80, min: 80, max: 80, range: 0, sd: 0 });
  });
  it('the same statistics for each of the four sections', () => {
    for (const k of ['situation', 'task', 'action', 'result']) expect(s.stories[0].sections[k]).toMatchObject({ n: 3, mean: 50, range: 20 });
  });
  it('within-story spread (pooled) is separated from the spread between stories', () => {
    // within variance = mean(10^2, 0^2) = 50 ; between = sample variance of story means (50, 80) = 450
    close(s.overall.withinSd, Math.sqrt(50));
    close(s.overall.betweenSd, Math.sqrt(450));
    close(s.overall.withinShare, 50 / (50 + 450));
  });
  it('how stable the ordering of stories is from run to run', () => {
    // run 1: A=40 B=80 ; run 2: A=50 B=80 ; run 3: A=60 B=80 : every run orders A below B like the means do
    expect(s.overall.rankAgreement.mean).toBeGreaterThan(0.99);
  });
  it('failed runs are counted per story and never enter the statistics', () => {
    const withFail = summarize([...RUNS, { storyId: 'A', ok: false, error: 'busy' }]);
    const a = withFail.stories.find((x) => x.storyId === 'A');
    expect(a.failures).toBe(1);
    expect(a.overall.n).toBe(3);
    expect(withFail.totalFailures).toBe(1);
  });
  it('with fewer than two valid runs there is no sd or range claim, only the count', () => {
    const one = summarize([run('A', 40)]);
    expect(one.stories[0].overall).toMatchObject({ n: 1, mean: 40, sd: null });
  });
  it('says what it cannot say: stability is not accuracy', () => {
    expect(s.note).toMatch(/stability/i);
    expect(s.note).toMatch(/not.*(accuracy|valid)/i);
  });
});
