// Pure rendering of the marketing pages: no file access, so tests can call it directly.
import { SITE, PAGES } from './pages.mjs';

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const NAV_LABELS = {
  'ats-resume-checker': 'ATS Resume Checker',
  'mock-interview-ai': 'Mock Interview',
  'salary-negotiation': 'Salary Prep',
  singapore: 'Singapore',
  malaysia: 'Malaysia',
};

export const pageUrl = (slug) => `${SITE}/${slug}/`;

function jsonLd(page) {
  const url = pageUrl(page.slug);
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': `${url}#page`, url, name: page.title, description: page.description, inLanguage: 'en', isPartOf: { '@id': `${SITE}/#website` }, dateModified: page.updated },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'CareerAiHub', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: NAV_LABELS[page.slug] || page.h1, item: url },
      ] },
      { '@type': 'FAQPage', mainEntity: page.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ],
  }).replace(/</g, '\\u003c');
}

const CSS = `*{box-sizing:border-box;margin:0}body{background:#090C12;color:#E8F0FE;font-family:Inter,-apple-system,"Helvetica Neue",Arial,sans-serif;line-height:1.65}
a{color:#00D4FF}header,main,footer{max-width:780px;margin:0 auto;padding:0 24px}
header{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;justify-content:space-between;padding-top:24px;padding-bottom:24px}
.brand{font-weight:700;font-size:20px;color:#E8F0FE;text-decoration:none}nav{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:14px}
h1{font-size:clamp(28px,5vw,40px);line-height:1.15;margin:16px 0}h2{font-size:22px;margin:32px 0 10px}
p{margin:0 0 14px;color:#C5D2E8}.lead{font-size:18px}ul{padding-left:22px;margin:0 0 14px;color:#C5D2E8}li{margin-bottom:6px}
.cta{display:inline-block;margin:12px 0 8px;padding:12px 22px;border-radius:10px;background:#00D4FF;color:#04202a;font-weight:700;text-decoration:none}
.faq p{margin-bottom:6px}.faq h3{font-size:17px;margin:18px 0 4px}footer{padding-top:32px;padding-bottom:48px;font-size:14px;color:#6B7E9F}`;

export function renderPage(page) {
  const url = pageUrl(page.slug);
  const nav = PAGES.map(p => `<a href="/${p.slug}/">${esc(NAV_LABELS[p.slug] || p.slug)}</a>`).join('');
  const body = page.sections.map(s => {
    const paras = (s.paras || []).map(t => `<p>${esc(t)}</p>`).join('');
    const list = s.list ? `<ul>${s.list.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '';
    return `<section><h2>${esc(s.h2)}</h2>${paras}${list}</section>`;
  }).join('\n');
  const faq = page.faq.map(f => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('');
  const related = page.related.map(slug => {
    const p = PAGES.find(x => x.slug === slug);
    return `<li><a href="/${slug}/">${esc(NAV_LABELS[slug])}</a></li>`;
  }).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}"/>
<meta name="robots" content="index, follow"/>
<link rel="canonical" href="${url}"/>
<meta property="og:title" content="${esc(page.title)}"/>
<meta property="og:description" content="${esc(page.description)}"/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${url}"/>
<meta property="og:site_name" content="CareerAiHub"/>
<meta property="og:locale" content="${page.locale}"/>
<meta property="og:image" content="${SITE}/og-image.jpg"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(page.title)}"/>
<meta name="twitter:description" content="${esc(page.description)}"/>
<meta name="twitter:image" content="${SITE}/og-image.jpg"/>
<meta name="theme-color" content="#090C12"/>
<link rel="icon" href="/favicon.ico" sizes="48x48"/>
<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
<script type="application/ld+json">${jsonLd(page)}</script>
<style>${CSS}</style>
</head>
<body>
<header><a class="brand" href="/">CareerAiHub</a><nav>${nav}</nav></header>
<main>
<h1>${esc(page.h1)}</h1>
<p class="lead">${esc(page.lead)}</p>
<a class="cta" href="/">Open CareerAiHub</a>
${body}
<section class="faq"><h2>Questions</h2>${faq}</section>
<section><h2>More</h2><ul>${related}</ul></section>
</main>
<footer>CareerAiHub · <a href="/">careeraihub.com</a></footer>
</body>
</html>
`;
}

export function renderSitemap() {
  const entries = [
    { loc: `${SITE}/`, lastmod: '2026-10-18', priority: '1.0' },
    ...PAGES.map(p => ({ loc: pageUrl(p.slug), lastmod: p.updated, priority: '0.8' })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(e => `  <url>
    <loc>${e.loc}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <priority>${e.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
}
