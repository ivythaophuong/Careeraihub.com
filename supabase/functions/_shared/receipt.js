// Helpers shared by the scoring Edge Functions (score-star, score-interview): signed receipts and service-role REST calls.
import { setting } from '../ai/providers.js';

const enc = new TextEncoder();

export const signingKey = (env) => setting(env, 'SCORING_SIGNING_KEY') || setting(env, 'SUPABASE_SERVICE_ROLE_KEY');

export async function hmacHex(key, text) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(text));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export const sameText = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};


export const rest = (env, fetchImpl, path, init = {}) => fetchImpl(`${env.SUPABASE_URL}/rest/v1/${path}`, {
  ...init,
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...init.headers },
});

// Rows the user created in the last 24 hours (service role, exact count from the Content-Range header).
export async function countLastDay(env, fetchImpl, table, userId, now) {
  const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const q = new URLSearchParams({ select: 'id', user_id: `eq.${userId}`, created_at: `gte.${since}` });
  const res = await rest(env, fetchImpl, `${table}?${q}`, { headers: { Prefer: 'count=exact', Range: '0-0' } });
  if (!res.ok) throw new Error(`count ${res.status}`);
  const total = Number((res.headers.get('content-range') || '').split('/')[1]);
  if (!Number.isFinite(total)) throw new Error('count unreadable');
  return total;
}
