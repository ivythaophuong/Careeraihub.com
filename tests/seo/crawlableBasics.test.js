// Guards the files crawlers and AI assistants read. If one goes missing, nginx used to answer with the SPA page
// (HTTP 200, text/html), so the loss was silent.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const pub = (f) => path.join(ROOT, 'public', f);
const read = (f) => fs.readFileSync(pub(f), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

describe('public crawl files', () => {
  it.each(['robots.txt', 'sitemap.xml', 'llms.txt', 'og-image.jpg', 'favicon.ico', 'favicon.svg', 'apple-touch-icon.png', '404.html'])(
    'ships %s', (f) => expect(fs.existsSync(pub(f))).toBe(true));

  it('robots.txt points to the sitemap and does not block the site', () => {
    const t = read('robots.txt');
    expect(t).toMatch(/^Sitemap: https:\/\/careeraihub\.com\/sitemap\.xml$/m);
    expect(t).not.toMatch(/^Disallow: \/\s*$/m);
  });

  it('sitemap.xml lists only absolute careeraihub.com URLs', () => {
    const locs = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    expect(locs.length).toBeGreaterThan(0);
    for (const l of locs) expect(l).toMatch(/^https:\/\/careeraihub\.com\//);
  });

  it('og-image.jpg is a JPEG', () => {
    const b = fs.readFileSync(pub('og-image.jpg'));
    expect([b[0], b[1], b[2]]).toEqual([0xff, 0xd8, 0xff]);
  });
});

describe('index.html', () => {
  it('has title, description, canonical and share image', () => {
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).toMatch(/<meta name="description" content="[^"]{50,}"/);
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/careeraihub\.com\/"/);
    expect(html).toMatch(/og:image" content="https:\/\/careeraihub\.com\/og-image\.jpg"/);
    expect(html).toMatch(/twitter:image" content="https:\/\/careeraihub\.com\/og-image\.jpg"/);
  });

  it('has an H1 and text inside #root for crawlers that do not run JavaScript', () => {
    const root = html.match(/<div id="root">([\s\S]*?)<\/div>\s*<script/)[1];
    expect(root).toMatch(/<h1[^>]*>[^<]+<\/h1>/);
  });

  it('has valid JSON-LD with Organization, WebSite and FAQPage', () => {
    const raw = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
    const types = JSON.parse(raw)['@graph'].map(n => n['@type']);
    expect(types).toEqual(expect.arrayContaining(['Organization', 'WebSite', 'SoftwareApplication', 'FAQPage']));
  });

  it('keeps the Search Console verification tag', () => {
    expect(html).toMatch(/name="google-site-verification"/);
  });
});
