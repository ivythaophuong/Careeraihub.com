// Cloudflare Turnstile, the CAPTCHA that Supabase Auth can check (Authentication > Bot and Abuse Protection).
// OFF until a site key is set: the site key is public by design (it is sent to every browser), the secret key lives only in the Supabase dashboard.
// The Docker build does not read .env files (see .dockerignore), so the key is committed here; VITE_TURNSTILE_SITE_KEY overrides it for a local run.
// While it is empty no widget is shown and every request is exactly as before, so this code can be deployed before the check is switched on in Supabase.
const COMMITTED_SITE_KEY = '';
export const TURNSTILE_SITE_KEY = (import.meta.env?.VITE_TURNSTILE_SITE_KEY || COMMITTED_SITE_KEY || '').trim();
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
