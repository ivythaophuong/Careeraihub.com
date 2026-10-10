// STAR Structure Score (package 2a). Deterministic: the same story, enabled languages and score version always give the same result.
// It measures the FORM of the story (length, who acts, something countable, context, vague wording). It does not measure whether the story is
// true, good or a sign of competence.
import { makeCheck, makeResult, processingError, weightedMean, STATUS, SCORE_TYPES } from './contract.js';
import { detectLanguage, tokenize, usesUnsupportedScript } from './text.js';
import { ENABLED_LANGUAGES } from './languageGate.js';
import { SCORE_VERSIONS, PADDED_SECTION_CAP, STAR_BANDS, STAR_CHECK_WEIGHTS, STAR_SECTIONS, STAR_WEIGHTS, MIN_SECTION_TOKENS } from './rules.js';
import { concreteCheck, contextCheck, lengthCheck, ownershipCheck, responsibilityCheck, vagueCheck } from './checks.js';

const TYPE = SCORE_TYPES.STAR;
const VERSION = SCORE_VERSIONS.star_structure;
const LABELS = {
  length: 'Length', vague: 'Vague wording', context: 'Context (time, place, scale)', responsibility: 'Your responsibility is stated',
  ownership: 'Who acts (I / we)', concrete: 'Something countable in the result',
};

function scoreSection(name, text, lang) {
  const tokens = tokenize(text);
  const w = STAR_CHECK_WEIGHTS[name];
  const raw = {
    length: lengthCheck(tokens, STAR_BANDS[name], lang),
    vague: vagueCheck(tokens, lang),
    ...(name === 'situation' ? { context: contextCheck(text, tokens, lang) } : {}),
    ...(name === 'task' ? { responsibility: responsibilityCheck(tokens, lang) } : {}),
    ...(name === 'action' ? { ownership: ownershipCheck(tokens, lang) } : {}),
    ...(name === 'result' ? { concrete: concreteCheck(text) } : {}),
  };
  const checks = Object.entries(raw).map(([id, r]) => makeCheck({ id, label: LABELS[id], section: name, score: r.score, weight: w[id], value: r.value, note: r.note }));
  // Padding (the same few words repeated) cannot pass for a good section whatever its other checks say.
  const padded = raw.length.note === 'many repeated words';
  const mean = weightedMean(checks);
  return { score: padded ? Math.min(mean, PADDED_SECTION_CAP) : mean, status: STATUS.SCORED, checks, ...(padded ? { capped: 'repeated words' } : {}) };
}

// story: { situation, task, action, result } (strings). options.enabledLanguages: languages allowed to be scored (default: the gate file).
export function scoreStarStructure(story, { enabledLanguages = ENABLED_LANGUAGES } = {}) {
  try {
    if (!story || typeof story !== 'object') return processingError(TYPE, VERSION, 'The story is not an object.');
    const texts = Object.fromEntries(STAR_SECTIONS.map((k) => [k, typeof story[k] === 'string' ? story[k].trim() : '']));
    if (usesUnsupportedScript(STAR_SECTIONS.map((k) => texts[k]).join(' '))) {
      return makeResult({ scoreType: TYPE, scoreVersion: VERSION, status: STATUS.UNSUPPORTED_LANGUAGE, notes: ['This writing system is not supported.'] });
    }
    const missing = STAR_SECTIONS.filter((k) => tokenize(texts[k]).length < MIN_SECTION_TOKENS);
    if (missing.length) {
      // A story missing a part is not a STAR story: no partial score, and the other sections' weights are NOT inflated.
      return makeResult({ scoreType: TYPE, scoreVersion: VERSION, status: STATUS.INSUFFICIENT_DATA, evidence: [], sections: Object.fromEntries(STAR_SECTIONS.map((k) => [k, { score: null, status: missing.includes(k) ? STATUS.INSUFFICIENT_DATA : 'not_assessed', checks: [] }])), notes: [`Missing or too short: ${missing.join(', ')}.`] });
    }
    const { language, evidence: langEvidence } = detectLanguage(STAR_SECTIONS.map((k) => texts[k]).join(' . '));
    if (language === 'unknown') return makeResult({ scoreType: TYPE, scoreVersion: VERSION, status: STATUS.INSUFFICIENT_DATA, notes: ['Too little text to tell the language.'] });
    if (language === 'other' || language === 'mixed' || !enabledLanguages.includes(language)) {
      return makeResult({ scoreType: TYPE, scoreVersion: VERSION, status: STATUS.UNSUPPORTED_LANGUAGE, language: ['en', 'vi'].includes(language) ? language : null, notes: [language === 'mixed' ? 'The story mixes languages in a way that cannot be scored reliably.' : ['en', 'vi'].includes(language) ? `Scoring for "${language}" is not enabled yet.` : 'This language is not supported.'], evidence: [] });
    }
    const sections = Object.fromEntries(STAR_SECTIONS.map((k) => [k, scoreSection(k, texts[k], language)]));
    const score = Math.round(STAR_SECTIONS.reduce((s, k) => s + sections[k].score * STAR_WEIGHTS[k], 0));
    return makeResult({
      scoreType: TYPE, scoreVersion: VERSION, status: STATUS.SCORED, score, language, sections,
      evidence: STAR_SECTIONS.flatMap((k) => sections[k].checks), notes: [`Language evidence: ${JSON.stringify(langEvidence)}`],
    });
  } catch (e) {
    return processingError(TYPE, VERSION, `Scoring failed: ${e?.message || e}`);
  }
}
