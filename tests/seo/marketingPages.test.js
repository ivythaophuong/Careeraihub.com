// Guards the static marketing pages: structure, uniqueness, valid JSON-LD, working internal links, and that
// no unverified claim slips in (docs/OPEN_POINTS.md OP-6).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PAGES, SITE } from '../../marketing/pages.mjs';
import { renderPage, renderSitemap, pageUrl } from '../../marketing/render.mjs';

const ROOT = path.resolve(__dirname, '../..');
const slugs = PAGES.map(p => p.slug);

describe('marketing pages', () => {
  it('has unique slugs, titles and descriptions', () => {
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(PAGES.map(p => p.title)).size).toBe(PAGES.length);
    expect(new Set(PAGES.map(p => p.description)).size).toBe(PAGES.length);
  });

  describe.each(PAGES)('/$slug/', (page) => {
    const html = renderPage(page);

    it('has a sensible title and description length', () => {
      expect(page.title.length).toBeLessThanOrEqual(75);
      expect(page.description.length).toBeGreaterThanOrEqual(70);
      expect(page.description.length).toBeLessThanOrEqual(170);
    });

    it('has one H1, a canonical URL and an og:url that match', () => {
      expect((html.match(/<h1[ >]/g) || []).length).toBe(1);
      expect(html).toContain(`<link rel="canonical" href="${pageUrl(page.slug)}"/>`);
      expect(html).toContain(`og:url" content="${pageUrl(page.slug)}"`);
    });

    it('has valid JSON-LD with a FAQ that is also visible on the page', () => {
      const raw = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
      const graph = JSON.parse(raw)['@graph'];
      expect(graph.map(n => n['@type'])).toEqual(['WebPage', 'BreadcrumbList', 'FAQPage']);
      for (const f of page.faq) expect(html).toContain(`<h3>${f.q.replace(/’/g, '’')}</h3>`);
    });

    it('links only to pages that exist', () => {
      const hrefs = [...html.matchAll(/href="(\/[^"]*)"/g)].map(m => m[1]);
      const ok = new Set(['/', '/favicon.ico', '/favicon.svg', '/apple-touch-icon.png', ...slugs.map(s => `/${s}/`)]);
      for (const h of hrefs) expect(ok.has(h), h).toBe(true);
    });
  });

  it('does not contain claims that are not verified', () => {
    const text = JSON.stringify(PAGES);
    for (const banned of ['Singpass', 'OpenCerts', 'blockchain', 'Top 10%', 'guarantee you', 'best ', '#1', '4.8', '500+', ' free ', 'Free ']) {
      expect(text.includes(banned), banned).toBe(false);
    }
  });

  it('puts every page in the sitemap and in llms.txt', () => {
    const sm = renderSitemap();
    const llms = fs.readFileSync(path.join(ROOT, 'public/llms.txt'), 'utf8');
    for (const p of PAGES) {
      expect(sm).toContain(`<loc>${pageUrl(p.slug)}</loc>`);
      expect(llms).toContain(pageUrl(p.slug));
    }
    expect(sm).toContain(`<loc>${SITE}/</loc>`);
  });
});
