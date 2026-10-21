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


describe('the hero example on a phone', () => {
  const phone = () => block('max-width: 640px');
  it('shows the score first: the profile column is left out', () => {
    expect(css).toMatch(/@media \(max-width: 640px\)/);
    expect(phone()).toMatch(/\.nl-demo-col:first-child \{ display: none; \}/);
  });
  it('does not repeat the long subtitle', () => {
    expect(phone()).toMatch(/\.nl-demo-sub \{ display: none; \}/);
  });
});

describe('the white sections: the approach and the footer', () => {
  const PAIRS = [
    ['ink on white', '#141B32', '#FFFFFF'], ['muted text on white', '#46506B', '#FFFFFF'], ['eyebrow on white', '#B0276F', '#FFFFFF'], ['link on white', '#A61F6C', '#FFFFFF'],
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


describe('one colour for the text', () => {
  it('does not colour the bold words in the lines under the titles, and has no gradient on any title but the main one', () => {
    expect(css).not.toMatch(/\.nl-h2 \.nl-grad-text/);
    expect(css).not.toMatch(/\.nl-(light|paper) \.nl-grad-text/);
    expect(css).not.toMatch(/\.nl-approach-intro > p strong[^{]*\{[^}]*color: #A61F6C/);
  });
});

describe('the recording illustration looks like a recording, not a poster', () => {
  const rec = css.slice(css.indexOf('/* Recording, calm:')) ;
  it('uses quiet blue-grey bars and one muted amber for pauses, with no pink or bright purple', () => {
    expect(css).toContain('/* Recording, calm:');
    for (const c of ['#5C7694', '#8CA2BD', '#C3D0E2', '#A98B4E']) expect(rec.toUpperCase(), c).toContain(c);
    for (const bright of ['#F472B6', '#A78BFA', '#7DD3FC', '#FBBF24', '#F87171']) expect(rec.toUpperCase(), bright).not.toContain(bright);
  });
});

describe('one size and one colour for the lines under the titles', () => {
  it('sets one size for them, and the same muted colour', () => {
    expect(css).toMatch(/--nl-lead-size: clamp\(16px, 0\.35vw \+ 12px, 17px\)/);
    expect(css).toMatch(/\.nl-lead, \.nl-copy > p, \.nl-point, \.nl-coach-copy > p, \.nl-approach-intro > p[^{]*\{ font-size: var\(--nl-lead-size\); line-height: 1\.6; color: var\(--nl-muted\); \}/);
  });
  it('gives every dark section the same padding', () => {
    expect(css).toMatch(/\.nl-section \{[^}]*padding: 96px 0/);
  });
});

describe('the hero example, two columns with smaller text', () => {
  it('has the two columns back on a wide screen and a smaller text size inside the example', () => {
    expect(css).toMatch(/\.nl-demo-body \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1\.1fr\);/);
    expect(css).toMatch(/\.nl-demo \{ font-size: 12\.5px;/);
  });
});

describe('the hero example on a phone, after the two columns came back', () => {
  it('is one column again, set after the two-column rule so it wins', () => {
    const i = css.lastIndexOf('.nl-demo-body { grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);');
    const j = css.lastIndexOf('@media (max-width: 640px) { .nl-demo-body { grid-template-columns: 1fr; }');
    expect(i).toBeGreaterThan(-1); expect(j).toBeGreaterThan(i);
  });
});


describe('narrow screens are decided last', () => {
  const last = css.lastIndexOf('/* Narrow screens, last of all');
  it('the narrow-screen block is the last thing in the stylesheet, so no later rule can undo it', () => {
    expect(last).toBeGreaterThan(-1);
    expect(css.slice(last)).toMatch(/\.nl-hero-grid, \.nl-split, \.nl-panel, \.nl-coach \{ grid-template-columns: 1fr;/);
    expect(css.slice(last + 20)).not.toMatch(/\n\.nl-[a-z-]+ \{[^}]*grid-template-columns/); // no plain rule after it sets columns
  });
  it('every plain rule that sets the columns of the hero or of a two-column section comes before it', () => {
    for (const sel of ['.nl-hero-grid', '.nl-coach', '.nl-flow', '.nl-demo-body']) {
      const re = new RegExp(`(^|\\n)${sel.replace('.', '\\.')} \\{[^}]*grid-template-columns`, 'g');
      let m; while ((m = re.exec(css))) expect(m.index, sel).toBeLessThan(last);
    }
  });
});

describe('the example between a tablet and a laptop', () => {
  it('shows the score only, in one column, while the example is narrower than about 450 px', () => {
    expect(css.slice(css.lastIndexOf('/* Narrow screens, last of all'))).toMatch(/@media \(min-width: 861px\) and \(max-width: 1100px\) \{ \.nl-demo-body \{ grid-template-columns: 1fr; \} \.nl-demo-col:first-child \{ display: none; \} \}/);
  });
});


describe('motion is slow and happens once', () => {
  const m = css.slice(css.indexOf('/* ===== Motion:'));
  it('has a motion section, with no switch, no pause rule and no forced copy', () => {
    expect(css).toContain('/* ===== Motion:');
    expect(css).not.toMatch(/data-motion/);
    expect(css).not.toMatch(/nl-motion-/);
  });
  it('no animation repeats for ever except the recording illustration while it "records" and the logo, which is turned by the brand mark itself', () => {
    const inf = [...m.matchAll(/([^{}]+)\{[^}]*animation:[^;}]*infinite/g)].map(x => x[1].trim());
    expect(inf.every(sel => /\.nl-rec/.test(sel)), inf.join(' | ')).toBe(true);
  });
  it('every movement that plays once is slow: no animation is shorter than 1.8 seconds', () => {
    for (const x of m.matchAll(/animation: [a-z-]+ ([0-9.]+)(m?s)/g)) { const sec = x[2] === 'ms' ? Number(x[1]) / 1000 : Number(x[1]); expect(sec, x[0]).toBeGreaterThanOrEqual(0.5); }
    for (const x of m.matchAll(/animation: nl-(flow|ring|ring-spin|dot|arrow|nudge|rec-reveal) ([0-9.]+)s/g)) expect(Number(x[2]), x[0]).toBeGreaterThanOrEqual(1.8);
  });
  it('the light on the lines, the rings and the light round the score each run once', () => {
    expect(m).toMatch(/path\.nl-flow-line \{ animation: nl-flow 10s linear 1 both; \}/);
    expect(m).toMatch(/\.nl-orb-ring \{ animation: nl-ring 9s ease-out 1 both; \}/);
    expect(m).toMatch(/nl-demo-ring-spin \{ animation: nl-ring-spin 7s linear 1 both;/);
  });
  it('the bars and the ring of the examples fill slowly', () => {
    expect(m).toMatch(/\.nl-demo-ring-fill \{ transition: stroke-dashoffset 2\.4s/);
    expect(m).toMatch(/\.nl-demo-track span, \.nl-scan-track span \{ transition: width 2s/);
  });
});

describe('the head of the example', () => {
  it('keeps a gap between its subtitle and the cards below', () => { expect(css).toMatch(/\.nl-demo-head \{ margin-bottom: 12px; \}/); });
});

describe('fluid sizes and smooth scrolling', () => {
  it('the size of the lines under the titles grows with the window between 16 and 17 px', () => {
    expect(css).toMatch(/--nl-lead-size: clamp\(16px, 0\.35vw \+ 12px, 17px\)/);
  });
  it('titles use clamp, so they grow with the window too', () => {
    expect(css).toMatch(/\.nl-h1 \{ font-size: clamp\(/); expect(css).toMatch(/\.nl-h2 \{ font-size: clamp\(/); expect(css).toMatch(/\.nl-h3 \{ font-size: clamp\(/);
  });
  it('sections leave room for the sticky header when a link scrolls to them', () => {
    expect(css).toMatch(/\.nl section\[id\] \{ scroll-margin-top: 88px; \}/);
  });
});
