// DEVELOPMENT ONLY. The Edge Functions answer only the production origin, so the browser blocks their answers when the app runs on localhost (CORS).
// With DEV_FUNCTIONS_PROXY=1 the dev server forwards /functions/v1 to the project and presents the production origin, and the app is told to call
// the functions on its own origin (VITE_FUNCTIONS_URL= empty). The browser then sees one origin and nothing is blocked. Sign-in and the database
// already answer a browser on localhost, so they are not proxied. No server secret changes, and nothing here runs in a build.
export const DEFAULT_SUPABASE_URL = 'https://ruibdsvrcctxgxctaxwe.supabase.co';   // the same default as src/lib/supabase.js (a test keeps them equal)
export const DEFAULT_ORIGIN = 'https://careeraihub.com';

export function devProxyConfig(env = {}) {
  if (env?.DEV_FUNCTIONS_PROXY !== '1') return undefined;
  const target = env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  let u;
  try { u = new URL(target); } catch { u = null; }
  if (!u || !/^https?:$/.test(u.protocol)) throw new Error(`DEV_FUNCTIONS_PROXY: VITE_SUPABASE_URL must be an http(s) address (got "${target}").`);
  return {
    '/functions/v1': { target, changeOrigin: true, secure: true, headers: { Origin: env.DEV_PROXY_ORIGIN || DEFAULT_ORIGIN } },
  };
}
