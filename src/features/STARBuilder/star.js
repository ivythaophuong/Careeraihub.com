// Pure helpers for the STAR Story Builder: prompt, output validation, the weighted score, and a
// guard that catches numbers the AI added that the user never wrote.

import { numberKeys, findUnsupportedNumbers } from '../../lib/numberGuard';
import { claimWarnings } from '../../lib/claimGuard.js';
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

// Claims in the AI's polish that the user did not write: a higher role, a wider scope, a tool or name they never mentioned.
// The whole story is compared with the whole polish (a polish may move a sentence between sections), and the user's own text is the only source.
// Warnings only: a word list cannot know what is true (see claimGuard.js).
export function findClaimWarnings(story, result) {
  if (!story || !result?.refined) return [];
  const before = SECTIONS.map(k => story[k] ?? '').join('\n');
  const after = [...SECTIONS.map(k => result.refined[k] ?? ''), result.oneLiner ?? ''].join('\n');
  return claimWarnings({ before, after, resumeText: '' }).map(w => w.message);
}
