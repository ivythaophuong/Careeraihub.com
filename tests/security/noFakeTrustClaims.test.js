// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// The score shown as "Practice score" comes from the user's own practice activity, not from verified
// evidence. These phrases claimed otherwise (or invented figures) and must not come back.
// The marketing Landing page is excluded: its demo mock-ups are a separate review (pricing/claims).
const FORBIDDEN = [
  'Top 10%',
  'Verified profile',
  'verification unlocks',
  'Verify at least one credential to unlock',
  'verified profile unlocks TrustMatch',
  'Verify your education and employment to reach',
  'AI mapping the global job market',
];

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'Landing' ? [] : sourceFiles(p);
    return /\.(jsx?|tsx?)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

describe('no manufactured trust claims in the UI', () => {
  const files = sourceFiles(path.resolve(__dirname, '../../src'));
  for (const phrase of FORBIDDEN) {
    it(`"${phrase}" does not appear`, () => {
      const hits = files.filter(f => fs.readFileSync(f, 'utf8').includes(phrase)).map(f => path.relative(path.resolve(__dirname, '../../src'), f));
      expect(hits).toEqual([]);
    });
  }
});
