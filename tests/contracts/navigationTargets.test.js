// @vitest-environment node
// Cross-feature wiring: every place that sends the person to another feature names a feature the app can really open.
// It reads the source (no browser): the screens App.jsx can render, and every id the sidebar, the command palette, the mobile menus, the roadmap and the
// "go to" buttons use. A renamed or removed feature that something still points at fails here instead of opening the wrong page.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const src = walk('src').filter((f) => /\.(jsx?|mjs)$/.test(f) && !/\.test\./.test(f));

const app = read('src/App.jsx');
const SCREENS = new Set([...app.matchAll(/case\s+"([a-z]+)"\s*:/g)].map((m) => m[1]));
// screens App.jsx can open that are not "features" (reached from a footer link)
const idsIn = (text, re, g = 1) => [...text.matchAll(re)].map((m) => m[g]);

describe('the screens the app can open', () => {
  it('are the ones this test thinks they are (a guard against the regex going blind)', () => {
    expect(SCREENS.size).toBeGreaterThanOrEqual(18);
    for (const id of ['dashboard', 'scan', 'simulate', 'star', 'radar', 'score', 'memory', 'ats', 'roadmap']) expect(SCREENS.has(id), id).toBe(true);
  });
});

describe('every navigation target opens a screen that exists', () => {
  it('the module list (command palette, internal links) only names real screens', () => {
    const ids = idsIn(read('src/styles/theme.js'), /\{\s*id:\s*"([a-z]+)",\s*icon:/g);
    expect(ids.length).toBeGreaterThan(10);
    for (const id of ids) expect(SCREENS.has(id), `theme MODULES id "${id}" has no screen in App.jsx`).toBe(true);
  });
  it('the sidebar items and the mobile menus only name real screens', () => {
    const side = read('src/components/AppSidebar.jsx');
    const ids = [...idsIn(side, /\{\s*id:\s*'([a-z]+)',\s*label:/g)];
    expect(ids.length).toBeGreaterThan(10);
    for (const id of ids) expect(SCREENS.has(id), `AppSidebar id "${id}" has no screen`).toBe(true);
  });
  it('the roadmap and dashboard next-step lists only name real screens', () => {
    for (const f of ['src/features/CareerRoadmap/roadmapNext.js']) {
      for (const id of idsIn(read(f), /module:\s*'([a-z]+)'/g)) expect(SCREENS.has(id), `${f} sends to "${id}", which has no screen`).toBe(true);
    }
  });
  it('every setActiveModule("x") call in a feature names a real screen', () => {
    const bad = [];
    for (const f of src) {
      const t = fs.readFileSync(path.join(root, f), 'utf8');
      for (const id of idsIn(t, /setActiveModule\(\s*['"]([a-z]+)['"]/g)) if (!SCREENS.has(id)) bad.push(`${f}: "${id}"`);
    }
    expect(bad).toEqual([]);
  });
  it('every onNavigate / goTo / navigate("x") of the app shell names a real screen', () => {
    const bad = [];
    for (const f of ['src/App.jsx', 'src/components/AppSidebar.jsx', 'src/features/Landing/LandingPage.jsx', 'src/features/Dashboard/Dashboard.jsx']) {
      if (!fs.existsSync(path.join(root, f))) continue;
      const t = read(f);
      for (const id of idsIn(t, /(?:onNavigate|navigate|goToModule)\(\s*['"]([a-z]+)['"]/g)) if (!SCREENS.has(id)) bad.push(`${f}: "${id}"`);
    }
    expect(bad).toEqual([]);
  });
});

describe('the parts of a feature that has parts', () => {
  it('each part of the Interview Coach is something the Interview Coach can show', () => {
    const subs = idsIn(read('src/lib/subNav.js'), /\{\s*id:\s*'([a-z]+)',\s*label:/g);
    expect(subs).toEqual(['dashboard', 'study', 'session', 'weakness', 'starbank', 'aimemory']);
    const coach = read('src/features/InterviewCoach/InterviewCoach.jsx');
    for (const id of subs) expect(new RegExp(`activeTab === '${id}'`).test(coach), `InterviewCoach does not render the part "${id}"`).toBe(true);
  });
  it('the parts named in the sidebar and the tab strip are the same list', () => {
    const coach = read('src/features/InterviewCoach/InterviewCoach.jsx');
    const tabs = idsIn(coach.slice(coach.indexOf('const TABS'), coach.indexOf('];', coach.indexOf('const TABS'))), /id:\s*'([a-z]+)'/g);
    const subs = idsIn(read('src/lib/subNav.js'), /\{\s*id:\s*'([a-z]+)',\s*label:/g);
    expect(tabs).toEqual(subs);
  });
});
