// Calibration harness for the deterministic interview Structure Score (docs/architecture/plans/D1-interview-structure-calibration-standard-2026-10-18.md).
// It compares what the rules say with what human reviewers say, per language. Pure JS: no model, network or database.
// It measures the scorer; it never changes it. The thresholds in CRITERIA are PROPOSALS until the owner approves them.
import { scoreInterviewAnswer } from '../../supabase/functions/_shared/structure/interviewStructure.js';

export const LABELS = Object.freeze(['incomplete', 'partial', 'complete']); // what a reviewer says about the STRUCTURE of the answer
const NUM = { incomplete: 0, partial: 1, complete: 2 };

export const CRITERIA = Object.freeze({
  status: 'proposed',
  minAnswersPerLanguage: 50,   // answers with an agreed human label, per language (the 50 reviewed STAR stories do not count for interviews)
  minRaters: 2,                // independent reviewers per answer
  minPerLabel: 10,             // agreed answers per human label, per language: a set of easy cases must not pass
  minPairwiseAgreement: 0.7,   // share of reviewer pairs that give the same label
  minKappa: 0.4,               // chance-corrected agreement: percent alone is high when one label dominates
  minSpearman: 0.5,            // rank correlation between the score and the human label
  maxFalsePassRate: 0.10,      // human "incomplete" answers that the rules score 80 or more
  maxFalseFailRate: 0.10,      // human "complete" answers that the rules score below 50
  passFrom: 80, failBelow: 50, // the same bands as contract.js outcomeFor
});

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const ranks = (v) => {
  const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(v.length);
  for (let i = 0; i < idx.length;) {
    let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = avg; i = j + 1;
  }
  return r;
};

// Spearman rank correlation. null when it cannot be computed (fewer than 3 pairs, or no variation on one side).
export function spearman(xs, ys) {
  if (!Array.isArray(xs) || xs.length !== ys.length || xs.length < 3) return null;
  const a = ranks(xs), b = ranks(ys), ma = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da === 0 || db === 0 ? null : num / Math.sqrt(da * db);
}

// Wilson score interval (95 percent) for a rate of hits out of n. Small samples make rates swing, so every rate is shown with its range.
export function wilson(hits, n, z = 1.96) {
  if (!n) return null;
  const p = hits / n, d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d, half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

// Cohen's kappa over pairs of labels [a, b]. null when there is nothing to compare, or the labels carry no information.
export function cohenKappa(pairs) {
  if (!pairs.length) return null;
  const n = pairs.length, cats = [...new Set(pairs.flat())];
  const po = pairs.filter(([a, b]) => a === b).length / n;
  const pe = cats.reduce((s, c) => s + (pairs.filter(([a]) => a === c).length / n) * (pairs.filter(([, b]) => b === c).length / n), 0);
  return pe === 1 ? null : (po - pe) / (1 - pe);
}

// The human label of one answer: the majority of the known labels. No majority (every reviewer differs) is a disagreement, not a label.
export function groundTruth(ratings) {
  const known = (ratings || []).filter((r) => LABELS.includes(r?.label));
  if (!known.length) return { label: null, raters: 0, disagreement: false };
  const counts = LABELS.map((l) => [l, known.filter((r) => r.label === l).length]).sort((a, b) => b[1] - a[1]);
  const top = counts[0], tie = counts[1][1] === top[1];
  if (known.length >= 2 && tie) return { label: null, raters: known.length, disagreement: true };
  return { label: top[0], raters: known.length, disagreement: false };
}

const pairwiseAgreement = (rows) => {
  let agree = 0, total = 0;
  for (const r of rows) { const l = (r.ratings || []).map((x) => x.label).filter((x) => LABELS.includes(x)); for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) { total++; if (l[i] === l[j]) agree++; } }
  return total ? agree / total : null;
};
const kappaOf = (rows) => {
  const pairs = [];
  for (const r of rows) { const l = (r.ratings || []).map((x) => x.label).filter((x) => LABELS.includes(x)); for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) pairs.push([l[i], l[j]]); }
  return cohenKappa(pairs);
};

// rows: [{ id, language: 'en'|'vi', question, answer, ratings: [{ rater, label }] }]. The whole row is given to the scorer (an injected scorer may read more).
// Calibration exists to decide whether a language may be enabled, so the default scorer here switches both languages ON for the run only. The product's own
// gate (ENABLED_LANGUAGES in languageGate.js) is not touched: today it is empty, so the product scores nothing until a language passes.
const scoreWithLanguagesOn = (input) => scoreInterviewAnswer(input, { enabledLanguages: ['en', 'vi'] });

export function evaluate(rows, { score = scoreWithLanguagesOn, criteria = CRITERIA } = {}) {
  const byLang = {};
  for (const row of rows) { const l = row.language || 'unknown'; (byLang[l] ||= []).push(row); }
  const languages = {};
  for (const [lang, list] of Object.entries(byLang)) {
    const excluded = { insufficient_data: 0, unsupported_language: 0, processing_error: 0 };
    let disagreements = 0, singleRater = 0, withTruth = 0;
    const agreedLabels = { incomplete: 0, partial: 0, complete: 0 };
    const scored = [];
    for (const row of list) {
      const truth = groundTruth(row.ratings);
      if (truth.disagreement) disagreements++;
      if (truth.raters === 1) singleRater++;
      if (truth.label === null || truth.raters < criteria.minRaters) continue; // a single reviewer is not an agreed label
      withTruth++; agreedLabels[truth.label]++;
      const res = score(row);
      if (res?.status !== 'scored') { excluded[res?.status] = (excluded[res?.status] || 0) + 1; continue; }
      scored.push({ id: row.id, score: res.score, label: truth.label });
    }
    const inClass = (label) => scored.filter((s) => s.label === label);
    const fp = inClass('incomplete').filter((s) => s.score >= criteria.passFrom);
    const ff = inClass('complete').filter((s) => s.score < criteria.failBelow);
    const rate = (hit, of) => (of.length ? hit.length / of.length : null);
    const agreement = { pairwise: pairwiseAgreement(list), kappa: kappaOf(list) };
    const rho = spearman(scored.map((s) => s.score), scored.map((s) => NUM[s.label]));
    const falsePass = { count: fp.length, of: inClass('incomplete').length, rate: rate(fp, inClass('incomplete')), ci95: wilson(fp.length, inClass('incomplete').length), ids: fp.map((s) => s.id) };
    const falseFail = { count: ff.length, of: inClass('complete').length, rate: rate(ff, inClass('complete')), ci95: wilson(ff.length, inClass('complete').length), ids: ff.map((s) => s.id) };
    const labelCounts = { ...agreedLabels };
    const meets = {
      enoughAnswers: withTruth >= criteria.minAnswersPerLanguage,
      labelBalance: LABELS.every((l) => labelCounts[l] >= criteria.minPerLabel),
      agreement: agreement.pairwise !== null && agreement.pairwise >= criteria.minPairwiseAgreement,
      kappa: agreement.kappa !== null && agreement.kappa >= criteria.minKappa,
      correlation: rho !== null && rho >= criteria.minSpearman,
      falsePass: falsePass.rate !== null && falsePass.rate <= criteria.maxFalsePassRate,
      falseFail: falseFail.rate !== null && falseFail.rate <= criteria.maxFalseFailRate,
    };
    languages[lang] = { n: list.length, withTruth, labelCounts, scored: scored.length, disagreements, singleRater, excluded, agreement, spearman: rho, falsePass, falseFail, meets };
  }
  const langs = Object.values(languages);
  const verdict = !langs.length || langs.some((l) => !l.meets.enoughAnswers) ? 'insufficient_sample'
    : langs.every((l) => Object.values(l.meets).every(Boolean)) ? 'met' : 'not_met';
  return { criteria, languages, verdict };
}
