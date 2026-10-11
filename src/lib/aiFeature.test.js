import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const callLLM = vi.fn(async () => 'ok');
vi.mock('./ai.jsx', () => ({ callLLM: (...a) => callLLM(...a) }));
import { callLLMFor, resumeCounts } from './aiFeature.js';

describe('callLLMFor', () => {
  it('passes messages, token limit and PDF through unchanged, and adds only a feature label and counts', async () => {
    callLLM.mockClear();
    await callLLMFor('mock_questions', { kind: 'text', text: 'abcde' })([{ role: 'user', content: 'x' }], 2500, 'PDF');
    expect(callLLM).toHaveBeenCalledWith([{ role: 'user', content: 'x' }], 2500, 'PDF', { feature: 'mock_questions', resumeKind: 'text', resumeChars: 5 });
  });
  it('sends no resume counts when the call carries no resume', async () => {
    callLLM.mockClear();
    await callLLMFor('ai_coach')([{ role: 'user', content: 'x' }], 600);
    expect(callLLM).toHaveBeenCalledWith([{ role: 'user', content: 'x' }], 600, null, { feature: 'ai_coach' });
  });
  it('counts characters only; the helper never copies resume text into the options', () => {
    const r = resumeCounts({ kind: 'text', text: 'Jane Doe jane@example.com' });
    expect(r).toEqual({ resumeKind: 'text', resumeChars: 25 });
    expect(JSON.stringify(r)).not.toMatch(/Jane|example/);
    expect(resumeCounts({ kind: 'pdf', text: '', pdfBase64: 'AAAA' })).toEqual({ resumeKind: 'pdf', resumeChars: 0 });
    expect(resumeCounts({ kind: 'text', chars: 4000 })).toEqual({ resumeKind: 'text', resumeChars: 4000 });
    expect(resumeCounts({ kind: 'weird', text: 'x' })).toEqual({});
    expect(resumeCounts(null)).toEqual({});
  });
});

// Stage 1 rule: every model call in the app names its feature. A bare callLLM( would be logged as a coarse "tab_..." label.
describe('every call site names its feature', () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
  const files = walk(path.join(process.cwd(), 'src')).filter((f) => /\.(js|jsx)$/.test(f) && !/\.test\./.test(f));
  it('no file outside ai.jsx, aiFeature.js and the unused resumeParser calls callLLM( directly', () => {
    const offenders = files
      .filter((f) => !/src\/lib\/(ai\.jsx|aiFeature\.js|resumeParser\.js)$/.test(f.replace(/\\/g, '/')))
      .filter((f) => /\bcallLLM\(/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(process.cwd(), f));
    expect(offenders).toEqual([]);
  });
  it('feature labels used are unique and match the allowed pattern', () => {
    const labels = files.filter((f) => !/aiFeature/.test(f)).flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/callLLMFor\('([a-z0-9_]+)'/g)].map((m) => m[1]));
    expect(labels.length).toBeGreaterThanOrEqual(16);
    expect(new Set(labels).size).toBe(labels.length);
    for (const l of labels) expect(l).toMatch(/^[a-z0-9_]{1,40}$/);
  });
});
