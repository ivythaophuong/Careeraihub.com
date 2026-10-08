// ResumeFacts: the canonical representation of what a resume says. See docs/AI_ARCHITECTURE_CONTRACT.md.
//
// This file is the CONTRACT only: shapes, invariants and validators. It extracts nothing and scores
// nothing. Extractors (later) must produce data that passes `validateResumeFacts`.
//
// A fact is { value, normalized_value, source, evidence, confidence, extraction_method, requiresInterpretation }:
//   value                   as extracted, or null when code could not extract it
//   normalized_value        a comparable form (e.g. 0.2 for "20%"), or null
//   source                  path in the document model, e.g. "experience[2].bullets[1]"
//   evidence                the exact text the value came from; required whenever value is not null
//   confidence              number in [0, 1]
//   extraction_method       "regex" | "rule" | "structure" | "ai"
//   requiresInterpretation  true when code could not decide; then value must be null

import { err, isObject, isNonEmptyString, isFiniteNumber, checkKeys, result } from './validate';

export const RESUME_FACTS_VERSION = '1.0.0';
export const EXTRACTION_METHODS = ['regex', 'rule', 'structure', 'ai'];
export const EXTRACTION_STATUSES = ['ok', 'partial', 'no_text_layer', 'failed'];

const FACT_KEYS = ['value', 'normalized_value', 'source', 'evidence', 'confidence', 'extraction_method', 'requiresInterpretation'];

export function validateFact(f, path = 'fact') {
  if (!isObject(f)) return [err(path, 'not_an_object', 'a fact must be an object')];
  const errors = checkKeys(f, path, FACT_KEYS);
  if ('source' in f && !isNonEmptyString(f.source)) errors.push(err(`${path}.source`, 'bad_source', 'source must be a non-empty string'));
  if ('confidence' in f) {
    if (!isFiniteNumber(f.confidence)) errors.push(err(`${path}.confidence`, 'bad_confidence', 'confidence must be a finite number, not a string'));
    else if (f.confidence < 0 || f.confidence > 1) errors.push(err(`${path}.confidence`, 'confidence_out_of_range', 'confidence must be between 0 and 1'));
  }
  if ('extraction_method' in f && !EXTRACTION_METHODS.includes(f.extraction_method)) errors.push(err(`${path}.extraction_method`, 'bad_extraction_method', `extraction_method must be one of ${EXTRACTION_METHODS.join(', ')}`));
  if ('requiresInterpretation' in f && typeof f.requiresInterpretation !== 'boolean') errors.push(err(`${path}.requiresInterpretation`, 'bad_flag', 'requiresInterpretation must be a boolean'));
  if ('value' in f && 'evidence' in f) {
    if (f.value !== null && !isNonEmptyString(f.evidence)) errors.push(err(`${path}.evidence`, 'missing_evidence', 'a fact with a value needs the text it came from'));
    if (f.value === null && f.evidence !== null && f.evidence !== '' && !isNonEmptyString(f.evidence)) errors.push(err(`${path}.evidence`, 'bad_evidence', 'evidence must be a string or null'));
  }
  if (f.requiresInterpretation === true && f.value !== null && 'value' in f) errors.push(err(`${path}.value`, 'guess_not_allowed', 'when code could not decide, value must be null (no guessing)'));
  return errors;
}

const factList = (arr, path) => (Array.isArray(arr) ? arr.flatMap((f, i) => validateFact(f, `${path}[${i}]`)) : [err(path, 'not_an_array', `${path} must be an array`)]);

const CONTACT_FACTS = ['name', 'email', 'phone', 'location'];
const EXPERIENCE_FACTS = ['title', 'company', 'start', 'end'];
const EDUCATION_FACTS = ['degree', 'institution', 'year'];

export function validateResumeFacts(facts) {
  const path = 'facts';
  if (!isObject(facts)) return result([err(path, 'not_an_object', 'ResumeFacts must be an object')]);
  const errors = checkKeys(facts, path, ['schema_version', 'content_hash', 'extraction', 'contact', 'experiences', 'education', 'skills', 'metrics', 'certifications']);

  if (facts.schema_version !== RESUME_FACTS_VERSION) errors.push(err(`${path}.schema_version`, 'bad_version', `schema_version must be "${RESUME_FACTS_VERSION}"`));
  if ('content_hash' in facts && !isNonEmptyString(facts.content_hash)) errors.push(err(`${path}.content_hash`, 'bad_hash', 'content_hash must be a non-empty string'));

  if (isObject(facts.extraction)) {
    errors.push(...checkKeys(facts.extraction, `${path}.extraction`, ['status', 'notes']));
    if (!EXTRACTION_STATUSES.includes(facts.extraction.status)) errors.push(err(`${path}.extraction.status`, 'bad_status', `status must be one of ${EXTRACTION_STATUSES.join(', ')}`));
    if (!Array.isArray(facts.extraction.notes)) errors.push(err(`${path}.extraction.notes`, 'not_an_array', 'notes must be an array'));
  } else if ('extraction' in facts) errors.push(err(`${path}.extraction`, 'not_an_object', 'extraction must be an object'));

  if (isObject(facts.contact)) {
    errors.push(...checkKeys(facts.contact, `${path}.contact`, [...CONTACT_FACTS, 'links']));
    for (const k of CONTACT_FACTS) if (k in facts.contact) errors.push(...validateFact(facts.contact[k], `${path}.contact.${k}`));
    if ('links' in facts.contact) errors.push(...factList(facts.contact.links, `${path}.contact.links`));
  } else if ('contact' in facts) errors.push(err(`${path}.contact`, 'not_an_object', 'contact must be an object'));

  if (Array.isArray(facts.experiences)) {
    facts.experiences.forEach((e, i) => {
      const p = `${path}.experiences[${i}]`;
      if (!isObject(e)) return errors.push(err(p, 'not_an_object', 'an experience must be an object'));
      errors.push(...checkKeys(e, p, [...EXPERIENCE_FACTS, 'bullets']));
      for (const k of EXPERIENCE_FACTS) if (k in e) errors.push(...validateFact(e[k], `${p}.${k}`));
      if ('bullets' in e) errors.push(...factList(e.bullets, `${p}.bullets`));
    });
  } else if ('experiences' in facts) errors.push(err(`${path}.experiences`, 'not_an_array', 'experiences must be an array'));

  if (Array.isArray(facts.education)) {
    facts.education.forEach((e, i) => {
      const p = `${path}.education[${i}]`;
      if (!isObject(e)) return errors.push(err(p, 'not_an_object', 'an education entry must be an object'));
      errors.push(...checkKeys(e, p, EDUCATION_FACTS));
      for (const k of EDUCATION_FACTS) if (k in e) errors.push(...validateFact(e[k], `${p}.${k}`));
    });
  } else if ('education' in facts) errors.push(err(`${path}.education`, 'not_an_array', 'education must be an array'));

  for (const k of ['skills', 'metrics', 'certifications']) if (k in facts) errors.push(...factList(facts[k], `${path}.${k}`));

  return result(errors);
}

// An AI answer may fill a gap. It may never replace something code extracted.
// Returns { field, accepted, reason }; `field` is what the facts should hold afterwards.
export function mergeAiFact(existing, aiField) {
  const problems = validateFact(aiField, 'ai');
  if (problems.length) return { field: existing, accepted: false, reason: `invalid_ai_fact: ${problems[0].code}` };
  if (aiField.extraction_method !== 'ai') return { field: existing, accepted: false, reason: 'not_marked_as_ai' };
  const extractedByCode = isObject(existing) && existing.value !== null && existing.extraction_method !== 'ai';
  if (extractedByCode) return { field: existing, accepted: false, reason: 'deterministic_fact_is_protected' };
  return { field: aiField, accepted: true, reason: 'filled_a_gap' };
}
