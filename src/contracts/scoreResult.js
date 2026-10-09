// ScoreResult: what a deterministic scoring engine returns. See docs/AI_ARCHITECTURE_CONTRACT.md.
// Contract only: no scoring happens here.
//
//   score        integer 0..100, or null when a required part could not be computed. 0 is a real result
//                and null is "unknown": they are never interchangeable.
//   score_type   what the number means, e.g. "careeraihub_ats_readiness". Never "your actual ATS score".
//   version      semver of the scoring rules; bump it when a rule changes so a changed score can be explained
//   parts        [{ id, score: integer 0..100 | null, weight: number > 0, required: boolean, evidence: string[] }]
//                a part with a score needs evidence (a computed 0 still says what was counted)
//   missing      ids of parts that could not be computed

import { err, isObject, isNonEmptyString, isFiniteNumber, checkKeys, result } from './validate';

const SEMVER = /^\d+\.\d+\.\d+$/;
const isScore = (v) => isFiniteNumber(v) && Number.isInteger(v) && v >= 0 && v <= 100;

export function validateScoreResult(r) {
  const path = 'score_result';
  if (!isObject(r)) return result([err(path, 'not_an_object', 'ScoreResult must be an object')]);
  const errors = checkKeys(r, path, ['score', 'score_type', 'version', 'parts', 'missing']);

  if ('score_type' in r && !isNonEmptyString(r.score_type)) errors.push(err(`${path}.score_type`, 'bad_score_type', 'score_type must be a non-empty string'));
  if ('version' in r && !(typeof r.version === 'string' && SEMVER.test(r.version))) errors.push(err(`${path}.version`, 'bad_version', 'version must look like 1.0.0'));
  if ('score' in r && r.score !== null && !isScore(r.score)) errors.push(err(`${path}.score`, 'invalid_score', 'score must be an integer from 0 to 100, or null'));

  const partIds = [];
  if (Array.isArray(r.parts)) {
    r.parts.forEach((p, i) => {
      const pp = `${path}.parts[${i}]`;
      if (!isObject(p)) return errors.push(err(pp, 'not_an_object', 'a part must be an object'));
      errors.push(...checkKeys(p, pp, ['id', 'score', 'weight', 'required', 'evidence']));
      if (!isNonEmptyString(p.id)) errors.push(err(`${pp}.id`, 'bad_id', 'id must be a non-empty string'));
      else partIds.push(p.id);
      if ('score' in p && p.score !== null && !isScore(p.score)) errors.push(err(`${pp}.score`, 'invalid_score', 'part score must be an integer from 0 to 100, or null'));
      if ('weight' in p && !(isFiniteNumber(p.weight) && p.weight > 0)) errors.push(err(`${pp}.weight`, 'bad_weight', 'weight must be a number above 0'));
      if ('required' in p && typeof p.required !== 'boolean') errors.push(err(`${pp}.required`, 'bad_flag', 'required must be a boolean'));
      if ('evidence' in p) {
        if (!Array.isArray(p.evidence) || !p.evidence.every(isNonEmptyString)) errors.push(err(`${pp}.evidence`, 'bad_evidence', 'evidence must be an array of non-empty strings'));
        else if (p.score !== null && 'score' in p && p.evidence.length === 0) errors.push(err(`${pp}.evidence`, 'missing_evidence', 'a part with a score must say what it was computed from (a zero is not a default)'));
      }
    });
  } else if ('parts' in r) errors.push(err(`${path}.parts`, 'not_an_array', 'parts must be an array'));

  if (Array.isArray(r.missing)) {
    if (!r.missing.every(isNonEmptyString)) errors.push(err(`${path}.missing`, 'bad_missing', 'missing must be an array of part ids'));
    // `missing` must agree with the parts: every part with a null score is listed, nothing else is.
    if (Array.isArray(r.parts) && r.parts.every(isObject)) {
      const nullIds = r.parts.filter(p => p.score === null).map(p => p.id).sort().join('|');
      if (nullIds !== [...r.missing].sort().join('|')) errors.push(err(`${path}.missing`, 'missing_mismatch', 'missing must list exactly the parts whose score is null'));
    }
  } else if ('missing' in r) errors.push(err(`${path}.missing`, 'not_an_array', 'missing must be an array'));

  // The headline score is unknown whenever a required part is unknown, and known only when none is.
  if (Array.isArray(r.parts) && r.parts.every(isObject) && 'score' in r) {
    const requiredUnknown = r.parts.some(p => p.required === true && p.score === null);
    if (requiredUnknown && r.score !== null) errors.push(err(`${path}.score`, 'score_without_required_part', 'score must be null while a required part is null'));
    if (!requiredUnknown && r.score === null && r.parts.length > 0) errors.push(err(`${path}.score`, 'null_without_reason', 'score is null but every required part has a score'));
  }

  return result(errors);
}
