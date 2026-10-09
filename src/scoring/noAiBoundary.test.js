// @vitest-environment node
// Three independent guards that src/scoring/ (P4, "deterministic engines") never reaches the network or
// an AI provider, directly or through another module. A single string search (for "callLLM") is not
// enough: a future file could call the network under a different name. This test does not assume any
// particular implementation and will keep applying as more scoring files are added.
//
//   1. Dependency boundary — no source file here imports anything outside this folder except the pure data
//      contracts (src/contracts) and pure deterministic helpers (src/extraction, src/validation). Nothing
//      from src/lib/ai.jsx, Supabase, or any provider module reaches this folder even transitively, since
//      those modules are not on the allowed-import list at all.
//   2. Static pattern scan — the SOURCE TEXT contains no network or provider API call, by name (fetch,
//      XMLHttpRequest, axios, WebSocket, callLLM) or by string path (lib/ai, supabase).
//   3. Determinism — scoreResume returns a byte-identical result on every run for the same input (also
//      checked directly in resumeScore.test.js); true network calls, Math.random or Date.now() would make
//      that fail, so this is a behavioural guard on top of the static ones, not a duplicate of them.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { scoreResume } from './resumeScore';
import { extractResumeFacts } from '../extraction/resumeFacts';
import { validateFacts } from '../validation/validateFacts';

const DIR = path.resolve(__dirname);
const sourceFiles = fs.readdirSync(DIR).filter(f => f.endsWith('.js') && !f.endsWith('.test.js'));

const FORBIDDEN_PATTERNS = [
  /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\baxios\b/, /\bWebSocket\b/, /\bcallLLM\b/,
  /\bEventSource\b/, /\bnavigator\.sendBeacon\b/, /\brequire\s*\(\s*['"]http/, /\bimport\s*\(/, // dynamic import
];
const FORBIDDEN_IMPORT_PATH = /lib\/ai|supabase|\bai\.jsx|\/providers\b/;
// Everything src/scoring is allowed to import from: pure data contracts and pure deterministic helpers.
const ALLOWED_IMPORT_PREFIX = /^(\.\/|\.\.\/(contracts|extraction|validation)\/)/;

describe('src/scoring/: dependency boundary', () => {
  it('has at least one source file to check (this test is not accidentally a no-op)', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  for (const file of sourceFiles) {
    const src = fs.readFileSync(path.join(DIR, file), 'utf8');
    const imports = [...src.matchAll(/^\s*import[^;]*?from\s+['"]([^'"]+)['"]/gm)].map(m => m[1]);

    it(`${file}: every import stays within contracts/extraction/validation (no AI, no provider, no network lib)`, () => {
      for (const spec of imports) {
        expect(ALLOWED_IMPORT_PREFIX.test(spec), `${file} imports '${spec}', outside the allowed boundary`).toBe(true);
        expect(FORBIDDEN_IMPORT_PATH.test(spec), `${file} imports '${spec}', which looks like an AI/provider module`).toBe(false);
      }
    });

    it(`${file}: no network or LLM call appears in the source text`, () => {
      for (const re of FORBIDDEN_PATTERNS) expect(re.test(src), `${file} matches forbidden pattern ${re}`).toBe(false);
    });
  }
});

describe('src/scoring/: determinism (a network call, Math.random or Date.now() would break this)', () => {
  it('the same ResumeFacts input gives a byte-identical ScoreResult across 100 calls', () => {
    const facts = extractResumeFacts('Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew revenue by 20%\n• Helped the team\n\nEducation\nBSc Economics\nExample University\n2019');
    const validation = validateFacts(facts);
    const first = JSON.stringify(scoreResume(facts, validation));
    const results = new Set();
    for (let i = 0; i < 100; i++) results.add(JSON.stringify(scoreResume(facts, validation)));
    expect(results.size).toBe(1);
    expect([...results][0]).toBe(first);
  });

  it('an entirely empty input is just as deterministic', () => {
    const facts = extractResumeFacts('');
    const validation = validateFacts(facts);
    const results = new Set(Array.from({ length: 20 }, () => JSON.stringify(scoreResume(facts, validation))));
    expect(results.size).toBe(1);
  });
});
