import { describe, it, expect, beforeEach } from 'vitest';
import { readAuthLink, rememberAuthLink, recallAuthLink, forgetAuthLink, PENDING_LINK_KEY } from './authLinks';

describe('readAuthLink: what the page was opened with after an email link', () => {
  it('a password-recovery link gives the access token', () => {
    expect(readAuthLink('#access_token=ACC&expires_in=3600&refresh_token=REF&token_type=bearer&type=recovery'))
      .toEqual({ kind: 'recovery', accessToken: 'ACC' });
  });

  it('never returns the refresh token', () => {
    expect(JSON.stringify(readAuthLink('#access_token=ACC&refresh_token=REFRESH-SECRET&type=recovery'))).not.toContain('REFRESH-SECRET');
  });

  it('a sign-up confirmation link is "confirmed" and carries no token', () => {
    expect(readAuthLink('#access_token=ACC&refresh_token=REF&type=signup')).toEqual({ kind: 'confirmed' });
    expect(readAuthLink('#access_token=ACC&refresh_token=REF&type=email_change')).toEqual({ kind: 'confirmed' });
  });

  it('an expired or used link is an error, with the code', () => {
    expect(readAuthLink('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'))
      .toEqual({ kind: 'error', code: 'otp_expired' });
  });

  it('reads the same parameters from the query string', () => {
    expect(readAuthLink('', '?error=access_denied&error_code=otp_expired')).toEqual({ kind: 'error', code: 'otp_expired' });
  });

  it('a recovery link without a token is not trusted', () => {
    expect(readAuthLink('#type=recovery')).toBeNull();
  });

  it('ordinary pages and unrelated fragments are not auth links', () => {
    expect(readAuthLink('')).toBeNull();
    expect(readAuthLink('#pricing')).toBeNull();
    expect(readAuthLink('', '?tab=ats&ref=beta')).toBeNull();
    expect(readAuthLink(undefined, undefined)).toBeNull();
  });
});

describe('readAuthLink: links that point straight at this site (token_hash)', () => {
  it('a recovery link carries only the one-time hash', () => {
    expect(readAuthLink('', '?token_hash=HASH123&type=recovery')).toEqual({ kind: 'recovery-link', tokenHash: 'HASH123' });
  });
  it('a sign-up or e-mail confirmation link is a confirm-link with its type', () => {
    expect(readAuthLink('', '?token_hash=H&type=email')).toEqual({ kind: 'confirm-link', tokenHash: 'H', type: 'email' });
    expect(readAuthLink('', '?token_hash=H&type=signup')).toEqual({ kind: 'confirm-link', tokenHash: 'H', type: 'signup' });
  });
  it('a hash without a known type is not trusted', () => {
    expect(readAuthLink('', '?token_hash=H')).toBeNull();
    expect(readAuthLink('', '?token_hash=H&type=magiclink')).toBeNull();
    expect(readAuthLink('', '?type=recovery')).toBeNull();
  });
});

describe('keeping a link that was not used yet, for a reload of this tab', () => {
  beforeEach(() => sessionStorage.clear());

  it('keeps and gives back a recovery-link, a recovery token and a confirm-link', () => {
    for (const link of [{ kind: 'recovery-link', tokenHash: 'H' }, { kind: 'recovery', accessToken: 'A' }, { kind: 'confirm-link', tokenHash: 'H', type: 'email' }]) {
      rememberAuthLink(link);
      expect(recallAuthLink()).toEqual(link);
    }
  });

  it('does not keep a message-only kind (expired, confirmed) or nothing at all', () => {
    rememberAuthLink({ kind: 'error', code: 'otp_expired' });
    rememberAuthLink({ kind: 'confirmed' });
    rememberAuthLink(null);
    expect(sessionStorage.getItem(PENDING_LINK_KEY)).toBeNull();
  });

  it('forgets on request', () => {
    rememberAuthLink({ kind: 'recovery-link', tokenHash: 'H' });
    forgetAuthLink();
    expect(recallAuthLink()).toBeNull();
  });

  it('ignores a stored value that is damaged, of an unknown kind, or without its token', () => {
    for (const raw of ['not json', JSON.stringify({ kind: 'admin', tokenHash: 'x' }), JSON.stringify({ kind: 'recovery-link' }), JSON.stringify({ kind: 'recovery', accessToken: '' }), JSON.stringify(null)]) {
      sessionStorage.setItem(PENDING_LINK_KEY, raw);
      expect(recallAuthLink()).toBeNull();
    }
  });
});
