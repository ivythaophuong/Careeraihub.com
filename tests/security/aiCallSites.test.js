// @vitest-environment node
// Every place that asks a model for something is listed here with the tier that decides how it may be served
// (docs/architecture/plans/DESIGN-ai-routing-by-feature.md). A new AI call that is not in this list fails the test, so the
// routing design, the privacy review and the cost review cannot silently miss it. Add the feature to the design first, then here.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../../src');
const FUNCTIONS = path.resolve(__dirname, '../../supabase/functions');

// Labels sent by the browser through callLLMFor(label). The server cannot trust them for security (they are only labels).
const BROWSER_LABELS = [
  'ai_coach', 'ats_bullet_rewrite', 'ats_parse', 'cover_letter', 'cover_letter_tone', 'jd_analyze', 'memory_plan',
  'mock_evaluate_legacy', 'mock_questions', 'onboarding_pdf_extract', 'onboarding_profile', 'salary_market',
  'salary_script', 'scan_jd_match', 'scan_template_parse', 'skills_gap', 'star_review_legacy',
];
// Labels the Edge Functions set themselves (trusted).
const SERVER_LABELS = ['score_interview_evaluate', 'score_star_review'];
// Calls to callLLM() without a label. Only the unused resume parser; a new one must be labelled.
const UNLABELLED_FILES = ['lib/resumeParser.js'];

function walk(dir, ok, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, ok, out);
    else if (ok(e.name)) out.push(full);
  }
  return out;
}
const srcFiles = walk(SRC, n => /\.jsx?$/.test(n) && !/\.test\./.test(n));
const read = f => fs.readFileSync(f, 'utf8');

describe('AI call sites are all accounted for', () => {
  it('every callLLMFor label in the browser code is listed', () => {
    const found = new Set();
    for (const f of srcFiles) for (const m of read(f).matchAll(/callLLMFor\(\s*'([a-z0-9_]+)'/g)) found.add(m[1]);
    expect([...found].sort()).toEqual([...BROWSER_LABELS].sort());
  });

  it('no unlabelled callLLM() call exists outside the listed file', () => {
    const offenders = [];
    for (const f of srcFiles) {
      const rel = path.relative(SRC, f).replace(/\\/g, '/');
      if (rel === 'lib/ai.jsx' || rel === 'lib/aiFeature.js' || UNLABELLED_FILES.includes(rel)) continue;
      if (/(?<![A-Za-z])callLLM\(/.test(read(f))) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it('every Edge Function label that calls a provider is listed', () => {
    const handlers = walk(FUNCTIONS, n => n === 'handler.js');
    const callers = handlers.filter(f => /callWithFallback\(/.test(read(f)) && !/\/ai\/handler\.js$/.test(f));
    const found = new Set();
    for (const f of callers) for (const m of read(f).matchAll(/feature:\s*'([a-z0-9_]+)'/g)) found.add(m[1]);
    expect([...found].sort()).toEqual([...SERVER_LABELS].sort());
  });

  it('only the three known Edge Functions call a model provider', () => {
    const handlers = walk(FUNCTIONS, n => n === 'handler.js' || n === 'providers.js');
    const names = new Set(handlers.filter(f => /callWithFallback\(|callProvider(Detailed)?\(/.test(read(f))).map(f => path.basename(path.dirname(f))));
    expect([...names].sort()).toEqual(['ai', 'score-interview', 'score-star']);
  });

  it('the browser never calls a model provider directly', () => {
    const direct = srcFiles.filter(f => /api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.openai\.com|api\.groq\.com|openrouter\.ai/.test(read(f)));
    expect(direct.map(f => path.relative(SRC, f))).toEqual([]);
  });
});
