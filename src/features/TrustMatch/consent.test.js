// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildGrant, canShare, consentFlowEnabled, groupByEmployer, isActive, releasedFields, PART_FIELDS, NOT_SHARED, DEFAULT_DAYS, formatDate } from './consent';
import { COPY } from './consentCopy';

afterEach(() => vi.unstubAllEnvs());
const NOW = new Date('2026-10-09T00:00:00Z');

describe('buildGrant', () => {
  it('shares the profile only by default, for 90 days, for recruiter review, and never sends a candidate id', () => {
    const g = buildGrant({ employerId: 'e1', now: NOW });
    expect(g).toEqual({ employer_id: 'e1', scope: { parts: ['profile'] }, purpose: 'recruiter_review', expires_at: '2027-01-07T00:00:00.000Z' });
    expect(DEFAULT_DAYS).toBe(90);
    expect(Object.keys(g)).not.toContain('candidate_id');
    expect(Object.keys(g)).not.toContain('user_id');
  });
  it('adds the salary part only when asked', () => {
    expect(buildGrant({ employerId: 'e1', shareSalary: true, now: NOW }).scope.parts).toEqual(['profile', 'salary']);
  });
  it('needs an employer', () => { expect(() => buildGrant({ shareSalary: false })).toThrow(); });
  it('stays inside the database limit of 365 days', () => {
    expect(DEFAULT_DAYS).toBeLessThanOrEqual(365);
  });
});

describe('isActive and groupByEmployer', () => {
  const row = (o) => ({ id: 'c', employer_id: 'e1', purpose: 'recruiter_review', scope: { parts: ['profile'] }, expires_at: '2026-12-01T00:00:00Z', revoked_at: null, ...o });
  it('a consent is active only if unrevoked, unexpired and for recruiter review', () => {
    expect(isActive(row({}), NOW)).toBe(true);
    expect(isActive(row({ revoked_at: '2026-10-01T00:00:00Z' }), NOW)).toBe(false);
    expect(isActive(row({ expires_at: '2026-10-08T00:00:00Z' }), NOW)).toBe(false);
    expect(isActive(row({ purpose: 'matching' }), NOW)).toBe(false);
    expect(isActive(null, NOW)).toBe(false);
  });
  it('combines the parts of several active consents and keeps the latest expiry; the rest is history', () => {
    const g = groupByEmployer([
      row({ id: 'a', scope: { parts: ['profile'] }, expires_at: '2026-11-01T00:00:00Z' }),
      row({ id: 'b', scope: { parts: ['salary'] }, expires_at: '2026-12-15T00:00:00Z' }),
      row({ id: 'c', revoked_at: '2026-10-02T00:00:00Z' }),
      row({ id: 'd', expires_at: '2026-01-01T00:00:00Z' }),
      row({ id: 'x', employer_id: 'e2' }),
      row({ id: 'y', employer_id: 'e3', purpose: 'verification_share' }),
    ], NOW).get('e1');
    expect(g.active.map((c) => c.id)).toEqual(['a', 'b']);
    expect(g.parts.sort()).toEqual(['profile', 'salary']);
    expect(g.expiresAt).toBe('2026-12-15T00:00:00Z');
    expect(g.history.map((c) => c.id).sort()).toEqual(['c', 'd']);
  });
  it('ignores consents of other purposes and tolerates empty input', () => {
    expect(groupByEmployer([row({ employer_id: 'e3', purpose: 'verification_share' })], NOW).size).toBe(0);
    expect(groupByEmployer(undefined, NOW).size).toBe(0);
  });
});

describe('canShare', () => {
  it('needs a saved profile with a name', () => {
    expect(canShare(null).ok).toBe(false);
    expect(canShare({ full_name: '  ' }).ok).toBe(false);
    expect(canShare({ full_name: 'Alice' }).ok).toBe(true);
  });
});

describe('what the dialog says is released', () => {
  it('lists the profile fields, and the salary only when chosen', () => {
    expect(releasedFields({ shareSalary: false, profile: {} })).toEqual(PART_FIELDS.profile);
    const withSalary = releasedFields({ shareSalary: true, profile: { salary_min: 90000, salary_max: 120000, currency: 'SGD' } });
    expect(withSalary.at(-1)).toBe('Expected salary range (SGD 90000–120000)');
    expect(releasedFields({ shareSalary: true, profile: {} }).at(-1)).toMatch(/none saved yet/);
  });
  it('the "not shared" list names resume, email, credentials and practice scores, and the field lists never contain them', () => {
    expect(NOT_SHARED).toEqual(['Resume text', 'Email address', 'Credentials', 'Practice scores']);
    const released = [...PART_FIELDS.profile, ...PART_FIELDS.salary].join(' ').toLowerCase();
    for (const n of NOT_SHARED) expect(released).not.toContain(n.toLowerCase());
    for (const word of ['resume', 'email', 'credential', 'practice']) expect(COPY.notShared.toLowerCase()).toContain(word);
  });
});

describe('the feature flag', () => {
  it('is off unless VITE_CONSENT_FLOW is exactly "true"', () => {
    expect(consentFlowEnabled()).toBe(false);
    vi.stubEnv('VITE_CONSENT_FLOW', 'true'); expect(consentFlowEnabled()).toBe(true);
    vi.stubEnv('VITE_CONSENT_FLOW', '1'); expect(consentFlowEnabled()).toBe(false);
    vi.stubEnv('VITE_CONSENT_FLOW', 'false'); expect(consentFlowEnabled()).toBe(false);
  });
  it('is not enabled in the committed environment files', () => {
    const root = path.resolve(__dirname, '../../..');
    for (const f of ['.env.example', '.env.production']) {
      const p = path.join(root, f);
      if (fs.existsSync(p)) expect(fs.readFileSync(p, 'utf8')).not.toMatch(/VITE_CONSENT_FLOW\s*=\s*true/i);
    }
  });
});

describe('wording', () => {
  it('never claims compliance, and every wording string lives in consentCopy.js', () => {
    const all = JSON.stringify(Object.values(COPY).map((v) => (typeof v === 'function' ? v('X', 'Y') : v))).toLowerCase();
    expect(all).not.toMatch(/compliant|guarantee|gdpr|certified/);
    expect(formatDate('2026-12-15T23:59:59Z')).toBe('15 Dec 2026');
  });
});
