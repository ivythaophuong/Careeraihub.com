// Runs after `vite build`: writes one static HTML file per marketing page into dist/<slug>/index.html
// and replaces dist/sitemap.xml with one that lists every page. The app itself (dist/index.html) is untouched.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES } from './pages.mjs';
import { renderPage, renderSitemap } from './render.mjs';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('build-pages: dist/index.html not found. Run `vite build` first.');
  process.exit(1);
}

for (const page of PAGES) {
  const dir = path.join(dist, page.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), renderPage(page));
}
fs.writeFileSync(path.join(dist, 'sitemap.xml'), renderSitemap());
console.log(`build-pages: wrote ${PAGES.length} pages and sitemap.xml`);
