// Shared contract of the deterministic "structure" scores (STAR story, interview answer). Pure JS: no model, network, database or browser.
// Plan and acceptance criteria: docs/architecture/plans/PLAN-deterministic-practice-scores.md.
//
// A result always says what it is (score_type), which rules produced it (score_version), whether there is a score (status), and why (evidence).
// `score` is a number only when status is 'scored'. A missing input is never turned into 0; an unsupported language is never scored with English rules;
// a processing failure is never a valid score.

export const STATUS = Object.freeze({
  SCORED: 'scored',
  INSUFFICIENT_DATA: 'insufficient_data',
  UNSUPPORTED_LANGUAGE: 'unsupported_language',
  PROCESSING_ERROR: 'processing_error',
});

export const SCORE_TYPES = Object.freeze({
  STAR: 'star_structure',
  INTERVIEW_ANSWER: 'interview_answer_structure',
  INTERVIEW_SESSION: 'interview_session_structure',
});

export const OUTCOME = Object.freeze({ PASS: 'pass', PARTIAL: 'partial', FAIL: 'fail', NOT_EVALUATED: 'not_evaluated' });

export const outcomeFor = (score) => (score === null || score === undefined ? OUTCOME.NOT_EVALUATED : score >= 80 ? OUTCOME.PASS : score >= 50 ? OUTCOME.PARTIAL : OUTCOME.FAIL);

// One performed (or not performed) check. `value` holds the counts the check looked at, so a reader can see why.
export const makeCheck = ({ id, label, section = null, score = null, weight, value = {}, note = '' }) => ({
  id, label, section, score, weight, outcome: outcomeFor(score), value, note,
});

export function makeResult({ scoreType, scoreVersion, status, score = null, language = null, evidence = [], sections = null, notes = [] }) {
  if (!Object.values(STATUS).includes(status)) throw new Error(`unknown status ${status}`);
  const scored = status === STATUS.SCORED;
  if (scored && !Number.isInteger(score)) throw new Error('a scored result needs an integer score');
  return {
    score_type: scoreType,
    score_version: scoreVersion,
    status,
    score: scored ? score : null, // never a number unless status is 'scored'
    language,
    evidence,
    ...(sections ? { sections } : {}),
    notes,
  };
}

// Scores of different types or versions are not directly comparable (acceptance criteria, section 2).
export const comparable = (a, b) =>
  !!a && !!b && a.status === STATUS.SCORED && b.status === STATUS.SCORED && a.score_type === b.score_type && a.score_version === b.score_version;

// A result that must never be stored or shown as a valid score.
export const processingError = (scoreType, scoreVersion, message) =>
  makeResult({ scoreType, scoreVersion, status: STATUS.PROCESSING_ERROR, notes: [message] });

// Weighted mean of checks that were evaluated; checks with score null are left out and listed, never counted as 0.
export function weightedMean(checks) {
  const used = checks.filter((c) => Number.isFinite(c.score));
  const totalWeight = used.reduce((s, c) => s + c.weight, 0);
  if (!used.length || totalWeight === 0) return null;
  return Math.round(used.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight);
}
