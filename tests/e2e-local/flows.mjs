import fs from 'node:fs';
import path from 'node:path';
const OUT = process.env.E2E_OUT || path.join(process.cwd(), 'e2e-out');
import { startDev, launch, newApp, BASE } from './harness.mjs';

const PROFILE = [{ id: '1', role: 'Product Manager', industry: 'Technology', level: 'Mid', market: 'Singapore', urgency: '7 days' }];
const RESUME = 'Product manager at Acme Corp, 2021 to 2025. Led a checkout migration across three teams. Reduced support tickets by 30 percent. Skills: roadmapping, SQL, stakeholder management, A/B testing. '.repeat(4);
const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
const RICH = {
  profiles: PROFILE,
  user_memory: [{ data: { resumeText: RESUME, scanResult: { credibilityScore: 62 } } }],
  resume_scans: [{ id: 's1', created_at: day(3), credibility_score: 62, file_name: 'cv.pdf', metrics_found: 5, summary: 'A solid CV.', issues: [], questions: [] }],
  star_stories: [1, 2, 3].map(n => ({ id: 'st' + n, created_at: day(n), title: `Story ${n}`, situation: 'We had a failing checkout.', task: 'Fix it.', action: 'I led the migration.', result: 'Errors fell 80 percent.', one_liner: 'Led a migration', score: 70 })),
  mock_sessions: [{ id: 'm1', created_at: day(2), mode: 'seriesb', questions_count: 5, avg_score: 64 }, { id: 'm2', created_at: day(5), mode: 'startup', questions_count: 4, avg_score: 58 }],
  jd_analyses: [{ id: 'j1', created_at: day(4), role_title: 'Senior PM', match_score: 71 }],
  candidate_trust_profiles: [{ user_id: '11111111-1111-4111-8111-111111111111', full_name: 'Test User', is_visible: false, interview_score: 61, ats_score: 62, trust_score: 40 }],
};
const results = [];
const check = (area, name, ok, detail = '') => { results.push({ area, name, ok: !!ok, detail }); };
const txt = (page) => page.locator('body').innerText();
const settle = (page, ms = 1200) => page.waitForTimeout(ms);
async function where(page) {
  return page.evaluate(() => {
    const act = document.querySelector('.app-sidebar-item.active')?.innerText.replace(/\s+/g, ' ').trim().replace(/\s(Live|New|In dev|Planned)$/i, '') || '';
    const sub = document.querySelector('.app-sidebar-subitem.active')?.innerText.trim() || '';
    const head = (document.querySelector('h1,h2,h3')?.textContent || '').trim().slice(0, 40);
    return { act, sub, head };
  });
}
const dev = await startDev();
const browser = await launch();
const fresh = async (seed, opts = {}) => { const a = await newApp(browser, { seed, ...opts }); await a.page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await settle(a.page, 2500); return a; };
const sidebar = (page, label) => page.locator('.app-sidebar-item', { hasText: new RegExp('^\\s*' + label, 'i') }).first().click();
// The parts of a feature are an accordion: clicking the feature while inside it closes them, so open them again when they are hidden.
const sub = async (page, label) => {
  const part = page.locator('.app-sidebar-subitem', { hasText: label }).first();
  if (!(await part.isVisible())) await page.locator('.app-sidebar-item[aria-expanded]').first().click();
  await part.click();
};

// ── F1 the resume flows from memory into the other features ───────────────────────────────────────────────────────────────────────────────────
{
  const { page, log, ctx } = await fresh(RICH);
  await sidebar(page, 'ATS Scanner'); await settle(page);
  check('F1 resume', 'ATS Scanner shows the saved resume as loaded', /Resume loaded/i.test(await txt(page)));
  await sidebar(page, 'Interview Coach'); await sub(page, 'Live Session'); await settle(page);
  await page.getByText(/Series B/).first().click(); await settle(page, 2000);
  const q = log.calls.filter(c => c === 'FN ai:mock_questions').length;
  check('F1 resume', 'starting a mock interview asks the AI for questions', q >= 1, `calls: ${q}`);
  await ctx.close();
}
// capture the actual prompt sent for the questions: does it contain the resume?
{
  let prompt = '';
  const { page, ctx } = await newApp(browser, { seed: RICH, fn: { ai: async (b) => { if (b.feature === 'mock_questions') prompt = b.messages?.[0]?.content || ''; return { text: JSON.stringify({ questions: [1, 2, 3, 4, 5].map(n => ({ question: `Question number ${n} about a time you led a project and what changed?`, focus: `F${n}`, why: 'w' })) }) }; } } });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  await sidebar(page, 'Interview Coach'); await sub(page, 'Live Session'); await page.getByText(/Series B/).first().click(); await settle(page, 2000);
  check('F1 resume', 'the interview prompt carries the saved resume text', prompt.includes('Acme Corp'), `prompt length ${prompt.length}`);
  check('F1 resume', 'the resume is marked as untrusted data in the prompt', /untrusted/i.test(prompt));
  await ctx.close();
}
// ── F2 practice sessions flow into the dashboard, the roadmap and the coach overview ─────────────────────────────────────────────────────────────
{
  const { page, ctx } = await fresh(RICH);
  const dash = await txt(page);
  check('F2 sessions', 'Dashboard shows the latest session average (64)', /64/.test(dash) && /Latest interview session|LATEST SESSION/i.test(dash));
  await sidebar(page, 'Career Roadmap'); await settle(page);
  check('F2 sessions', 'Career Roadmap shows the same latest average (64%)', /64\s*%|64\/75|average is 64/.test(await txt(page)));
  await sidebar(page, 'Interview Coach'); await settle(page);
  const ov = await txt(page);
  check('F2 sessions', 'Interview Coach overview counts 2 mock interviews', /2\s*\n?\s*Mock interviews completed/i.test(ov) || /Mock interviews completed/i.test(ov) && /\b2\b/.test(ov));
  check('F2 sessions', 'Interview Coach overview counts 9 questions answered (5 + 4)', /\b9\b/.test(ov));
  await sidebar(page, 'TrustMatch'); await settle(page);
  check('F2 sessions', 'TrustMatch shows the stored practice score (61) from the trust profile', /61/.test(await txt(page)));
  await ctx.close();
}
// ── F3 STAR stories flow into the overview, the roadmap and the dashboard ────────────────────────────────────────────────────────────────────
{
  const { page, ctx } = await fresh(RICH);
  const dash = await txt(page);
  check('F3 stories', 'Dashboard counts 3 saved STAR stories', /STAR BANK[\s\S]{0,40}\b3\b|\b3\b[\s\S]{0,30}Stories saved/i.test(dash));
  await sidebar(page, 'Interview Coach'); await sub(page, 'Overview'); await settle(page);
  check('F3 stories', 'Interview overview counts 3 STAR stories', /3\s*\n?\s*STAR stories saved/i.test(await txt(page)));
  await sub(page, 'STAR Bank'); await settle(page);
  check('F3 stories', 'the STAR Bank part lists the saved stories', /Story 1|Led a migration/i.test(await txt(page)));
  await ctx.close();
}
// ── F4 doing a mock interview writes back and updates the other screens ─────────────────────────────────────────────────────────────────────────
{
  const { page, log, ctx } = await fresh(RICH);
  await sidebar(page, 'Interview Coach'); await sub(page, 'Live Session'); await settle(page);
  await page.getByText(/Series B/).first().click(); await page.getByText(/Question 1\/5/).waitFor({ timeout: 8000 });
  const ANSWER = 'I led the migration of our checkout service, split it into three stages, coordinated three teams and kept stakeholders updated every week until it shipped.';
  let done = 0;
  for (let i = 0; i < 5; i++) {
    await page.getByLabel('Your answer').fill(ANSWER);
    await page.getByRole('button', { name: /Get AI Feedback/ }).click();
    await page.getByLabel('Answer score').waitFor({ timeout: 8000 });
    done++;
    await page.getByRole('button', { name: i === 4 ? /See Results/ : /Next Question/ }).click();
    await settle(page, 500);
  }
  await settle(page, 1500);
  check('F4 write-back', 'five answers were each sent to the grader', log.calls.filter(c => c === 'FN score-interview:evaluate').length === 5, String(log.calls.filter(c => c === 'FN score-interview:evaluate').length));
  check('F4 write-back', 'the finished session was saved through the grader (one save)', log.calls.filter(c => c === 'FN score-interview:save').length === 1);
  check('F4 write-back', 'the account memory was written after the session', log.writes.some(w => w.table === 'user_memory'));
  await page.getByRole('button', { name: /Exit|Practice again|New session|Back/i }).first().click().catch(() => {});
  await settle(page, 800);
  await sidebar(page, 'Interview Coach'); await sub(page, 'Overview'); await settle(page);
  const ov = await txt(page);
  check('F4 write-back', 'the overview now counts 3 sessions (2 saved before + this one)', /\b3\b[\s\S]{0,40}Mock interviews completed|Mock interviews completed[\s\S]{0,10}\b3\b/i.test(ov), ov.replace(/\s+/g, ' ').slice(0, 140));
  await sidebar(page, 'Dashboard'); await settle(page);
  check('F4 write-back', 'the dashboard reflects the new latest session without a reload', /68/.test(await txt(page)));
  await ctx.close();
}
// ── F5 every call-to-action: where does it go? ─────────────────────────────────────────────────────────────────────────────────────────────────
const linkMap = [];
async function ctaSweep(label, seed, open) {
  const probe = await fresh(seed); await open(probe.page); await settle(probe.page);
  const names = await probe.page.evaluate(() => [...document.querySelectorAll('main button, #root > div button')].filter(b => !b.closest('.app-sidebar') && !b.closest('.mob-bottom-nav') && !b.closest('.mob-glass-bar') && b.offsetParent !== null).map(b => (b.innerText || b.getAttribute('aria-label') || '').trim()).filter(t => t && t.length < 45 && !/^(Light|Dark|⌘K|Hide|Show|Sign out)/.test(t)));
  const uniq = [...new Set(names)];
  await probe.ctx.close();
  for (const name of uniq) {
    const a = await fresh(seed); await open(a.page); await settle(a.page, 800);
    const before = await where(a.page);
    const mark = a.log.console.length + a.log.pageErrors.length;
    try { await a.page.getByRole('button', { name, exact: true }).first().click({ timeout: 3000 }); } catch { linkMap.push({ page: label, button: name, result: 'could not click' }); await a.ctx.close(); continue; }
    await settle(a.page, 900);
    const after = await where(a.page);
    const moved = before.act !== after.act || before.sub !== after.sub || before.head !== after.head;
    linkMap.push({ page: label, button: name, to: `${after.act}${after.sub ? ' / ' + after.sub : ''}`, head: after.head, moved, errors: a.log.console.length + a.log.pageErrors.length - mark });
    await a.ctx.close();
  }
}
await ctaSweep('Dashboard (rich)', RICH, async () => {});
await ctaSweep('Dashboard (new user)', { profiles: PROFILE }, async () => {});
await ctaSweep('Career Roadmap (rich)', RICH, (p) => sidebar(p, 'Career Roadmap'));
await ctaSweep('Interview overview (rich)', RICH, async (p) => { await sidebar(p, 'Interview Coach'); await sub(p, 'Overview'); });
await ctaSweep('Skills Gap (rich)', RICH, (p) => sidebar(p, 'Skills Gap'));
await ctaSweep('AI Career Coach (rich)', RICH, (p) => sidebar(p, 'AI Career Coach'));

await browser.close(); dev?.kill();
fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'flows.json'), JSON.stringify({ results, linkMap }, null, 1));
console.log(results.map(r => `${r.ok ? 'PASS' : 'FAIL'}  [${r.area}] ${r.name}${r.ok ? '' : '  -> ' + r.detail}`).join('\n'));
console.log(`\n${results.filter(r => r.ok).length}/${results.length} checks passed; ${linkMap.length} buttons followed`);
