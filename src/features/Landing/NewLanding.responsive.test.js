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
