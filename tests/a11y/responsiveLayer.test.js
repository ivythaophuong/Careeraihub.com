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

describe('the two-column main + side grids collapse on a tablet and a phone', () => {
  // Found on the Dashboard at 390 px: its first row is `1.4fr 1fr`, which no rule collapsed, so the "This Week" card was pushed off the right edge
  // and the page scrolled sideways (576 px wide). Every proportional two-column grid the app uses for a main card plus a side card is listed here.
  const css = read('src/responsive.css');
  const narrow = (css.match(/@media \(max-width: 768px\)\s*\{([\s\S]*?)\n\}/) || [])[1] || '';
  it.each(['1.4fr 1fr', '1.5fr 1fr', '1fr 2fr'])('collapses %s to one column at 768 px and below', (cols) => {
    expect(narrow).toContain(`[style*="grid-template-columns: ${cols}"]`);
    expect(narrow).toMatch(/grid-template-columns: 1fr !important/);
  });
  it('the Dashboard still uses 1.4fr 1fr for its first row, so the rule above is the one that applies to it', () => {
    expect(read('src/features/Dashboard/Dashboard.jsx')).toMatch(/gridTemplateColumns: '1\.4fr 1fr'/);
  });
});

describe('a text box with padding stays inside its card on a phone', () => {
  // Found on Cover Letter, Job Search and JD Analyzer at 390 px: the boxes are `width: 100%` with padding and no box-sizing, so each was wider than its
  // card by its padding and border (right edge 401 or 397 px in a 390 px page) and the page scrolled sideways.
  const css = read('src/responsive.css');
  const narrow = (css.match(/@media \(max-width: 768px\)\s*\{([\s\S]*?)\n\}/) || [])[1] || '';
  it('inputs, selects and text areas use border-box at 768 px and below', () => {
    expect(narrow).toMatch(/input,\s*select,\s*textarea\s*\{[^}]*box-sizing:\s*border-box/);
  });
  it('the three screens still size their boxes with width 100 percent and no box-sizing of their own, so the rule above is what fixes them', () => {
    for (const f of ['CoverLetterGen/CoverLetterGen', 'JobSearch/JobSearch', 'JDAnalyzer/JDAnalyzer']) {
      const src = read(`src/features/${f}.jsx`);
      expect(src).toMatch(/width: ?["']100%["']/);
    }
  });
});

describe('a row of tabs wider than the screen shows that it scrolls and keeps the chosen tab in view', () => {
  // Found at 390 px: Resume Builder (Version History out of view, and its marker with it), Interview Coach (Live Session cut) and the Get Ready strip.
  it('the style sheet fades the edge of a row that has more to scroll to', () => {
    expect(read('src/responsive.css')).toMatch(/\.scroll-tabs\[data-more="true"\]\s*\{[^}]*mask-image:\s*linear-gradient/);
  });
  it.each([
    ['Resume Builder', 'src/features/ATSBuilder/ATSBuilder.jsx'],
    ['Interview Coach', 'src/features/InterviewCoach/InterviewCoach.jsx'],
    ['Get Ready strip', 'src/features/Landing/LandingPage.jsx'],
  ])('%s uses the shared hook, the scroll-tabs class and marks the chosen tab', (_n, file) => {
    const src = read(file);
    expect(src).toMatch(/useScrollTabs/);
    expect(src).toMatch(/className="scroll-tabs"/);
    expect(src).toMatch(/aria-current=\{[^}]*\? 'page' : undefined\}/);
  });
});

describe('keyboard focus stays visible', () => {
  it('has a global :focus-visible ring', () => {
    // !important matters: many inputs have an inline `outline: none` that would otherwise win (found in a real browser)
    expect(read('src/index.css')).toMatch(/:focus-visible\s*\{\s*outline:\s*2px solid #EC4899 !important/);
  });

  it('feature pages hide the mouse-focus outline but keep a ring for the keyboard', () => {
    const css = read('src/styles/featurePage.css');
    expect(css).toMatch(/\.fp-wrap input:focus\s*\{[^}]*outline:\s*none/);
    expect(css).toMatch(/\.fp-wrap input:focus-visible[\s\S]*outline:\s*2px solid #EC4899 !important/);
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
