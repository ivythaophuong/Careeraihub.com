import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const css = fs.readFileSync('src/styles/appTheme.css', 'utf8');
const rule = (selector) => { const i = css.indexOf(selector + ' {'); return i < 0 ? '' : css.slice(i, css.indexOf('}', i)); };

describe('the app shell keeps its footer at the bottom and hides the desktop bar on phones', () => {
  it('the layout is a column at least one screen tall and the footer takes the spare space above it', () => {
    const layout = rule('.app-sidebar-layout');
    expect(layout).toMatch(/display:\s*flex/);
    expect(layout).toMatch(/flex-direction:\s*column/);
    expect(layout).toMatch(/min-height:\s*100vh/);
    expect(rule('.app-sidebar-layout > footer')).toMatch(/margin-top:\s*auto/);
  });

  it('the desktop top bar is hidden with !important, because the element sets display inline', () => {
    expect(css).toMatch(/\.desktop-topbar\s*\{\s*display:\s*none\s*!important/);
  });
});
