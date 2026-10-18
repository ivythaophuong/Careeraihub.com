// Client of the usage ledger (docs/database/proposed/2026-10-15-practice-ledger.sql, applied to production 2026-10-15). Pure JS: runs under Deno and Vitest.
// Rules:
//  - Off unless the secret AI_LEDGER is "on" (and the service key exists), so deploying this code changes nothing by itself.
//  - Fail-open (owner decision D-7, proposed in PROPOSAL-practice-session-ledger-REV2): if the ledger cannot be reached or answers badly, the AI request goes
//    through and the failure is logged. A ledger outage must not take the product down while the gate is new.
//  - Only hashes, counts and ids reach the ledger. Never a prompt, a CV or an answer.
//  - The gate has a short time limit so a slow database cannot hold up the AI call.

export const GATE_TIMEOUT_MS = 2500;
const PDF_ALLOWANCE_TOKENS = 3000; // the real size of an attached PDF in tokens is not known before the call; this is a stated allowance, not a measurement

export const ledgerEnabled = (env = {}) =>
  String(env.AI_LEDGER || '').trim().toLowerCase() === 'on' && !!env.SUPABASE_SERVICE_ROLE_KEY && !!env.SUPABASE_URL;

// About four characters a token for the prompt, plus the most the answer may use. A ceiling, so the reservation never under-counts.
export function estimateTokens({ messages = [], maxTokens = 0, pdfBase64 = null }) {
  const chars = messages.reduce((n, m) => n + (typeof m?.content === 'string' ? m.content.length : 0), 0);
  return Math.max(0, Math.ceil(chars / 4) + Math.max(0, Math.floor(maxTokens)) + (pdfBase64 ? PDF_ALLOWANCE_TOKENS : 0));
}

export async function payloadHash(messages, maxTokens, hasPdf) {
  const data = new TextEncoder().encode(JSON.stringify({ messages, maxTokens, hasPdf: !!hasPdf }));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function makeLedger({ env, fetchImpl = fetch, timeoutMs = GATE_TIMEOUT_MS }) {
  const rpc = async (fn, args) => {
    const r = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) throw new Error(`ledger ${fn} answered ${r.status}`);
    return r.json();
  };
  return {
    // -> { outcome: 'reserved' | 'existing' | 'limit_reached' | 'gate_error', requestId, gateMode, reason }
    async reserve({ userId, key, hash, feature, session = null, estTokens }) {
      try {
        const rows = await rpc('reserve_ai_request', { p_user: userId, p_key: key, p_hash: hash, p_feature: feature, p_session: session, p_est_tokens: estTokens });
        const row = Array.isArray(rows) ? rows[0] : null;
        if (!row || typeof row.outcome !== 'string') return { outcome: 'gate_error' };
        return { outcome: row.outcome, requestId: row.request_id ?? null, gateMode: row.gate_mode ?? null, reason: row.reason ?? null };
      } catch { return { outcome: 'gate_error' }; }
    },
    async settle({ id, state, usage = null, provider = null, model = null }) {
      try { await rpc('settle_ai_request', { p_id: id, p_state: state, p_in: usage?.input ?? null, p_out: usage?.output ?? null, p_think: usage?.thinking ?? null, p_provider: provider, p_model: model }); } catch { /* the ledger must never break a request */ }
    },
    async markUnknown(id) {
      try { await rpc('mark_unknown', { p_id: id }); } catch { /* same */ }
    },
  };
}
