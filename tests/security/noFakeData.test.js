// @vitest-environment node
// Guards user-facing integrity: no invented numbers, counters, scores or "live" claims may reach the UI.
// The rules match CATEGORIES of claim, not exact strings, so deleting one known string and leaving
// its sibling does not pass. Anything that must stay is listed in KNOWN_OPEN with a reason; the test
// fails if a listed item disappears (remove it from the list) or a new, unlisted hit appears.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// FAKEDATA_SRC lets the same rules be run against another checkout (e.g. a snapshot of an older commit).
const SRC = process.env.FAKEDATA_SRC ? path.resolve(process.env.FAKEDATA_SRC) : path.resolve(__dirname, '../../src');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(jsx?|css)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(full);
  }
  return out;
}
const files = walk(SRC).map(f => ({ rel: path.relative(SRC, f).replace(/\\/g, '/'), lines: fs.readFileSync(f, 'utf8').split('\n') }));

// A line that says the data is missing, or not ready yet, is a disclaimer, not a claim.
const NEGATED = /\b(not|no|never|don't|doesn't|do not|does not|without|isn't)\b|being prepared|we're preparing|temporarily unavailable/i;
// Code comments and input placeholders are not shown as claims.
const NOT_A_CLAIM = (l) => /^\s*(\/\/|\{?\/\*|\*)/.test(l) || /placeholder\s*=/.test(l);

// Each rule flags a line. `skip` exempts lines that are clearly not a claim (ids, disclaimers).
const RULES = [
  { id: 'random-value', re: /Math\.random\(/, skip: l => /Math\.random\(\)\.toString\(36\)/.test(l) /* id generation, never shown */ },
  { id: 'fake-live-counter', re: /ms-live|sc-live|setLiveCount|setMs1|job seekers active|users? online/i },
  { id: 'fake-wait-then-result', re: /await new Promise\(\s*\w+\s*=>\s*setTimeout\(\s*\w+\s*,\s*\d{3,}\s*\)\s*\)|setTimeout\(\s*\(\)\s*=>\s*\{\s*set(Result|Fb|Refined|Alternatives|SalaryData|Score)/ },
  { id: 'fake-scan-text', re: /Scanning your resume against this role|Mining historical compensation/i },
  { id: 'live-market-claim', re: /\blive (salary|market|singapore|hiring)|real-?time (salary|market)|salary benchmarks?|hiring velocity|live data/i, skip: l => NEGATED.test(l) },
  { id: 'unsourced-statistic', re: /\d+(\.\d+)?\s*×|\baverage salary\b|\bindustry avg\b|\bsuccessful candidates\b|left on (the )?table|\$\d{2,3},\d{3}\b|\$\d+K\b|\d+% of (resumes|senior|successful)/i },
];

// Known, reviewed exceptions. Every entry needs a reason. `match` is a substring of the flagged line.
const KNOWN_OPEN = [
  // Landing "journey" animation: the salary cards are labelled "Example data · ..." and show a sample offer.
  { file: 'features/Landing/LandingPage.jsx', rule: 'unsourced-statistic', match: '$10,500', reason: 'Journey demo card labelled "Example data"; not a market figure' },
  { file: 'features/Landing/LandingPage.jsx', rule: 'unsourced-statistic', match: '$14,000', reason: 'Journey demo card labelled "Example data"; not a market figure' },
];

function scan() {
  const hits = [];
  for (const f of files) {
    f.lines.forEach((line, i) => {
      for (const r of RULES) {
        if (!NOT_A_CLAIM(line) && r.re.test(line) && !(r.skip && r.skip(line))) hits.push({ file: f.rel, line: i + 1, rule: r.id, text: line.trim().slice(0, 160) });
      }
    });
  }
  return hits;
}
const covered = (h) => KNOWN_OPEN.some(k => k.file === h.file && k.rule === h.rule && h.text.includes(k.match));

describe('no fabricated data reaches the UI', () => {
  const hits = scan();

  for (const r of RULES) {
    it(`rule "${r.id}": no unreviewed hits`, () => {
      const bad = hits.filter(h => h.rule === r.id && !covered(h)).map(h => `${h.file}:${h.line}  ${h.text}`);
      expect(bad).toEqual([]);
    });
  }

  it('every KNOWN_OPEN entry still matches something (remove entries once fixed)', () => {
    const stale = KNOWN_OPEN.filter(k => !hits.some(h => h.file === k.file && h.rule === k.rule && h.text.includes(k.match)));
    expect(stale.map(k => `${k.file} :: ${k.match}`)).toEqual([]);
  });
});
