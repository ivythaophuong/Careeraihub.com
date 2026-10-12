// Descriptive statistics for the STAR score variance measurement (docs/audits/STAR-VARIANCE-PROTOCOL.md). Pure: no network, no files.
// It describes how much the same story's score moves between runs. It does not say whether a score is accurate.

export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
// Sample standard deviation (n - 1). With fewer than two values there is no spread to speak of: null, not 0.
export const sd = (xs) => {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};
const variance = (xs) => (xs.length < 2 ? null : sd(xs) ** 2);

// Average ranks (ties share the mean of their positions).
function ranks(xs) {
  const idx = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(xs.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[idx[k][1]] = r;
    i = j + 1;
  }
  return out;
}
// Spearman rank correlation; null when either side has no variation (the correlation is undefined, not 0).
export function spearman(a, b) {
  if (a.length !== b.length || a.length < 2) return null;
  const ra = ranks(a), rb = ranks(b);
  const ma = mean(ra), mb = mean(rb);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < ra.length; i++) { num += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2; }
  if (da === 0 || db === 0) return null;
  return num / Math.sqrt(da * db);
}

const describe = (xs) => ({
  n: xs.length,
  mean: mean(xs),
  sd: sd(xs),
  min: xs.length ? Math.min(...xs) : null,
  max: xs.length ? Math.max(...xs) : null,
  range: xs.length ? Math.max(...xs) - Math.min(...xs) : null,
});

const SECTIONS = ['situation', 'task', 'action', 'result'];
const pick = (runs, f) => runs.map(f).filter((x) => Number.isFinite(x));

// Spread within the same story vs spread between stories, for one measure.
function decompose(byStory, f) {
  const groups = Object.values(byStory).map((rs) => pick(rs, f)).filter((g) => g.length);
  const within = mean(groups.map(variance).filter((v) => v !== null));
  const between = variance(groups.map(mean));
  return {
    withinSd: within === null ? null : Math.sqrt(within),
    betweenSd: between === null ? null : Math.sqrt(between),
    // The share of the total spread that is the same story moving between runs. Descriptive only: with about ten stories it is not a reliability coefficient.
    withinShare: within !== null && between !== null && within + between > 0 ? within / (within + between) : null,
  };
}

// How well the order of the stories in one run agrees with the order of their mean scores over all runs.
function rankAgreement(byStory, f) {
  const ids = Object.keys(byStory);
  const means = ids.map((id) => mean(pick(byStory[id], f)));
  const nRuns = Math.max(0, ...ids.map((id) => byStory[id].length));
  const values = [];
  for (let r = 0; r < nRuns; r++) {
    const row = ids.map((id) => f(byStory[id][r] ?? {}));
    if (row.every((x) => Number.isFinite(x))) { const c = spearman(row, means); if (c !== null) values.push(c); }
  }
  return { runsCompared: values.length, mean: mean(values), min: values.length ? Math.min(...values) : null };
}

// runs: [{ storyId, ok, scores: { situation, task, action, result }, overall }, { storyId, ok: false, error }]
export function summarize(runs) {
  const ok = runs.filter((r) => r.ok);
  const ids = [...new Set(runs.map((r) => r.storyId))];
  const byStory = Object.fromEntries(ids.map((id) => [id, ok.filter((r) => r.storyId === id)]));
  const stories = ids.map((id) => ({
    storyId: id,
    failures: runs.filter((r) => r.storyId === id && !r.ok).length,
    overall: describe(pick(byStory[id], (r) => r.overall)),
    sections: Object.fromEntries(SECTIONS.map((k) => [k, describe(pick(byStory[id], (r) => r.scores?.[k]))])),
  }));
  const measure = (f) => ({ ...decompose(byStory, f), rankAgreement: rankAgreement(byStory, f) });
  return {
    stories,
    totalRuns: runs.length,
    totalFailures: runs.length - ok.length,
    overall: measure((r) => r.overall),
    sections: Object.fromEntries(SECTIONS.map((k) => [k, measure((r) => r.scores?.[k])])),
    note: 'This describes stability: how much the same story\'s score moves between runs. It does not show that a score is accurate or predicts anything about a person (stability is not accuracy or validity). Roughly ten stories and a handful of runs each are enough to see a large spread, not to estimate a precise one.',
  };
}
