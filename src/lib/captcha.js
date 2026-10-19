// Cloudflare Turnstile, the CAPTCHA that Supabase Auth can check (Authentication > Bot and Abuse Protection).
// The site key is public by design (every browser receives it); the SECRET key lives only in the Supabase dashboard and must never be put in this repository.
// The Docker build does not read .env files (see .dockerignore), so the key is committed here. VITE_TURNSTILE_SITE_KEY overrides it when it is DEFINED, even
// when empty: an empty value turns the widget off (the tests do this, see vite.config.js), and Cloudflare's dummy key 1x00000000000000000000AA (always passes)
// lets a local run on localhost work, because the real key only allows the production hostnames.
// While the key is empty no widget is shown and every request is exactly as before.
export const COMMITTED_SITE_KEY = '0x4AAAAAAFbMnrySwRvLIJVj';
const fromEnv = import.meta.env?.VITE_TURNSTILE_SITE_KEY;
export const TURNSTILE_SITE_KEY = String(fromEnv !== undefined ? fromEnv : COMMITTED_SITE_KEY).trim();
export const captchaEnabled = () => !!TURNSTILE_SITE_KEY;

// Cloudflare: the script must be fetched from exactly this URL; proxying or caching it makes Turnstile fail.
export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let loading = null;
export function loadTurnstile() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TURNSTILE_SCRIPT_URL;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : (loading = null, reject(new Error('Turnstile did not start'))));
    s.onerror = () => { loading = null; reject(new Error('Turnstile could not be loaded')); };
    document.head.appendChild(s);
  });
  return loading;
}
