import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('./session', () => ({ getValidSession: vi.fn(async () => ({ access_token: 'tok' })) }));
vi.mock('./supabase', () => ({ FUNCTIONS_URL: 'https://proj.supabase.co', SUPABASE_ANON: 'anon' }));
import { evaluateAnswerOnServer } from './serverScoring.js';

const D = { speechSec: 22, totalSec: 35.3, speechPercent: 62, longPauses: 3, longestPauseSec: 2.7, paceWhileSpeakingWpm: 139 };
beforeEach(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ feedback: {}, receipt: {} }), { status: 200 }))); });
afterEach(() => vi.unstubAllGlobals());

describe('evaluateAnswerOnServer', () => {
  it('includes the delivery figures when given', async () => {
    await evaluateAnswerOnServer({ personaId: 'startup', role: '', question: 'Q', answer: 'A', resumeText: '', delivery: D });
    expect(JSON.parse(fetch.mock.calls[0][1].body).delivery).toEqual(D);
  });
  it('sends no delivery field when there are none', async () => {
    await evaluateAnswerOnServer({ personaId: 'startup', role: '', question: 'Q', answer: 'A', resumeText: '' });
    expect('delivery' in JSON.parse(fetch.mock.calls[0][1].body)).toBe(false);
  });
});
