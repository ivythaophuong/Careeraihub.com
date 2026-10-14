// Tests in tests/integration call real services. Found 2026-10-14: auth.test.js signed up real accounts (test_<time>@mailinator.com) on the production
// Supabase project every time the whole suite was run, and sign-up is open without email confirmation. A file there that touches the network or a
// project address must be opt-in: skipped unless RUN_LIVE_TESTS is set, so `npx vitest run` never creates anything outside the machine.
// This test only READS those files; it never runs them.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(__dirname, '../integration');
const files = fs.readdirSync(DIR).filter((f) => /\.test\.[jt]sx?$/.test(f));
const TOUCHES_NETWORK = /\bfetch\s*\(|supabase\.co|XMLHttpRequest|WebSocket/;

describe('tests that call real services are opt-in', () => {
  it('there is something to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });
  it.each(files)('%s is skipped unless RUN_LIVE_TESTS is set', (f) => {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    if (!TOUCHES_NETWORK.test(src)) return;                   // a file with no network call may run always
    expect(src).toMatch(/process\.env\.RUN_LIVE_TESTS/);
    expect(src).toMatch(/\.skipIf\(/);
  });
  it.each(files)('%s does not call the network outside a skipIf block (every fetch helper is only reached from skipped tests)', (f) => {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    if (!TOUCHES_NETWORK.test(src)) return;
    // The tests that use signUp( or signIn( are the ones that reach the network: each must be an it.skipIf or sit in a describe.skipIf.
    const lines = src.split('\n');
    const bad = [];
    let describeSkipped = false;
    lines.forEach((line, i) => {
      if (/^describe(\.skipIf\([^)]*\))?\(/.test(line)) describeSkipped = /^describe\.skipIf\(/.test(line);
      if (/^\s+it(\.skipIf\([^)]*\))?\(/.test(line)) {
        const skipped = describeSkipped || /\bit\.skipIf\(/.test(line);
        // read the body of this test until the next test or the end of the describe
        let j = i + 1; const body = [];
        while (j < lines.length && !/^\s+it(\.skipIf\([^)]*\))?\(/.test(lines[j]) && !/^\}\);/.test(lines[j])) body.push(lines[j++]);
        if (!skipped && /\b(signUp|signIn)\s*\(/.test(body.join('\n'))) bad.push(line.trim().slice(0, 80));
      }
    });
    expect(bad).toEqual([]);
  });
});
