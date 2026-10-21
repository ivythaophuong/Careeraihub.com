// Client for the `transcribe` Edge Function (voice practice spike). Off unless the build sets VITE_VOICE_PRACTICE=true, and the
// function itself answers only for the owner's account. The recording is sent once and not kept: nothing here writes it to storage.
import { FUNCTIONS_URL, SUPABASE_ANON } from './supabase';
import { getValidSession } from './session';

export const MAX_RECORD_SECONDS = 180; // matches the timed challenge; the recorder stops by itself
const TIMEOUT_MS = 60_000;

// Preview: the recorder is shown only to these accounts (the owner's). The Docker build does not read .env files, so this list is committed; ids are not secrets.
// The transcribe function enforces its own allowlist (VOICE_ALLOWED_USER_IDS), so this only keeps the button from showing to people it would refuse.
// VITE_VOICE_PRACTICE=true shows it to every account (local development); 'false' hides it for everyone.
export const PREVIEW_USER_IDS = ['669f63cb-02f8-4eb9-9cd1-2f6015f6a4fd'];
// Opening voice to every signed-in account is a deliberate one-line change (set this to true), made only after the server accepts everyone
// (VOICE_ALLOWED_USER_IDS=*) and the daily limit is on. Until then the button stays with the preview accounts. A test fails if it ships as true by accident.
export const VOICE_OPEN_TO_ALL = false;
export const voiceEnabled = (userId, openToAll = VOICE_OPEN_TO_ALL) => {
  const flag = import.meta.env.VITE_VOICE_PRACTICE;
  if (flag === 'false') return false;
  if (flag === 'true') return true;
  if (openToAll) return !!userId;
  return !!userId && PREVIEW_USER_IDS.includes(userId);
};

export class VoiceError extends Error {
  constructor(message, { status = 0 } = {}) { super(message); this.name = 'VoiceError'; this.status = status; }
}

const toBase64 = async (blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

// Returns the transcript text. Throws VoiceError with a message that is safe to show.
export async function transcribeAudio(blob, durationSec) {
  if (!blob || blob.size === 0) throw new VoiceError('Nothing was recorded. Please try again, or type your answer.');
  const session = await getValidSession();
  if (!session?.access_token) throw new VoiceError('Please sign in to use voice practice.', { status: 401 });
  const payload = { audioBase64: await toBase64(blob), mimeType: blob.type || 'audio/webm', durationSec: Math.round(durationSec) };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${FUNCTIONS_URL}/functions/v1/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON body */ }
    if (res.ok && typeof data?.text === 'string') return data.text;
    const message = res.status === 401 ? 'Your session expired. Please sign in again.' : data?.error?.message || `Voice request failed (${res.status}).`;
    throw new VoiceError(message, { status: res.status });
  } catch (e) {
    if (e instanceof VoiceError) throw e;
    throw new VoiceError(e?.name === 'AbortError' ? 'The transcription timed out. Please try again, or type your answer.' : 'Network error: check your connection and try again, or type your answer.');
  } finally {
    clearTimeout(timer);
  }
}
