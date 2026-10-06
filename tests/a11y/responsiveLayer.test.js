// @vitest-environment node
// Static guards for the responsive / accessibility layer. They read the source files, so they prove
// the rules are present and wired, not how a browser renders them (that needs a viewport check).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const walk = (d, out = []) => { for (const e of fs.readdirSync(path.join(root, d), { withFileTypes: true })) { const p = `${d}/${e.name}`; e.isDirectory() ? walk(p, out) : out.push(p); } return out; };

describe('responsive layer is wired', () => {
  it('main.jsx loads responsive.css after index.css and mounts the device probe', () => {
    const m = read('src/main.jsx');
    expect(m.indexOf("import './index.css'")).toBeGreaterThan(-1);
    expect(m.indexOf("import './responsive.css'")).toBeGreaterThan(m.indexOf("import './index.css'"));
    expect(m).toMatch(/<DeviceProbe \/>/);
  });

  it('index.html allows content to extend under the notch (needed for the safe-area rules)', () => {
    expect(read('index.html')).toMatch(/viewport-fit=cover/);
  });

  it('defines .grid-2 (used by STAR Builder) and collapses it on phones', () => {
    const css = read('src/index.css');
    expect(css).toMatch(/\.grid-2\s*\{\s*grid-template-columns:\s*1fr 1fr/);
    expect(css).toMatch(/@media\(max-width:600px\)\{\.grid-2\{grid-template-columns:1fr\}\}/);
  });

  it('collapses inline grids on small screens', () => {
    const css = read('src/responsive.css');
    expect(css).toMatch(/@media \(max-width: 768px\)[\s\S]*repeat\(4,[\s\S]*grid-template-columns: repeat\(2, 1fr\) !important/);
    expect(css).toMatch(/@media \(max-width: 768px\)[\s\S]*grid-template-columns: 1fr 1fr;"\][\s\S]*grid-template-columns: 1fr !important/);
  });
});

describe('keyboard focus stays visible', () => {
  it('has a global :focus-visible ring', () => {
    expect(read('src/index.css')).toMatch(/:focus-visible\s*\{\s*outline:\s*2px solid/);
  });

  it('feature pages hide the mouse-focus outline but keep a ring for the keyboard', () => {
    const css = read('src/styles/featurePage.css');
    expect(css).toMatch(/\.fp-wrap input:focus\s*\{[^}]*outline:\s*none/);
    expect(css).toMatch(/\.fp-wrap input:focus-visible[\s\S]*outline:\s*2px solid/);
  });

  it('Card no longer removes outlines', () => {
    expect(read('src/components/CommonUI.jsx')).not.toMatch(/outline:\s*"none"/);
  });
});

describe('the phone navigation respects the safe areas', () => {
  const css = read('src/styles/appTheme.css');
  it('bottom nav, drawer, top bar and content clear the home indicator / notch', () => {
    expect(css).toMatch(/\.mob-bottom-nav\s*\{[^}]*calc\(60px \+ env\(safe-area-inset-bottom/);
    expect(css).toMatch(/\.mob-drawer\s*\{[^}]*env\(safe-area-inset-bottom/);
    expect(css).toMatch(/\.mob-glass-bar\s*\{[^}]*env\(safe-area-inset-top/);
    expect(css).toMatch(/\.app-sidebar-layout\s*\{[^}]*padding-bottom:\s*calc\(60px \+ env\(safe-area-inset-bottom/);
  });
});

describe('there is a single mobile navigation', () => {
  it('nothing imports main\'s BottomNav', () => {
    const offenders = walk('src').filter(f => /\.(jsx?|js)$/.test(f) && /BottomNav/.test(read(f)) && !f.endsWith('.test.jsx'));
    expect(offenders).toEqual([]);
    expect(fs.existsSync(path.join(root, 'src/components/BottomNav.jsx'))).toBe(false);
  });
});

describe('TemplateSelector does not force a fixed width on phones', () => {
  it('uses a fluid preview width', () => {
    const t = read('src/features/ATSBuilder/components/TemplateSelector.jsx');
    expect(t).toMatch(/min\(450px, 100%\)/);
    expect(t).toMatch(/clamp\(8px, 3vw, 40px\)/);
  });
});
