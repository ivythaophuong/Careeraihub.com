// @vitest-environment node
// Rules for the model-evaluation scripts in scripts/audit: no key in a file, keys only from the environment, no path of one machine, and each script can be
// run without a network (--dry-run). The dry runs start the scripts with vite-node, so they take a few seconds each.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DIR = path.resolve(__dirname, '../../scripts/audit');
const SCRIPTS = ['providerCompare.mjs', 'blindTest.mjs', 'rewriteTest.mjs', 'rewriteReport.mjs', 'modelEvalCore.mjs'];
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

describe.each(SCRIPTS)('%s', (f) => {
  const src = read(f);
  it('has no key-shaped string and no hard-coded key', () => {
    expect(src).not.toMatch(/sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{30,}|gsk_[A-Za-z0-9]{20,}/);
    expect(src).not.toMatch(/(api[_-]?key|token|secret)\s*[:=]\s*['"][A-Za-z0-9_-]{16,}['"]/i);
  });
  it('has no path of one machine', () => {
    expect(src).not.toMatch(/\/Users\/|\/private\/tmp\/|\/home\/[a-z]+\//);
  });
  it('does not print or write a key', () => {
    expect(src).not.toMatch(/console\.(log|error)\([^)]*process\.env\[[^\]]*KEY/);
  });
});

describe('the scripts that call models', () => {
  it.each(['providerCompare.mjs', 'blindTest.mjs', 'rewriteTest.mjs'])('%s takes its key from process.env only and has a --dry-run', (f) => {
    const src = read(f);
    expect(src).toMatch(/process\.env\[KEY_ENV\[/);
    expect(src).toMatch(/--dry-run/);
  });
  it('the README tells how to run them and what they cost', () => {
    const readme = fs.readFileSync(path.join(DIR, 'README.md'), 'utf8');
    for (const f of ['providerCompare', 'blindTest', 'rewriteTest', 'rewriteReport']) expect(readme).toContain(f);
    expect(readme).toMatch(/cost/i);
    expect(readme).toMatch(/never paste a key/i);
  });
});

describe('dry runs (no network, no keys)', () => {
  const run = (args) => execFileSync('npx', ['vite-node', ...args], { cwd: path.resolve(DIR, '../..'), encoding: 'utf8', env: { ...process.env, GROQ_API_KEY: '', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', GEMINI_API_KEY: '' }, timeout: 90_000, stdio: ['ignore', 'pipe', 'pipe'] });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'model-eval-'));

  it('providerCompare scores 36 invented resumes with a pretend model', () => {
    const out = run(['scripts/audit/providerCompare.mjs', '--dry-run']);
    expect(out).toMatch(/\| pretend \| 36 \| 0 \| 36 \|/);
  }, 120_000);
  it('rewriteTest runs the 12 invented resumes and writes a result that rewriteReport can read', () => {
    const outdir = path.join(tmp, 'rw');
    const out = run(['scripts/audit/rewriteTest.mjs', '--dry-run', '--outdir', outdir]);
    expect(out).toMatch(/\| luna \| 12\/12 \| 12 \|/);
    const report = execFileSync('node', ['scripts/audit/rewriteReport.mjs', path.join(outdir, 'rewrite-results.json')], { cwd: path.resolve(DIR, '../..'), encoding: 'utf8' });
    expect(report).toMatch(/\| haiku \| 12\/12 \|/);
  }, 120_000);
  it('blindTest writes the answers, the rating sheet and the sealed key, and hides which model is which in what you read', () => {
    const outdir = path.join(tmp, 'bl');
    run(['scripts/audit/blindTest.mjs', '--dry-run', '--outdir', outdir]);
    const blind = fs.readFileSync(path.join(outdir, 'blind.md'), 'utf8');
    expect(blind).toMatch(/### Answer A/);
    expect(fs.existsSync(path.join(outdir, '.sealed-key.json'))).toBe(true);
    expect(fs.readFileSync(path.join(outdir, 'ratings.csv'), 'utf8').trim().split('\n')).toHaveLength(31);
    expect(blind).not.toMatch(/gpt-oss|claude-haiku|gpt-6-luna/);
  }, 120_000);
});
