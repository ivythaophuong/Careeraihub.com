// Small pure helpers for the Mock Interview screens: elapsed time and honest wording for a failed request.

export const formatElapsed = (ms) => {
  const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

// What we may say after a failed "get feedback" request. Only a status the server itself sent proves the outcome:
//   - an HTTP status           -> the server answered, so the result is KNOWN (not evaluated)
//   - no status (timeout/network) -> UNKNOWN: the server may still have run the AI. Never say "failed" for certain,
//     and never suggest the retry is free.
// `kind` lets the screen pick a style; the text always says whether the answer is kept and what a retry does.
export function describeEvaluationFailure(e) {
  const status = Number.isFinite(e?.status) ? e.status : 0;
  const base = (e?.message || '').trim();
  if (status === 429) {
    return { kind: 'limit', text: `${base || 'The AI is busy or a usage limit was reached.'} Your answer is still here and was not evaluated. Wait a moment, then try again.` };
  }
  if (status >= 400) {
    return { kind: 'known', text: `${base || 'Your answer could not be evaluated.'} It was not evaluated, and your answer is still here. Trying again sends a new AI request.` };
  }
  return { kind: 'unknown', text: `${base || 'The connection was interrupted.'} We could not confirm whether this answer was evaluated. Your answer is still here. Trying again sends a new AI request.` };
}
