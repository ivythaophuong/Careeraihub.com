// The browser client for the transcribe function (voice practice spike).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./session', () => ({ getValidSession: vi.fn(async () => ({ access_token: 'tok' })) }));
vi.mock('./supabase', () => ({ FUNCTIONS_URL: 'https://proj.supabase.co', SUPABASE_ANON: 'anon' }));
import { getValidSession } from './session';
import { voiceEnabled, transcribeAudio, VoiceError, MAX_RECORD_SECONDS } from './voice.js';

const blob = (type = 'audio/webm;codecs=opus') => new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type });
const reply = (status, body) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

beforeEach(() => { vi.stubGlobal('fetch', reply(200, { text: 'Hello there.', provider: 'groq' })); getValidSession.mockResolvedValue({ access_token: 'tok' }); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('voiceEnabled', () => {
  it('is off unless VITE_VOICE_PRACTICE is exactly "true"', () => {
    expect(voiceEnabled()).toBe(false);
    vi.stubEnv('VITE_VOICE_PRACTICE', 'on'); expect(voiceEnabled()).toBe(false);
    vi.stubEnv('VITE_VOICE_PRACTICE', 'true'); expect(voiceEnabled()).toBe(true);
  });
});

describe('transcribeAudio', () => {
  it('posts the recording as base64 with the token and returns the text', async () => {
    const text = await transcribeAudio(blob(), 12.4);
    expect(text).toBe('Hello there.');
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://proj.supabase.co/functions/v1/transcribe');
    expect(init.headers.Authorization).toBe('Bearer tok');
    const sent = JSON.parse(init.body);
    expect(sent).toEqual({ audioBase64: 'AQIDBAU=', mimeType: 'audio/webm;codecs=opus', durationSec: 12 });
  });
  it('does not touch any browser storage', async () => {
    const set = vi.spyOn(Storage.prototype, 'setItem');
    await transcribeAudio(blob(), 5);
    expect(set).not.toHaveBeenCalled();
  });
  it('asks the user to sign in when there is no session, without calling the server', async () => {
    getValidSession.mockResolvedValue(null);
    await expect(transcribeAudio(blob(), 5)).rejects.toMatchObject({ name: 'VoiceError', status: 401 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('turns the server message into a VoiceError with its status', async () => {
    vi.stubGlobal('fetch', reply(422, { error: { message: 'We could not hear any speech.' } }));
    await expect(transcribeAudio(blob(), 5)).rejects.toMatchObject({ status: 422, message: 'We could not hear any speech.' });
  });
  it('says plainly that voice is not available on a 403', async () => {
    vi.stubGlobal('fetch', reply(403, { error: { message: 'Voice practice is not available.' } }));
    await expect(transcribeAudio(blob(), 5)).rejects.toThrow(/not available/);
  });
  it('reports a network failure as a VoiceError, not a raw exception', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const e = await transcribeAudio(blob(), 5).catch(x => x);
    expect(e).toBeInstanceOf(VoiceError);
    expect(e.message).toMatch(/connection|network/i);
  });
  it('rejects an empty recording before sending anything', async () => {
    await expect(transcribeAudio(new Blob([], { type: 'audio/webm' }), 1)).rejects.toThrow(/nothing was recorded/i);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('the recording limit is 3 minutes, matching the timed challenge', () => {
    expect(MAX_RECORD_SECONDS).toBe(180);
  });
});
