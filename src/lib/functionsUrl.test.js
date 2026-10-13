// The address the browser uses for the Edge Functions. It is the Supabase address unless a developer points it elsewhere (the dev proxy: an empty
// value means the same origin as the page).
import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
const load = async () => { vi.resetModules(); return import('./supabase.js'); };

describe('FUNCTIONS_URL', () => {
  it('is the Supabase address when nothing is set', async () => {
    const m = await load();
    expect(m.FUNCTIONS_URL).toBe(m.SUPABASE_URL);
  });

  it('an empty value means the page\'s own origin', async () => {
    vi.stubEnv('VITE_FUNCTIONS_URL', '');
    const m = await load();
    expect(m.FUNCTIONS_URL).toBe('');
  });

  it('a set value is used as it is', async () => {
    vi.stubEnv('VITE_FUNCTIONS_URL', 'http://localhost:9999');
    const m = await load();
    expect(m.FUNCTIONS_URL).toBe('http://localhost:9999');
  });
});
