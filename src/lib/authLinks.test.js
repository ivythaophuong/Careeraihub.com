import { describe, it, expect } from 'vitest';
import { readAuthLink } from './authLinks';

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
