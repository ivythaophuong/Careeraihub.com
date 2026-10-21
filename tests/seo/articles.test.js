// Guards the blog articles: structure, valid JSON-LD, working internal links, no unverified claims,
// and that every article is in the sitemap and in llms.txt.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ARTICLES } from '../../marketing/articles.mjs';
import { PAGES, SITE } from '../../marketing/pages.mjs';
import { renderArticle, renderBlogIndex, renderSitemap, articleUrl } from '../../marketing/render.mjs';

const ROOT = path.resolve(__dirname, '../..');
const pageSlugs = PAGES.map(p => p.slug);
const okLinks = new Set(['/', '/blog/', '/favicon.ico', '/favicon.svg', '/apple-touch-icon.png',
  ...pageSlugs.map(s => `/${s}/`), ...ARTICLES.map(a => `/blog/${a.slug}/`)]);

describe('blog articles', () => {
  it('has unique slugs, titles and descriptions', () => {
    expect(new Set(ARTICLES.map(a => a.slug)).size).toBe(ARTICLES.length);
    expect(new Set(ARTICLES.map(a => a.title)).size).toBe(ARTICLES.length);
    expect(new Set(ARTICLES.map(a => a.description)).size).toBe(ARTICLES.length);
  });

  describe.each(ARTICLES)('/blog/$slug/', (a) => {
    const html = renderArticle(a);

    it('has a sensible title and description length', () => {
      expect(a.title.length).toBeLessThanOrEqual(75);
      expect(a.description.length).toBeGreaterThanOrEqual(70);
      expect(a.description.length).toBeLessThanOrEqual(170);
    });

    it('has one H1, and matching canonical and og:url', () => {
      expect((html.match(/<h1[ >]/g) || []).length).toBe(1);
      expect(html).toContain(`<link rel="canonical" href="${articleUrl(a.slug)}"/>`);
      expect(html).toContain(`og:url" content="${articleUrl(a.slug)}"`);
    });

    it('has valid JSON-LD with the FAQ visible on the page', () => {
      const raw = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
      const graph = JSON.parse(raw)['@graph'];
      expect(graph.map(n => n['@type'])).toEqual(['Article', 'BreadcrumbList', 'FAQPage']);
      for (const f of a.faq) expect(html).toContain(`<h3>${f.q.replace(/’/g, '’')}</h3>`);
    });

    it('links only to pages that exist', () => {
      for (const h of [...html.matchAll(/href="(\/[^"]*)"/g)].map(m => m[1])) expect(okLinks.has(h), h).toBe(true);
    });
  });

  it('blog index lists every article and links only to existing pages', () => {
    const html = renderBlogIndex();
    for (const a of ARTICLES) expect(html).toContain(`href="/blog/${a.slug}/"`);
    for (const h of [...html.matchAll(/href="(\/[^"]*)"/g)].map(m => m[1])) expect(okLinks.has(h), h).toBe(true);
  });

  it('does not contain claims that are not verified', () => {
    const text = JSON.stringify(ARTICLES);
    for (const banned of ['Singpass', 'OpenCerts', 'blockchain', 'Top 10%', 'guarantee you', 'best ', '#1', '4.8', '500+', ' free ', 'Free ']) {
      expect(text.includes(banned), banned).toBe(false);
    }
  });

  it('puts the index and every article in the sitemap and in llms.txt', () => {
    const sm = renderSitemap();
    const llms = fs.readFileSync(path.join(ROOT, 'public/llms.txt'), 'utf8');
    expect(sm).toContain(`<loc>${SITE}/blog/</loc>`);
    expect(llms).toContain(`${SITE}/blog/`);
    for (const a of ARTICLES) {
      expect(sm).toContain(`<loc>${articleUrl(a.slug)}</loc>`);
      expect(llms).toContain(articleUrl(a.slug));
    }
  });
});
