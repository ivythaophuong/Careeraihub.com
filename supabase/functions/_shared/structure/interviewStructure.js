// Interview Structure Score (package 2b): per answer, then per session. Deterministic, form only (not correctness, honesty or hiring suitability).
// Integrity signals (paste, tab switches, time) are NOT inputs: they never change this score in version 1.
import { makeCheck, makeResult, processingError, weightedMean, STATUS, SCORE_TYPES } from './contract.js';
import { detectLanguage, tokenize, usesUnsupportedScript } from './text.js';
import { ENABLED_LANGUAGES } from './languageGate.js';
import { SCORE_VERSIONS, INTERVIEW_BAND, INTERVIEW_MIN_TOKENS, INTERVIEW_WEIGHTS, RELEVANCE_MIN_NEW_WORDS } from './rules.js';
import { hedgingCheck, lengthCheck, ownershipCheck, relevanceCheck, specificityCheck, starCueCheck } from './checks.js';

const LABELS = {
  length: 'Length', relevance: 'Uses words from the question (weak signal)', specificity: 'Specific details (numbers, names, tools)',
  ownership: 'Who acts (I / we)', starCues: 'Situation / task / action / result cues', hedging: 'Hedging and filler words',
};

// A short answer is not failed for length alone: below the ideal range the length check is mild and the other checks decide.
function interviewLength(tokens, lang) {
  const base = lengthCheck(tokens, INTERVIEW_BAND, lang);
  const w = tokens.length;
  if (w < 10) return { ...base, score: 30 };
  if (w < Math.round(INTERVIEW_BAND[0] * (lang === 'vi' ? 1.4 : 1))) return { ...base, score: 70 };
  return base;
}

// input: { question, answer }
export function scoreInterviewAnswer(input, { enabledLanguages = ENABLED_LANGUAGES } = {}) {
  const TYPE = SCORE_TYPES.INTERVIEW_ANSWER, VERSION = SCORE_VERSIONS.interview_answer_structure;
  try {
    if (!input || typeof input !== 'object') return processingError(TYPE, VERSION, 'The input is not an object.');
    const answer = typeof input.answer === 'string' ? input.answer.trim() : '';
    const question = typeof input.question === 'string' ? input.question : '';
    if (usesUnsupportedScript(answer)) return makeResult({ scoreType: TYPE, scoreVersion: VERSION, status: STATUS.UNSUPPORTED_LANGUAGE, notes: ['This writing system is not supported.'] });
    const tokens = tokenize(answer);
    if (tokens.length < INTERVIEW_MIN_TOKENS) return makeResult({ scoreType: TYPE, scoreVersion: VERSION, status: STATUS.INSUFFICIENT_DATA, notes: ['The answer is too short to assess.'] });
    const { language } = detectLanguage(answer);
    if (language === 'unknown') return makeResult({ scoreType: TYPE, scoreVersion: VERSION, status: STATUS.INSUFFICIENT_DATA, notes: ['Too little text to tell the language.'] });
    if (language === 'other' || language === 'mixed' || !enabledLanguages.includes(language)) {
      return makeResult({ scoreType: TYPE, scoreVersion: VERSION, status: STATUS.UNSUPPORTED_LANGUAGE, language: ['en', 'vi'].includes(language) ? language : null, notes: [language === 'mixed' ? 'The answer mixes languages in a way that cannot be scored reliably.' : ['en', 'vi'].includes(language) ? `Scoring for "${language}" is not enabled yet.` : 'This language is not supported.'] });
    }
    const raw = {
      length: interviewLength(tokens, language),
      relevance: relevanceCheck(question, tokens, language, RELEVANCE_MIN_NEW_WORDS),
      specificity: specificityCheck(answer),
      ownership: ownershipCheck(tokens, language),
      starCues: starCueCheck(tokens, language),
      hedging: hedgingCheck(tokens, language),
    };
    const evidence = Object.entries(raw).map(([id, r]) => makeCheck({ id, label: LABELS[id], score: r.score, weight: INTERVIEW_WEIGHTS[id], value: r.value, note: r.note }));
    return makeResult({ scoreType: TYPE, scoreVersion: VERSION, status: STATUS.SCORED, score: weightedMean(evidence), language, evidence });
  } catch (e) {
    return processingError(TYPE, VERSION, `Scoring failed: ${e?.message || e}`);
  }
}

// answers: results of scoreInterviewAnswer for the answered questions; skipped: number of questions the user skipped.
// Rule: the session score is the mean of the answers that were SCORED. Skipped, too-short, unsupported-language and failed answers are listed and
// left out; they are never counted as 0. With no scored answer there is no session score.
export function scoreInterviewSession(answers, { skipped = 0 } = {}) {
  const TYPE = SCORE_TYPES.INTERVIEW_SESSION, VERSION = SCORE_VERSIONS.interview_session_structure;
  try {
    if (!Array.isArray(answers)) return processingError(TYPE, VERSION, 'The answers are not a list.');
    const scored = answers.filter((a) => a?.status === STATUS.SCORED && a.score_version === SCORE_VERSIONS.interview_answer_structure);
    const count = (s) => answers.filter((a) => a?.status === s).length;
    const excluded = { skipped, insufficient_data: count(STATUS.INSUFFICIENT_DATA), unsupported_language: count(STATUS.UNSUPPORTED_LANGUAGE), processing_error: count(STATUS.PROCESSING_ERROR), other_version: answers.filter((a) => a?.status === STATUS.SCORED && a.score_version !== SCORE_VERSIONS.interview_answer_structure).length };
    const evidence = [makeCheck({ id: 'answers', label: 'Answers included in the session score', score: null, weight: 1, value: { scored: scored.length, ...excluded } })];
    if (!scored.length) return makeResult({ scoreType: TYPE, scoreVersion: VERSION, status: STATUS.INSUFFICIENT_DATA, evidence, notes: ['No answer could be scored.'] });
    const langs = [...new Set(scored.map((a) => a.language))];
    const partial = scored.length < answers.length + skipped;
    return makeResult({
      scoreType: TYPE, scoreVersion: VERSION, status: STATUS.SCORED, score: Math.round(scored.reduce((s, a) => s + a.score, 0) / scored.length),
      language: langs.length === 1 ? langs[0] : null, evidence,
      notes: partial ? ['Some answers were left out of the score (see counts).'] : [],
    });
  } catch (e) {
    return processingError(TYPE, VERSION, `Scoring failed: ${e?.message || e}`);
  }
}
