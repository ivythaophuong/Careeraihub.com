// A development-only proxy for the Edge Functions. On localhost the browser blocks their answers (CORS: the functions answer only the production
// origin). With DEV_FUNCTIONS_PROXY=1 the dev server forwards /functions/v1 and presents the production origin, so the browser sees one origin.
// Nothing here runs in a build, and no secret on the server changes.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { devProxyConfig, DEFAULT_SUPABASE_URL, DEFAULT_ORIGIN } from '../../vite.devProxy.js';

describe('devProxyConfig', () => {
  it.each([[{}], [{ DEV_FUNCTIONS_PROXY: '' }], [{ DEV_FUNCTIONS_PROXY: '0' }], [{ DEV_FUNCTIONS_PROXY: 'true' }], [undefined]])('is off unless DEV_FUNCTIONS_PROXY is exactly 1 (%j)', (env) => {
    expect(devProxyConfig(env)).toBeUndefined();
  });

  it('when on, forwards only /functions/v1 to the project, presenting the production origin', () => {
    const cfg = devProxyConfig({ DEV_FUNCTIONS_PROXY: '1' });
    expect(Object.keys(cfg)).toEqual(['/functions/v1']);
    expect(cfg['/functions/v1']).toMatchObject({ target: DEFAULT_SUPABASE_URL, changeOrigin: true, secure: true, headers: { Origin: DEFAULT_ORIGIN } });
  });

  it('does not proxy sign-in or the database: those already answer a browser on localhost', () => {
    const cfg = devProxyConfig({ DEV_FUNCTIONS_PROXY: '1' });
    expect(cfg['/auth/v1']).toBeUndefined();
    expect(cfg['/rest/v1']).toBeUndefined();
  });

  it('uses the project and the origin the developer set', () => {
    const cfg = devProxyConfig({ DEV_FUNCTIONS_PROXY: '1', VITE_SUPABASE_URL: 'https://abc.supabase.co', DEV_PROXY_ORIGIN: 'https://staging.example.com' });
    expect(cfg['/functions/v1'].target).toBe('https://abc.supabase.co');
    expect(cfg['/functions/v1'].headers.Origin).toBe('https://staging.example.com');
  });

  it('refuses a target that is not an http(s) address', () => {
    expect(() => devProxyConfig({ DEV_FUNCTIONS_PROXY: '1', VITE_SUPABASE_URL: 'javascript:alert(1)' })).toThrow(/http/i);
    expect(() => devProxyConfig({ DEV_FUNCTIONS_PROXY: '1', VITE_SUPABASE_URL: 'not a url' })).toThrow(/http/i);
  });

  it('defaults to the same project the browser code defaults to', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../src/lib/supabase.js'), 'utf8');
    expect(src).toContain(DEFAULT_SUPABASE_URL);
  });
});
