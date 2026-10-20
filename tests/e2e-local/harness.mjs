// Test harness (scratch, not part of the repo): a real Chromium against the app served locally, with the Supabase auth, tables and the Edge Functions faked.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';

export const REPO = process.env.REPO || process.cwd();
export const PORT = Number(process.env.PORT || 5230);
export const BASE = `http://localhost:${PORT}`;
// A Chromium that Playwright has already downloaded (`npx playwright install chromium`), or set PLAYWRIGHT_CHROMIUM to the path of one.
import fs from 'node:fs';
import path from 'node:path';
function findChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  const cache = path.join(process.env.HOME || '', 'Library/Caches/ms-playwright');
  try {
    const dir = fs.readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell')).sort().pop();
    const sub = fs.readdirSync(path.join(cache, dir)).find((d) => d.startsWith('chrome-headless-shell'));
    return path.join(cache, dir, sub, 'chrome-headless-shell');
  } catch { return undefined; }
}
export const EXE = findChromium();
export const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'tester@example.test', user_metadata: { full_name: 'Test User', role: 'candidate' } };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
export const fakeJwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 86400 })}.sig`;

export async function startDev() {
  const alive = () => new Promise(r => http.get(BASE, (res) => { res.resume(); r(res.statusCode === 200); }).on('error', () => r(false)));
  if (await alive()) return null;
  const child = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: REPO, env: { ...process.env, VITE_TURNSTILE_SITE_KEY: '' }, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await alive()) return child; await new Promise(r => setTimeout(r, 500)); }
  child.kill(); throw new Error('dev server did not start');
}
export const launch = () => chromium.launch({ headless: true, executablePath: EXE, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });

const QUESTIONS = { questions: [1, 2, 3, 4, 5].map(n => ({ question: `Tell me about a time number ${n} when you led a project and what changed as a result?`, focus: `Focus ${n}`, why: `Why ${n}` })) };
const FEEDBACK = { score: 68, verdict: 'Acceptable', worked: 'You gave a clear example. It had a clear start.', missed: 'The outcome had no figure. It stayed general.', tip: 'Add one concrete result. Say what changed.', betterAnswerOutline: ['Context', 'Your action', 'Outcome'] };

export async function newApp(browser, { seed = {}, viewport = { width: 1440, height: 900 }, signedIn = true, fn = {} } = {}) {
  const ctx = await browser.newContext({ viewport, permissions: ['microphone'] });
  const page = await ctx.newPage();
  const log = { console: [], pageErrors: [], failed: [], unmocked: [], writes: [], calls: [] };
  page.on('console', (m) => { if (m.type() === 'error') log.console.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => log.pageErrors.push(String(e.message).slice(0, 200)));
  page.on('requestfailed', (r) => { if (!/fonts\.g|challenges\.cloudflare/.test(r.url())) log.failed.push(r.url().slice(0, 120)); });
  if (signedIn) await page.addInitScript(([user, jwt]) => { try { localStorage.setItem('supabase.auth.token', JSON.stringify({ currentSession: { access_token: jwt, refresh_token: 'r', user } })); } catch {} }, [USER, fakeJwt()]);
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  await page.route(/supabase\.co\//, async (route) => {
    const req = route.request(); const u = new URL(req.url()); const p = u.pathname; const m = req.method();
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (p.startsWith('/auth/v1/user')) return json(route, USER);
    if (p.startsWith('/auth/v1/token')) return json(route, { access_token: fakeJwt(), refresh_token: 'r', expires_in: 3600, user: USER });
    if (p.startsWith('/rest/v1/')) {
      const table = p.replace('/rest/v1/', '').split('/')[0];
      if (m === 'GET') { log.calls.push(`GET ${table}`); return json(route, seed[table] || []); }
      let body = null; try { body = JSON.parse(req.postData() || 'null'); } catch {}
      log.writes.push({ method: m, table, body });
      return json(route, m === 'POST' ? [body ?? {}] : [], m === 'DELETE' ? 204 : 201);
    }
    if (p.startsWith('/functions/v1/')) {
      const name = p.split('/')[3]; let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch {}
      log.calls.push(`FN ${name}${body.feature ? ':' + body.feature : ''}${body.action ? ':' + body.action : ''}`);
      if (fn[name]) return json(route, await fn[name](body, log));
      if (name === 'ai') return json(route, { text: body.feature === 'mock_questions' ? JSON.stringify(QUESTIONS) : '{}' });
      if (name === 'score-interview') return json(route, body.action === 'save' ? { saved: true, id: 'row-1', avgScore: 68, questionsCount: (body.items || []).length } : { feedback: FEEDBACK, receipt: { ts: Date.now(), sig: 'sig' + Math.random() } });
      if (name === 'transcribe') return json(route, { text: Array.from({ length: 60 }, (_, i) => `word${i}`).join(' '), provider: 'groq' });
      if (name === 'jobs') return json(route, { jobs: [] });
      return json(route, {});
    }
    log.unmocked.push(`${m} ${p}`);
    return json(route, { error: 'unmocked' }, 404);
  });
  return { ctx, page, log };
}
export const shot = (page, path) => page.screenshot({ path, fullPage: false });
