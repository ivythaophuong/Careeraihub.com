// Every browser call to an Edge Function builds its address from FUNCTIONS_URL, so the dev proxy covers all of them. A call built from
// SUPABASE_URL would bypass it and fail on localhost.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../../src');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(jsx?)$/.test(e.name) && !/\.test\./.test(e.name)) files.push(full);
  }
})(SRC);

describe('Edge Function addresses', () => {
  it('no source file builds a /functions/v1 address from SUPABASE_URL', () => {
    const bad = files.filter(f => /\$\{SUPABASE_URL\}\/functions\/v1/.test(fs.readFileSync(f, 'utf8'))).map(f => path.relative(SRC, f));
    expect(bad).toEqual([]);
  });

  it('every file that builds one imports FUNCTIONS_URL', () => {
    const using = files.filter(f => /\/functions\/v1/.test(fs.readFileSync(f, 'utf8')));
    expect(using.length).toBeGreaterThan(0);
    const missing = using.filter(f => !/FUNCTIONS_URL/.test(fs.readFileSync(f, 'utf8'))).map(f => path.relative(SRC, f));
    expect(missing).toEqual([]);
  });
});
