// @vitest-environment node
// The live landing page and the in-app study-plan modal must not state prices, trials, ratings, user counts or integrations that the product does not have.
// (Owner decision 2026-10-10: free beta, no paid plans, nothing charged; claims audit: docs/product/LANDING-CLAIMS-AUDIT.md.)
// Only the parts that are actually rendered are checked: the default LandingPage component, StudyPlanModal and the Terms modal. Older unused
// components in the same file still contain old copy; deleting them is a separate cleanup.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.resolve(__dirname, '../../src/features/Landing/LandingPage.jsx'), 'utf8');
const slice = (startMarker, endMarker) => {
  const a = src.indexOf(startMarker);
  const b = endMarker ? src.indexOf(endMarker, a + 1) : src.length;
  expect(a, `${startMarker} not found`).toBeGreaterThan(-1);
  return src.slice(a, b > -1 ? b : src.length);
};
const LIVE = {
  'LandingPage component': slice('export default function LandingPage'),
  'StudyPlanModal': slice('export function StudyPlanModal', 'function SampleReportModal'),
  'Terms modal': slice('function ToSModal', 'function CookieBanner'),
};

const FORBIDDEN = [
  [/\$\s?\d+(\.\d+)?\s?(\/|per)\s?(mo|month|week|year)/i, 'a price'],
  [/\bSGD\s?\d+(\.\d+)?\s?\/\s?mo/i, 'a price in SGD'],
  [/\b7-day\b.*\b(trial|full access)/i, 'a free trial'],
  [/cancel anytime/i, '"cancel anytime" (nothing is sold)'],
  [/money-back|refund/i, 'a refund promise'],
  [/\bupgrade to (pro|premium)\b/i, 'an upgrade button for a plan that does not exist'],
  [/2,714/, 'a user or profile count'],
  [/4\.9\s?★|★★★★★/, 'a star rating'],
  [/\b95% ATS Match Rate\b/i, 'an invented match rate'],
  [/Premium · locked/, 'a locked premium badge'],
  [/Singapore's verified career platform/i, 'a verified-platform claim'],
  [/From Invisible/, 'the old headline (with a grammar slip)'],
  [/free forever/i, '"free forever" (credits and plans are planned)'],
  [/modules? unlocked instantly/i, 'an unlock claim'],
  [/blockchain[- ](anchored|verified|backed)|blockchain-verifiable/i, 'a blockchain claim'],
  [/Connect OpenCerts, Credly, Singpass/i, 'an integration that does not exist'],
  [/Singpass for identity, OpenCerts/i, 'an integration that does not exist'],
  [/identity verification \(25%\)/i, 'a Trust Score formula that is not the real one'],
];

describe('the live landing copy does not promise what the product does not have', () => {
  for (const [name, text] of Object.entries(LIVE)) {
    it.each(FORBIDDEN)(`${name}: no %s (%s)`, (re) => {
      const hit = text.match(re);
      expect(hit ? hit[0] : null).toBeNull();
    });
  }
  it('has no pricing section on the landing page: prices are shown inside the product, after use', () => {
    const page = LIVE['LandingPage component'];
    expect(page).not.toMatch(/id="v36-pricing"/);
    expect(page).not.toMatch(/Free while we build/);
  });
  it('the Terms say plainly that nothing is charged without explicit agreement and that no payment is taken now', () => {
    expect(LIVE['Terms modal']).toMatch(/No payment is taken at present/);
    expect(LIVE['Terms modal']).toMatch(/explicitly agreed/);
  });
  it('the navigation and footer have no Pricing link', () => {
    const nav = LIVE['LandingPage component'];
    expect(nav).not.toMatch(/href="#v36-pricing">Pricing</);
    expect(nav).not.toMatch(/'TrustMatch','Pricing'/);
  });
});

describe('hero copy chosen by the owner (2026-10-10)', () => {
  const page = LIVE['LandingPage component'];
  const left = page.slice(page.indexOf('className="v36-hero-left'), page.indexOf('className="v36-hero-right'));
  it.each([
    'Your career operating system', 'Built for Every', 'Next Chapter.', 'Your career is always evolving. Your tools should evolve with it.',
    'Your skills. Your progress. Your next move.',
    'Understand your strengths. Build your capabilities. Prepare for new opportunities. Keep your career moving forward — all in one place.',
    'Proof over claims.', 'The principle behind everything we build.',
  ])('the left side says: %s', (text) => expect(left).toContain(text));
  it('has no gradient text in the left side', () => {
    expect(left).not.toMatch(/WebkitBackgroundClip|backgroundClip/);
  });
  it('the right side (the example dashboard card) is still there', () => {
    const right = page.slice(page.indexOf('className="v36-hero-right'), page.indexOf('className="v36-hero-right') + 4000);
    expect(right).toContain('ndc-wrap');
    expect(right).toContain('TRUSTMATCH VERIFIED');
  });
});
