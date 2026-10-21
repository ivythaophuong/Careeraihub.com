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

describe('the white sections: the approach and the footer', () => {
  const PAIRS = [
    ['ink on white', '#141B32', '#FFFFFF'], ['muted text on white', '#46506B', '#FFFFFF'], ['eyebrow on white', '#B0276F', '#FFFFFF'], ['bold key words on white', '#A61F6C', '#FFFFFF'],
    ['ink on a card', '#141B32', '#F7F8FD'], ['muted text on a card', '#46506B', '#F7F8FD'], ['tag on its fill', '#3B2A8F', '#EDE9FB'],
    ['footer small print on white', '#5B6482', '#FFFFFF'], ['gradient start on white', '#C0307F', '#FFFFFF'], ['gradient end on white', '#6D4FD6', '#FFFFFF'],
  ];
  it('use colours that are in the stylesheet and read at 4.5:1 or better', () => {
    for (const [name, fg, bg] of PAIRS) {
      expect(css.toUpperCase(), name).toContain(fg.toUpperCase());
      expect(ratio(fg, bg), name).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('make the approach section and the footer white', () => {
    expect(css).toMatch(/\.nl-paper \{ background: #FFFFFF;/);
    expect(css).toMatch(/\.nl-footer\.nl-paper-foot \{ background: #FFFFFF;/);
  });
});

describe('the motion that was asked for', () => {
  it('turns a light round the score ring', () => { expect(css).toMatch(/\.nl-demo-ring-spin \{[^}]*stroke-dasharray/); expect(css).toMatch(/@keyframes nl-ring-spin/); });
  it('carries two lights along every line of the tool diagram, slowly', () => { expect(css).toMatch(/path\.nl-flow-line \{[^}]*stroke-dasharray: 14 36;/); });
  it('bounces the typing dots so they can be seen', () => { expect(css).toMatch(/translateY\(-6px\)/); });
});
