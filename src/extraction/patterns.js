// Shared regexes and small helpers for deterministic extraction (P2). Nothing here calls AI.

export const EMAIL_RE = /[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+/g;

// linkedin.com/in/..., github.com/..., or any http(s) URL. Captures with or without a scheme.
export const URL_RE = /\bhttps?:\/\/[^\s),]+|\b(?:[a-z0-9-]+\.)?(?:linkedin\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com|medium\.com)\/[^\s),]+/gi;

// A permissive phone candidate: digits grouped by spaces/dots/dashes/parens, optionally starting with +.
// `looksLikePhone` below filters out things that only coincidentally match this shape (a date range, a year).
export const PHONE_CANDIDATE_RE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\d{2,4}(?:[\s.-]\d{2,4}){1,5}/g;

const DATE_RANGE_SHAPE = /^(19|20)\d{2}\s*[-–—]\s*(19|20)\d{2}$/; // "2021 - 2024", "2021-2024"
const YEAR_ONLY = /^(19|20)\d{2}$/;

// A phone candidate must have 7-15 digits and not be a bare year or a "YYYY-YYYY" date range, which the
// permissive regex above also matches.
export function looksLikePhone(s) {
  const trimmed = String(s || '').trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return false;
  if (YEAR_ONLY.test(trimmed) || DATE_RANGE_SHAPE.test(trimmed)) return false;
  return true;
}

// Strip a trailing '.', ',' or ')' a sentence or line wrap can leave stuck to a URL/email match.
export const trimTrailingPunct = (s) => s.replace(/[.,;:)\]]+$/, '');

export const nonEmptyLines = (text) => String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
