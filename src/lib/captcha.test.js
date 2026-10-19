import { describe, it, expect, beforeEach, vi } from 'vitest';

// The loader keeps its state (a script already requested) at module level, so each test starts from a fresh copy of the module.
let mod;
beforeEach(async () => { delete window.turnstile; document.head.innerHTML = ''; vi.resetModules(); mod = await import('./captcha'); });

describe('loadTurnstile', () => {
  it('loads Cloudflare\'s script from the exact URL, explicit rendering, once', async () => {
    const p1 = mod.loadTurnstile(); const p2 = mod.loadTurnstile();
    const scripts = [...document.head.querySelectorAll('script')];
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe(mod.TURNSTILE_SCRIPT_URL);
    expect(mod.TURNSTILE_SCRIPT_URL).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
    window.turnstile = { render() {} };
    scripts[0].onload();
    expect(await p1).toBe(window.turnstile);
    expect(await p2).toBe(window.turnstile);
  });

  it('rejects when the script cannot be loaded, and can be tried again', async () => {
    const p = mod.loadTurnstile();
    document.head.querySelector('script').onerror();
    await expect(p).rejects.toThrow();
    const again = mod.loadTurnstile();
    again.catch(() => {});
    expect(document.head.querySelectorAll('script')).toHaveLength(2);   // a second attempt adds a new script
  });

  it('rejects when the script loaded but Turnstile did not start', async () => {
    const p = mod.loadTurnstile();
    document.head.querySelector('script').onload();
    await expect(p).rejects.toThrow();
  });

  it('uses an already loaded Turnstile without adding a script', async () => {
    window.turnstile = { render() {} };
    expect(await mod.loadTurnstile()).toBe(window.turnstile);
    expect(document.head.querySelectorAll('script')).toHaveLength(0);
  });

  it('is off while no site key is set', () => {
    expect(mod.TURNSTILE_SITE_KEY).toBe('');
    expect(mod.captchaEnabled()).toBe(false);
  });
});
