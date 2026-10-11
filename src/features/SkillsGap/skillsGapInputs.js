// What a Skills Gap analysis was based on, as one stable key. The analysis is made again only when this key changes: a model's answer varies
// from run to run, so running it again on the same inputs would just give the user a different answer. The key covers exactly what the prompt
// is given (role, market, level, the resume basis it sees, and the analysed roles), using the same defaults as the prompt.
import { contentHash } from '../../extraction/hash';

const RESUME_CHARS_SEEN = 800; // the prompt reads only the first 800 characters of the resume when there is no scan summary

export function skillsGapInputKey({ form, resumeCtx = '', scanSummary = '', jdTitles = [] }) {
  const parts = {
    role: String(form?.role || 'Software professional').trim(),
    market: String(form?.market || 'Singapore').trim(),
    level: String(form?.level || 'not stated').trim(),
    basis: scanSummary || String(resumeCtx || '').slice(0, RESUME_CHARS_SEEN),
    jd: (jdTitles || []).join(', '),
  };
  return contentHash(JSON.stringify(parts));
}
