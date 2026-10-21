// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// jsdom does not lay anything out, so a lost responsive rule is invisible to the other tests. A broken line once left the hero and every two-column section in two columns on phones.
const css = fs.readFileSync(new URL('./NewLanding.css', import.meta.url), 'utf8');
const block = (query) => { const i = css.indexOf(`@media (${query})`); const j = css.indexOf('\n}\n', i); return css.slice(i, j); };

describe('the responsive rules of the landing page', () => {
  it('put the hero, the two-column sections and the situation panel in one column on a narrow screen', () => {
    expect(block('max-width: 860px')).toMatch(/\.nl-hero-grid, \.nl-split, \.nl-panel \{ grid-template-columns: 1fr;/);
  });
  it('stop the hero example from reaching past the window edge on a narrow screen', () => {
    expect(block('max-width: 860px')).toMatch(/\.nl-hero-shot \{ margin-right: 0; \}/);
  });
  it('put the coach, the three steps and the tool cards in one column on a narrow screen', () => {
    expect(css).toMatch(/@media \(max-width: 860px\) \{ \.nl-coach \{ grid-template-columns: 1fr;/);
    expect(css).toMatch(/\.nl-flow \{ grid-template-columns: 1fr;/);
    expect(block('max-width: 560px')).toMatch(/\.nl-cards, \.nl-moment-grid \{ grid-template-columns: 1fr;/);
  });
});

// Text on a filled button must reach 4.5:1 (WCAG AA for normal text). The page text colour is #F5F7FF, the button's own is #fff: both are checked.
const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const h = hex.replace('#', ''); const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const bgOf = (selector) => { const re = new RegExp(`(?:^|\\n)${selector.replace(/[.:]/g, '\\$&')}[^{]*\\{[^}]*?background: (#[0-9A-Fa-f]{6})`); return css.match(re)?.[1]; };

describe('the colours of the demo buttons', () => {
  it('keep white text readable at rest and on hover', () => {
    const rest = css.match(/\.nl-demo-next, \.nl-demo-signup \{[^}]*background: (#[0-9A-Fa-f]{6})/)?.[1];
    const hover = css.match(/\.nl-demo-next:hover, \.nl-demo-signup:hover \{ background: (#[0-9A-Fa-f]{6})/)?.[1];
    expect(rest).toBeTruthy(); expect(hover).toBeTruthy();
    for (const bg of [rest, hover]) for (const fg of ['#FFFFFF', '#F5F7FF']) expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('the motion rules', () => {
  it('stop every CSS animation on the page while motion is paused', () => {
    expect(css).toMatch(/\.nl\[data-motion="paused"\] \*[^{]*\{[^}]*animation-play-state: paused !important/);
  });
  it('do not let the nudge on the Next button repeat for ever', () => {
    expect(css).toMatch(/\.nl-demo-next\.is-ready \{ animation: nl-nudge 1\.8s ease-in-out 3;/);
  });
});

describe('the hero example on a phone', () => {
  const phone = () => block('max-width: 640px');
  it('shows the score first: the profile column and the steps that are not current are left out', () => {
    expect(css).toMatch(/@media \(max-width: 640px\)/);
    expect(phone()).toMatch(/\.nl-demo-col:first-child \{ display: none; \}/);
    expect(phone()).toMatch(/\.nl-demo-steps li:not\(\.is-on\) \{ display: none; \}/);
  });
  it('does not repeat the long subtitle', () => {
    expect(phone()).toMatch(/\.nl-demo-sub \{ display: none; \}/);
  });
});
