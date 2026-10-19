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
