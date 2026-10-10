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
  it('says plainly that the product is free during the beta and that no paid plans exist yet', () => {
    expect(LIVE['LandingPage component']).toMatch(/Free while we build/);
    expect(LIVE['LandingPage component']).toMatch(/Paid plans are not available yet/);
    expect(LIVE['Terms modal']).toMatch(/free during the beta/i);
    expect(LIVE['Terms modal']).toMatch(/nothing is charged/i);
  });
  it('the navigation and footer have no Pricing link', () => {
    const nav = LIVE['LandingPage component'];
    expect(nav).not.toMatch(/href="#v36-pricing">Pricing</);
    expect(nav).not.toMatch(/'TrustMatch','Pricing'/);
  });
});
