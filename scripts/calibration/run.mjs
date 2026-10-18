// Usage: node scripts/calibration/run.mjs <rows.json>
// rows.json: an array of { id, language: "en"|"vi", question, answer, ratings: [{ rater, label: "complete"|"partial"|"incomplete" }] }.
// Keep real answers OUTSIDE the repository (they are personal data). The file scripts/calibration/template.json holds invented rows to show the shape only.
import fs from 'node:fs';
import { evaluate } from './interviewCalibration.js';

const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/calibration/run.mjs <rows.json>'); process.exit(2); }
const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
const rep = evaluate(rows);
const pct = (x) => (x === null ? 'n/a' : `${Math.round(x * 100)}%`);
const rng = (c) => (c ? `${Math.round(c[0] * 100)}% to ${Math.round(c[1] * 100)}%` : 'n/a');
const num = (x) => (x === null ? 'n/a' : x.toFixed(2));
console.log(`Criteria status: ${rep.criteria.status} (proposals until the owner approves them)\n`);
for (const [lang, l] of Object.entries(rep.languages)) {
  console.log(`== ${lang}: ${l.n} answers, ${l.withTruth} with an agreed human label, ${l.scored} scored by the rules`);
  console.log(`   not scored: ${JSON.stringify(l.excluded)}; reviewers disagree on ${l.disagreements}; single reviewer ${l.singleRater}`);
  console.log(`   human labels (agreed answers): ${JSON.stringify(l.labelCounts)}`);
  console.log(`   reviewer agreement ${pct(l.agreement.pairwise)}, kappa ${num(l.agreement.kappa)}; Spearman(score, human) ${num(l.spearman)} (an indicator, not a decision on its own)`);
  console.log(`   misleading high (human incomplete, score >= 80): ${l.falsePass.count}/${l.falsePass.of} = ${pct(l.falsePass.rate)} (95% range ${rng(l.falsePass.ci95)}) ${l.falsePass.ids.join(',')}`);
  console.log(`   false fail (human complete, score < 50): ${l.falseFail.count}/${l.falseFail.of} = ${pct(l.falseFail.rate)} (95% range ${rng(l.falseFail.ci95)}) ${l.falseFail.ids.join(',')}`);
  console.log(`   meets: ${JSON.stringify(l.meets)}\n`);
}
console.log(`SCREENING RESULT: ${rep.verdict}. This is not an approval: small samples give wide ranges, and the owner decides after reading the whole report.`);
process.exit(rep.verdict === 'met' ? 0 : 1);
