// @vitest-environment node
// What a search engine, a link preview or an AI assistant reads before any JavaScript runs: the head of index.html, the page text inside #root, and llms.txt.
// It must say what the product does today (ADR-013 item 6: no "verified" before something is verified; no promise of a result). Credential checks are in development and employer matching is planned.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const llms = fs.readFileSync(path.join(root, 'public/llms.txt'), 'utf8');
const meta = (re) => html.match(re)?.[1] ?? '';
const head = html.slice(0, html.indexOf('</head>'));
const staticBody = html.slice(html.indexOf('<main'), html.indexOf('</main>'));

const FORBIDDEN = [/verified skills/i, /trust infrastructure/i, /signed offer/i, /smarter matching/i, /exactly what('|’)?s costing/i, /hiring beyond resumes/i, /senior hiring manager/i, /guarantee/i];

describe('the title and the description', () => {
  it('describe the tools, not a result, and fit what search results show', () => {
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    const desc = meta(/<meta name="description" content="([^"]*)"/);
    expect(title.length).toBeGreaterThan(20); expect(title.length).toBeLessThanOrEqual(65);
    expect(desc.length).toBeGreaterThan(80); expect(desc.length).toBeLessThanOrEqual(160);
    expect(title).toMatch(/career tools/i);
    expect(desc).toMatch(/fixed rules/i);
  });
  it('are repeated for link previews with the same words', () => {
    const title = html.match(/<title>([^<]*)<\/title>/)[1];
    expect(meta(/<meta property="og:title" content="([^"]*)"/)).toBe(title);
    expect(meta(/<meta name="twitter:title" content="([^"]*)"/)).toBe(title);
    expect(meta(/<meta property="og:description" content="([^"]*)"/)).toBe(meta(/<meta name="twitter:description" content="([^"]*)"/));
  });
});

describe('no claim the product cannot back', () => {
  it('in the head of index.html', () => { for (const re of FORBIDDEN) expect(head.match(re)?.[0] ?? null, String(re)).toBeNull(); });
  it('in the page text that is there before JavaScript runs', () => { for (const re of FORBIDDEN) expect(staticBody.match(re)?.[0] ?? null, String(re)).toBeNull(); });
  it('in llms.txt', () => { for (const re of FORBIDDEN) expect(llms.match(re)?.[0] ?? null, String(re)).toBeNull(); });
  it('says that credential checks are in development and employer matching is planned, not live', () => {
    expect(staticBody).toMatch(/in development/i);
    expect(staticBody).toMatch(/planned/i);
    expect(llms).toMatch(/in development/i);
    expect(llms).toMatch(/planned/i);
  });
});
