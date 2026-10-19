// What the page was opened with after the person clicked a link in an email from Supabase Auth.
// Supabase redirects to the site with the result in the URL fragment (#access_token=...&type=recovery) or, for a link that no longer works,
// #error=access_denied&error_code=otp_expired. Pure: it only reads the strings it is given.
//  - recovery: a password-reset link; the access token is what authorises setting a new password.
//  - confirmed: a sign-up or e-mail-change link; nothing is kept (the person signs in as usual).
//  - recovery-link / confirm-link: the same, for a link that carries a token_hash instead of a token (see below).
//  - error: the link expired or was already used.
// The refresh token is never returned: this page does not need it, and it must not end up in state or a log.
export function readAuthLink(hash = '', search = '') {
  const h = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  const q = new URLSearchParams(String(search ?? '').replace(/^\?/, ''));
  const get = (k) => h.get(k) || q.get(k);

  const code = get('error_code') || get('error');
  if (code) return { kind: 'error', code };

  const type = get('type');

  // A link that points straight at this site: ?token_hash=...&type=recovery. The hash is one-time and is spent only when verifyOtp is called, which the
  // page does when the person presses a button (a mail scanner that opens the link must not use it up).
  const tokenHash = get('token_hash');
  if (tokenHash) {
    if (type === 'recovery') return { kind: 'recovery-link', tokenHash };
    if (type === 'email' || type === 'signup' || type === 'email_change') return { kind: 'confirm-link', tokenHash, type };
    return null;
  }

  const token = h.get('access_token');
  if (type === 'recovery') return token ? { kind: 'recovery', accessToken: token } : null;
  if ((type === 'signup' || type === 'email_change') && token) return { kind: 'confirmed' };
  return null;
}

// The session restore in App.jsx can refresh an expired stored token and then reload the page, and the address bar has already been cleaned by then, so a link
// that was not used yet would be lost. The actionable kinds are therefore kept for this tab only (sessionStorage), and forgotten as soon as the link is used or
// the dialog is closed. A recovery link holds a one-time hash or a short-lived token; nothing else is stored.
export const PENDING_LINK_KEY = 'careerai_pending_auth_link';
const ACTIONABLE = new Set(['recovery', 'recovery-link', 'confirm-link']);

export function rememberAuthLink(link) {
  try { if (link && ACTIONABLE.has(link.kind)) sessionStorage.setItem(PENDING_LINK_KEY, JSON.stringify(link)); } catch { /* private mode: the link just does not survive a reload */ }
}
export function forgetAuthLink() {
  try { sessionStorage.removeItem(PENDING_LINK_KEY); } catch { /* nothing to do */ }
}
export function recallAuthLink() {
  try {
    const raw = sessionStorage.getItem(PENDING_LINK_KEY);
    if (!raw) return null;
    const l = JSON.parse(raw);
    if (!l || !ACTIONABLE.has(l.kind)) return null;
    const ok = l.kind === 'recovery' ? typeof l.accessToken === 'string' && l.accessToken : typeof l.tokenHash === 'string' && l.tokenHash;
    return ok ? l : null;
  } catch { return null; }
}
