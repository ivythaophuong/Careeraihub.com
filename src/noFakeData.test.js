// Guard against reintroducing fabricated data: hardcoded "results" behind timers, random scores,
// invented live counters, and unsourced statistics presented as fact.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname);
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(jsx?|css)$/.test(e.name) && !/\.test\./.test(e.name)) files.push(full);
  }
})(SRC);
const read = (f) => fs.readFileSync(f, 'utf8');
const rel = (f) => path.relative(SRC, f);
const jsx = files.filter(f => /\.jsx?$/.test(f));

describe('no fabricated data in the app source', () => {
  it('does not use Math.random to produce user-visible numbers', () => {
    const offenders = jsx.filter(f => /Math\.random\(/.test(read(f))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('has no feature that fakes AI work with a timer and canned results', () => {
    // Real calls go through callLLM / the Edge Functions; features must not setTimeout their way to a "result".
    const features = jsx.filter(f => /src\/features\//.test(f.replace(/\\/g, '/')) && !/Landing/.test(f));
    const offenders = features.filter(f => /setTimeout\(\s*\(\)\s*=>\s*\{\s*set(Result|Fb|Refined|Alternatives|SalaryData)/.test(read(f))).map(rel);
    expect(offenders).toEqual([]);
  });

  it.each([
    '$155,000', '$135,000', '$110,000', '$165,000', 'Market Min',
    '85% of successful', 'Statistical analysis for',
    'job seekers using CareerAiHub right now',
    '75%', '$18K', '3.2×', '38% → 91%',
  ])('does not contain the unsourced claim %s', (claim) => {
    const offenders = jsx.filter(f => read(f).includes(claim)).map(rel);
    expect(offenders).toEqual([]);
  });

  it('does not label anything "Live" that is not live', () => {
    const landing = read(path.join(SRC, 'features/Landing/LandingPage.jsx'));
    expect(landing).not.toMatch(/ms-live|hf-live|>Live</);
  });
});
