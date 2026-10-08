// P4: a deterministic, resume-intrinsic score from ResumeFacts (P2) and its validation (P3). No AI, no
// provider, no network, no raw document text, no JD. See docs/AI_ARCHITECTURE_CONTRACT.md.
//
// A contextual score that needs an outside input, such as how well a resume matches a target job
// description, is a DIFFERENT kind of score (score_type) with its own function and its own contract;
// this module only scores what the resume says about itself, never against anything external.
//
// Output matches src/contracts/scoreResult.js exactly. Unknown is never turned into zero: a part whose
// underlying facts are absent (no bullets extracted, no chronology to check) is null and listed in
// `missing`; the final score is the weighted average over the parts that WERE computed, so missing data
// reduces how much went into the score, not what the score says about what it did see.
import { bulletHasMetric } from '../extraction/metrics';

export const SCORE_TYPE = 'careeraihub_ats_readiness';
export const SCORE_VERSION = '1.0.0';

// Declared explicitly and versioned with SCORE_VERSION: a weight is part of what the score MEANS, so
// changing one is a scoring-rule change and must bump SCORE_VERSION, never be edited quietly in place.
export const WEIGHTS = Object.freeze({
  completeness: 0.4,
  measurable_impact: 0.3,
  chronology_health: 0.3,
});

// completeness: always computable from ResumeFacts alone (an entirely empty ResumeFacts is itself a valid,
// known answer — "0 of 4 signals present" — not a reason to call this part unknown). The only required
// part, so the overall score is never null in practice; kept required so the contract still enforces that
// invariant if a future bug ever made this return null.
function scoreCompleteness(facts) {
  const signals = [
    { name: 'contact.name', present: !!facts?.contact?.name?.value },
    { name: 'contact.email', present: !!facts?.contact?.email?.value },
    { name: 'experience or education', present: (facts?.experiences?.length > 0) || (facts?.education?.length > 0) },
    { name: 'skills', present: (facts?.skills?.length > 0) },
  ];
  const presentCount = signals.filter(s => s.present).length;
  return {
    id: 'completeness',
    score: Math.round((presentCount / signals.length) * 100),
    weight: WEIGHTS.completeness,
    required: true,
    evidence: signals.map(s => `${s.name}: ${s.present ? 'present' : 'missing'}`),
  };
}

// measurable_impact: the share of experience bullets that contain a quantified number (src/extraction/
// metrics.js). Null when there are no bullets to check at all (extraction found no experience entries, or
// none with bullets) — that is "we could not assess this", not "0% impact". A real 0 (bullets exist, none
// of them are quantified) is kept as 0, with evidence saying exactly what was counted.
function scoreMeasurableImpact(facts) {
  const bullets = (facts?.experiences || []).flatMap(e => e?.bullets || []);
  if (bullets.length === 0) {
    return { id: 'measurable_impact', score: null, weight: WEIGHTS.measurable_impact, required: false, evidence: [] };
  }
  const withMetric = bullets.filter(b => bulletHasMetric(b?.value)).length;
  return {
    id: 'measurable_impact',
    score: Math.round((withMetric / bullets.length) * 100),
    weight: WEIGHTS.measurable_impact,
    required: false,
    evidence: [`${withMetric} of ${bullets.length} experience bullets contain a measurable number.`],
  };
}

// chronology_health: penalised only by a genuine internal contradiction (an entry's own end before its own
// start, P3's 'end_before_start' error). An overlap between two entries is NEVER penalised here: P3 treats
// it as a warning because concurrent employment is legitimate, and a score built on top of P3 must not
// quietly turn that warning back into a penalty. Null when no entry has both a start and an end to check.
function scoreChronologyHealth(facts, validation) {
  const checkable = (facts?.experiences || []).filter(e => e?.start?.normalized_value != null && e?.end?.normalized_value != null).length;
  if (checkable === 0) {
    return { id: 'chronology_health', score: null, weight: WEIGHTS.chronology_health, required: false, evidence: [] };
  }
  const errors = (validation?.errors || []).filter(e => e.kind === 'end_before_start');
  return {
    id: 'chronology_health',
    score: Math.max(0, 100 - errors.length * 50),
    weight: WEIGHTS.chronology_health,
    required: false,
    evidence: [`${errors.length} internal date contradiction(s) found across ${checkable} checkable experience entries (overlapping entries are not penalised here).`],
  };
}

// facts: ResumeFacts (src/extraction/resumeFacts.js). validation: validateFacts(facts) (src/validation/
// validateFacts.js) — the caller computes it, this function never re-derives or re-validates anything.
export function scoreResume(facts, validation) {
  const parts = [scoreCompleteness(facts), scoreMeasurableImpact(facts), scoreChronologyHealth(facts, validation)];
  const missing = parts.filter(p => p.score === null).map(p => p.id);
  const computed = parts.filter(p => p.score !== null);
  const requiredMissing = parts.some(p => p.required && p.score === null);
  const totalWeight = computed.reduce((sum, p) => sum + p.weight, 0);
  const score = requiredMissing || totalWeight === 0
    ? null
    : Math.round(computed.reduce((sum, p) => sum + p.score * p.weight, 0) / totalWeight);
  return { score, score_type: SCORE_TYPE, version: SCORE_VERSION, parts, missing };
}
