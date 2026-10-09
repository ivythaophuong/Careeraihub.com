// The three database calls of the consent flow. Each one reports success only when the database confirms it.
import { sb } from '../../lib/supabase';

export async function listConsents(token) {
  const rows = await sb.select('consents', { order: 'granted_at.desc', limit: '200' }, token);
  if (!Array.isArray(rows)) throw new Error('Could not load your sharing settings.');
  return rows;
}

// `row` comes from buildGrant. Nothing is shown as shared unless the database returns the created row.
export async function grantConsent(row, token) {
  const out = await sb.insert('consents', row, token);
  const created = Array.isArray(out) ? out[0] : null;
  if (!created?.id) throw new Error('The share was not confirmed, so nothing was shared.');
  return created;
}

// One request per employer: every consent of that employer that is not yet revoked. The filter "revoked_at is null" is part of the contract
// (without it the database refuses to touch an already revoked row). The database stamps the time.
export async function stopSharing(employerId, token, now = new Date()) {
  if (!employerId) throw new Error('An employer is required.');
  const out = await sb.update('consents', { employer_id: `eq.${employerId}`, revoked_at: 'is.null' }, { revoked_at: now.toISOString() }, token);
  if (!Array.isArray(out)) throw new Error('Stopping was not confirmed. Your sharing is unchanged.');
  return out;
}
