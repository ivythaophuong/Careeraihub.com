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

  it('is off in the tests: an empty VITE_TURNSTILE_SITE_KEY overrides the committed key', () => {
    expect(mod.TURNSTILE_SITE_KEY).toBe('');
    expect(mod.captchaEnabled()).toBe(false);
  });

  it('the committed key has the shape of a Turnstile site key, is not a dummy test key, and is not a secret key', () => {
    expect(mod.COMMITTED_SITE_KEY).toMatch(/^0x4[A-Za-z0-9_-]{20,30}$/);   // a site key; a secret key is longer
    expect(mod.COMMITTED_SITE_KEY).not.toMatch(/^[123]x0{20}/);
  });

  it('a defined VITE_TURNSTILE_SITE_KEY wins over the committed key, an undefined one does not', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
    vi.resetModules();
    expect((await import('./captcha')).TURNSTILE_SITE_KEY).toBe('1x00000000000000000000AA');
    vi.unstubAllEnvs();
    vi.resetModules();
    const again = await import('./captcha');
    expect(again.TURNSTILE_SITE_KEY).toBe('');   // the config's empty value is back
  });
});
