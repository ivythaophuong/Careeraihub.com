// The landing page used to carry promises the product cannot prove (AES-256, SOC 2, penetration tests, "PDPA compliant", deletion in 24 hours,
// "never shared with recruiters") and a company name for a company that is not registered. It must not say them again, and its Privacy and
// Terms must come from the one source in legalContent.js.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.resolve(__dirname, '../Landing/LandingPage.jsx'), 'utf8');

describe('LandingPage legal and trust claims', () => {
  it.each([
    'AES-256', 'TLS 1.3', 'SOC 2', 'penetration', 'bcrypt', 'PDPA compliant', 'PDPA Compliant', 'GDPR',
    'within 24 hours', 'CareerAiHub Pte. Ltd.', 'hello@careeraihub.com', 'privacy@careeraihub.com',
    'never sell or share your data with recruiters',
  ])('does not contain %s', (claim) => {
    expect(src).not.toContain(claim);
  });

  it('renders Privacy and Terms from the shared legal source', () => {
    expect(src).toMatch(/PRIVACY_SECTIONS/);
    expect(src).toMatch(/TERMS_SECTIONS/);
    expect(src).not.toMatch(/function PrivacyModal|function ToSModal/);
  });
});
