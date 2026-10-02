import { sb } from '../../lib/supabase';

const SESSION_KEY = 'cq_session';

function safeStorage(kind) {
  try { return window[kind]; } catch { return null; }
}

export function getSessionId() {
  const store = safeStorage('localStorage');
  let id = store?.getItem(SESSION_KEY);
  if (!id) {
    id = (crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2));
    try { store?.setItem(SESSION_KEY, id); } catch { /* storage blocked */ }
  }
  return id;
}

// Where the visitor came from: UTM parameters plus the referring site.
export function getSource() {
  const p = new URLSearchParams(window.location.search);
  const source = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'ref']) {
    if (p.get(k)) source[k] = p.get(k).slice(0, 100);
  }
  if (document.referrer) {
    try { source.referrer = new URL(document.referrer).hostname; } catch { /* ignore */ }
  }
  return source;
}

// Fire and forget. A tracking failure must never block the quiz.
export function track(event, extra = {}) {
  sb.insertPublic('culture_quiz_events', {
    event,
    session_id: getSessionId(),
    source: getSource(),
    meta: extra,
  }).catch(() => {});
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const THROTTLE_KEY = 'cq_last_submit';
const THROTTLE_MS = 30 * 1000;

export function submittedRecently() {
  const t = Number(safeStorage('localStorage')?.getItem(THROTTLE_KEY) || 0);
  return Date.now() - t < THROTTLE_MS;
}

export async function saveLead({ email, name, scores, persona, consent }) {
  await sb.insertPublic('culture_leads', {
    email: email.trim().toLowerCase(),
    name: name?.trim() || null,
    persona,
    score_innovation: scores.innovation,
    score_autonomy: scores.autonomy,
    score_collaboration: scores.collaboration,
    score_structure: scores.structure,
    score_pace: scores.pace,
    marketing_consent: !!consent,
    source: getSource(),
  });
  try { safeStorage('localStorage')?.setItem(THROTTLE_KEY, String(Date.now())); } catch { /* ignore */ }
}
