// Guards the main security fix: no provider API key or direct provider call may ship in the browser bundle.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../../src');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(jsx?|css)$/.test(e.name) && !/\.test\./.test(e.name)) files.push(full);
  }
})(SRC);
const offenders = (re) => files.filter(f => re.test(fs.readFileSync(f, 'utf8'))).map(f => path.relative(SRC, f));

describe('no secrets or direct provider calls in client source', () => {
  it.each([
    ['provider API key env vars', /VITE_[A-Z_]*(ANTHROPIC|OPENAI|GEMINI|ADZUNA)[A-Z_]*/],
    ['Anthropic API URL', /api\.anthropic\.com/],
    ['Gemini API URL', /generativelanguage\.googleapis\.com/],
    ['OpenAI API URL', /api\.openai\.com/],
    ['Adzuna API URL', /api\.adzuna\.com/],
    ['key-shaped strings', /sk-ant-api03-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{30,}|AQ\.[A-Za-z0-9_-]{30,}/],
  ])('has no %s', (_name, re) => {
    expect(offenders(re)).toEqual([]);
  });
});
