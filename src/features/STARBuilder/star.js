// Pure helpers for the STAR Story Builder: prompt, output validation, the weighted score, and a
// guard that catches numbers the AI added that the user never wrote.

import { numberKeys, findUnsupportedNumbers } from '../../lib/numberGuard';
import { SECTIONS, WEIGHTS, MIN_FIELD_CHARS, MAX_FIELD_CHARS, buildStarPrompt, overallScore, normalizeStarResult } from '../../../supabase/functions/_shared/starScoring.js';

export { SECTIONS, WEIGHTS, MIN_FIELD_CHARS, MAX_FIELD_CHARS, buildStarPrompt, overallScore, normalizeStarResult };

// ── Invented-number guard (implementation shared in lib/numberGuard) ────────
export { numberKeys };

// Numbers that appear in the AI's rewrite but not in what the candidate wrote.
export function findInventedNumbers(story, result) {
  return findUnsupportedNumbers(
    SECTIONS.map(k => story[k]).join(' '),
    [...SECTIONS.map(k => result.refined[k]), result.oneLiner].join(' '),
  );
}

export const scoreColorKey = (score) => (score >= 75 ? 'green' : score >= 50 ? 'gold' : 'red');
