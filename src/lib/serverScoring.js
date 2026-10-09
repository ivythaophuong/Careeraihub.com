// Client for the `score-star` and `score-interview` Edge Functions (finding F-1). The browser sends the words the user wrote and gets the
// score back from the server; it never sends a score to be stored. Behind VITE_SERVER_SCORING until the function is deployed.
import { SUPABASE_URL, SUPABASE_ANON } from './supabase';
import { getValidSession } from './session';
import { LLMError } from './ai.jsx';

export const serverScoringOn = () => import.meta.env.VITE_SERVER_SCORING === 'true';

const endpoint = (fn) => `${SUPABASE_URL}/functions/v1/${fn}`;
const TIMEOUT_MS = 100_000;

async function post(fn, payload) {
  const session = await getValidSession();
  if (!session?.access_token) throw new LLMError('Please sign in to use this feature.', { status: 401, retryable: false });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(endpoint(fn), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON body */ }
    if (res.ok && data) return data;
    const msg = res.status === 401 ? 'Your session expired. Please sign in again.' : data?.error?.message || `Request failed (${res.status}).`;
    throw new LLMError(msg, { status: res.status, retryable: false });
  } catch (e) {
    if (e instanceof LLMError) throw e;
    throw new LLMError(e?.name === 'AbortError' ? 'The request timed out.' : `Network error: ${e?.message || e}`, { retryable: false });
  } finally {
    clearTimeout(timer);
  }
}

export const reviewStarOnServer = (story, context) => post('score-star', { action: 'review', story, context });
export const saveStarOnServer = (story, result, receipt) => post('score-star', { action: 'save', story, result, receipt });

// Mock interview: grade one answer, then save the session from the receipts of the graded answers.
export const evaluateAnswerOnServer = ({ personaId, role, question, answer, resumeText }) =>
  post('score-interview', { action: 'evaluate', personaId, role, question, answer, resumeText });
export const saveInterviewOnServer = (personaId, role, items) => post('score-interview', { action: 'save', personaId, role, items });
