import fs from 'node:fs';
import path from 'node:path';
const OUT = process.env.E2E_OUT || path.join(process.cwd(), 'e2e-out');
import AxeBuilder from '@axe-core/playwright';
import { startDev, launch, newApp, BASE } from './harness.mjs';

const PROFILE = [{ id: '1', role: 'Product Manager', industry: 'Technology', level: 'Mid', market: 'Singapore', urgency: '7 days' }];
const RESUME = 'Product manager at Acme Corp, 2021 to 2025. Led a checkout migration across three teams. Reduced support tickets by 30 percent. Skills: roadmapping, SQL, stakeholder management, A/B testing. '.repeat(4);
const now = Date.now();
const day = (n) => new Date(now - n * 86400000).toISOString();
const SEEDS = {
  empty: { profiles: PROFILE },
  rich: {
    profiles: PROFILE,
    user_memory: [{ data: { resumeText: RESUME, scanResult: { credibilityScore: 62 } } }],
    resume_scans: [{ id: 's1', created_at: day(3), credibility_score: 62, file_name: 'cv.pdf', metrics_found: 5, summary: 'A solid CV with some numbers.', issues: [], questions: [] }],
    star_stories: [1, 2, 3].map(n => ({ id: 'st' + n, created_at: day(n), title: `Story ${n}`, situation: 'We had a failing checkout.', task: 'Fix it.', action: 'I led the migration.', result: 'Errors fell 80 percent.', one_liner: 'Led a migration', score: 70 })),
    mock_sessions: [{ id: 'm1', created_at: day(2), mode: 'seriesb', questions_count: 5, avg_score: 64 }, { id: 'm2', created_at: day(5), mode: 'startup', questions_count: 4, avg_score: 58 }],
    jd_analyses: [{ id: 'j1', created_at: day(4), role_title: 'Senior PM', match_score: 71 }],
    applications: [{ id: 'a1', created_at: day(1), company: 'Acme', role: 'PM', status: 'applied' }],
  },
};
const SIDEBAR = [['Dashboard', 'dashboard'], ['Resume Builder', 'ats'], ['ATS Scanner', 'scan'], ['Cover Letter AI', 'cover'], ['Interview Coach', 'simulate'], ['Salary Prep', 'salary'], ['Skills Gap', 'skillsgap'], ['Career Roadmap', 'roadmap'], ['Verify Creds', 'verify'], ['TrustMatch', 'trustmatch'], ['AI Career Coach', 'aichat']];
const PALETTE = [['Job Search', 'jobs'], ['JD Analyzer', 'jd'], ['STAR Builder', 'star'], ['Weakness Radar', 'radar'], ['Readiness Score', 'score'], ['Regional Guide', 'market'], ['AI Memory', 'memory']];
const SUBS = ['Overview', 'Study Modules', 'Live Session', 'Weakness Radar', 'STAR Bank', 'AI Memory'];

async function open(page, label, viaPalette) {
  if (!viaPalette) {
    const btn = page.locator('.app-sidebar-item', { hasText: new RegExp('^\\s*' + label, 'i') }).first();
    if (await btn.count() && await btn.isVisible()) { await btn.click(); return true; }
  }
  await page.keyboard.press('Meta+k');
  await page.getByPlaceholder('Search modules, actions...').fill(label);
  const hit = page.getByText('Open ' + label, { exact: true });
  if (!(await hit.count())) { await page.keyboard.press('Escape'); return false; }
  await hit.first().click();
  return true;
}
async function measure(page, log, id, mark) {
  await page.waitForTimeout(900);
  const m = await page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    h1: document.querySelectorAll('h1').length, h2: document.querySelectorAll('h2').length,
    firstHeading: (document.querySelector('h1,h2,h3')?.textContent || '').trim().slice(0, 50),
    textLen: (document.querySelector('main, #root')?.innerText || '').length,
    pageHeight: document.documentElement.scrollHeight,
    smallTargets: [...document.querySelectorAll('button, a, [role=button]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 24 || r.width < 24); }).length,
  }));
  let axe = { critical: 0, serious: 0, rules: [] };
  try {
    const r = await new AxeBuilder({ page }).analyze();
    for (const v of r.violations) { if (v.impact === 'critical') axe.critical++; if (v.impact === 'serious') axe.serious++; if (v.impact === 'critical' || v.impact === 'serious') axe.rules.push(`${v.id}(${v.nodes.length})`); }
  } catch (e) { axe.error = e.message.slice(0, 80); }
  return { id, ...m, axe, consoleErrors: log.console.length - mark.c, pageErrors: log.pageErrors.length - mark.p, unmocked: log.unmocked.length - mark.u };
}

fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
const dev = await startDev();
const browser = await launch();
const out = [];
for (const [scenario, vp] of [['empty', 'desktop'], ['rich', 'desktop'], ['empty', 'mobile']]) {
  const viewport = vp === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 };
  const { page, log } = await newApp(browser, { seed: SEEDS[scenario], viewport });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const run = async (id, label, viaPalette, extra) => {
    const mark = { c: log.console.length, p: log.pageErrors.length, u: log.unmocked.length };
    const ok = extra ? await extra() : await open(page, label, viaPalette || vp === 'mobile');
    if (!ok) { out.push({ scenario, vp, id, opened: false }); return; }
    const r = await measure(page, log, id, mark);
    await page.screenshot({ path: path.join(OUT, 'shots', `${scenario}-${vp}-${id.replace(/\//g, '-')}.png`) });
    out.push({ scenario, vp, opened: true, ...r });
  };
  for (const [label, id] of SIDEBAR) await run(id, label, false);
  for (const [label, id] of PALETTE) await run(id, label, true);
  if (vp === 'desktop') {
    await open(page, 'Interview Coach', false);
    for (const s of SUBS) await run('simulate/' + s.toLowerCase().replace(/ /g, '-'), s, false, async () => { const b = page.locator('.app-sidebar-subitem', { hasText: s }).first(); if (!(await b.count())) return false; await b.click(); return true; });
  }
  await page.context().close();
}
await browser.close(); dev?.kill();
fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'sweep.json'), JSON.stringify(out, null, 1));
const bad = out.filter(r => !r.opened);
console.log('pages measured:', out.filter(r => r.opened).length, '| could not open:', bad.map(b => `${b.scenario}/${b.vp}/${b.id}`).join(', ') || 'none');
