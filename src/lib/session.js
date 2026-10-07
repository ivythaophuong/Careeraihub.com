import { sb } from './supabase';

// Persisted login session with expiry tracking and refresh.
// Storage shape is unchanged ({ currentSession }) so existing logins keep working;
// sessions saved before this module have no `expiresAt` and are decoded from the JWT.

const KEY = 'supabase.auth.token';
export const REFRESH_SKEW_MS = 60_000; // refresh when less than a minute is left

const jwtExpiry = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp ? payload.exp * 1000 : null;
  } catch { return null; }
};

export function normalizeSession(raw, now = Date.now()) {
  if (!raw) return null;
  // The access token's own `exp` claim is authoritative. A stored `expires_at` can be stale: some code
  // paths refresh the token and copy only the new tokens over, leaving the old expiry behind.
  const expiresAt =
    (raw.access_token ? jwtExpiry(raw.access_token) : null) ??
    raw.expiresAt ??
    (raw.expires_at ? raw.expires_at * 1000 : null) ??
    (raw.expires_in ? now + raw.expires_in * 1000 : null);
  return { ...raw, expiresAt };
}

// Supabase's password and signup endpoints return the tokens at the top level of the response
// ({ access_token, refresh_token, expires_in, user }), not under `session`. Keep all of them: without
// the refresh token the login dies when the access token expires (about an hour). Returns null when
// there is no access token (signup that still needs email confirmation).
export function sessionFromAuthResponse(data) {
  const s = data?.session || data;
  return s?.access_token && s?.user ? s : null;
}

export function loadSession() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || 'null');
    return normalizeSession(data?.currentSession);
  } catch { return null; }
}

export function saveSession(session) {
  const s = normalizeSession(session);
  try { localStorage.setItem(KEY, JSON.stringify({ currentSession: s })); } catch { /* storage full/blocked */ }
  return s;
}

export function clearSession() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export const isExpiring = (session, now = Date.now()) =>
  !!session && session.expiresAt != null && session.expiresAt - now < REFRESH_SKEW_MS;

// True when the server rejected the refresh token itself (as opposed to a network blip).
export const isAuthRejection = (err) => err?.status === 400 || err?.status === 401 || err?.status === 403;

let inflight = null; // refresh tokens are single-use: share one request between callers

export function refreshSession(session) {
  if (!session?.refresh_token) return Promise.reject(Object.assign(new Error('No refresh token'), { status: 401 }));
  if (inflight) return inflight;
  inflight = sb.refreshToken(session.refresh_token)
    .then((d) => {
      // Drop the old expiry fields so they can't override the refreshed token's.
      const { expires_at, expires_in, expiresAt, ...rest } = session;
      return saveSession({ ...rest, ...d, user: d.user || session.user });
    })
    .finally(() => { inflight = null; });
  return inflight;
}

// Returns a usable session, refreshing if needed.
//  - null    → nothing stored, the server rejected it (stored session is cleared), or the
//              token is already expired and the refresh failed on the network
//              (stored session is kept so the next load retries).
//  - session → valid, refreshed, or still-unexpired when only the refresh hit a network
//              error, so a brief outage doesn't log the user out.
export async function getValidSession() {
  const stored = loadSession();
  if (!stored?.access_token) return null;
  if (!isExpiring(stored)) return stored;
  try {
    return await refreshSession(stored);
  } catch (e) {
    if (isAuthRejection(e)) { clearSession(); return null; }
    return stale(stored);
  }
}

// A session whose token may be expired but whose refresh failed transiently.
const stale = (s) => (s.expiresAt != null && s.expiresAt <= Date.now() ? null : s);
