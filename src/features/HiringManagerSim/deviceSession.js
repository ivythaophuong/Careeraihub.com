// A practice session kept in THIS browser tab so a refresh or a visit to another module does not lose it.
// It is NOT a server session: the server knows nothing about it, it is not an account save, it is not proof of anything, and it is
// dropped when the tab closes (sessionStorage). The screen must call it "kept on this device", never "saved".
// Graded answers carry a server receipt that the server accepts for 2 hours (score-interview LIMITS.receiptTtlMs), so a kept session
// older than that is dropped rather than offered.
import { PERSONAS, MAX_ANSWER_CHARS } from './interview';

export const DEVICE_SESSION_PREFIX = 'careerai_mock_session';
export const DEVICE_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_QUESTIONS = 5;

export const deviceSessionKey = (userId) => `${DEVICE_SESSION_PREFIX}:${userId || 'guest'}`;

const isStr = (v, max) => typeof v === 'string' && v.length <= max;

// Returns the snapshot only if it is well formed; anything else is treated as "nothing kept".
export function validateSnapshot(s, now = Date.now()) {
  if (!s || typeof s !== 'object') return null;
  if (!PERSONAS[s.personaId] || !isStr(s.role ?? '', 200)) return null;
  if (!Number.isFinite(s.savedAt) || now - s.savedAt > DEVICE_SESSION_TTL_MS || s.savedAt > now + 60_000) return null;
  if (!Array.isArray(s.questions) || s.questions.length < 3 || s.questions.length > MAX_QUESTIONS) return null;
  if (!s.questions.every(q => q && isStr(q.question, 500) && q.question && isStr(q.focus ?? '', 100) && isStr(q.why ?? '', 400))) return null;
  if (!Number.isInteger(s.idx) || s.idx < 0 || s.idx >= s.questions.length) return null;
  if (!Array.isArray(s.results) || s.results.length > s.questions.length) return null;
  if (!isStr(s.answer ?? '', MAX_ANSWER_CHARS)) return null;
  if (!Number.isFinite(s.elapsedMs) || s.elapsedMs < 0) return null;
  if (s.challenge !== undefined && s.challenge !== 'untimed' && s.challenge !== 'timed') return null;
  return s;
}

export function saveDeviceSession(userId, snapshot, now = Date.now()) {
  try { sessionStorage.setItem(deviceSessionKey(userId), JSON.stringify({ ...snapshot, savedAt: now })); return true; } catch { return false; }
}

export function loadDeviceSession(userId, now = Date.now()) {
  try {
    const raw = sessionStorage.getItem(deviceSessionKey(userId));
    if (!raw) return null;
    const ok = validateSnapshot(JSON.parse(raw), now);
    if (!ok) sessionStorage.removeItem(deviceSessionKey(userId));
    return ok;
  } catch { return null; }
}

export function clearDeviceSession(userId) {
  try { sessionStorage.removeItem(deviceSessionKey(userId)); } catch { /* storage blocked: nothing to clear */ }
}

// Answers are personal text: sign-out removes every kept session in this tab, whoever it belonged to.
export function clearAllDeviceSessions() {
  try { Object.keys(sessionStorage).filter(k => k.startsWith(DEVICE_SESSION_PREFIX)).forEach(k => sessionStorage.removeItem(k)); } catch { /* ignore */ }
}
