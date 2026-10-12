// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/ai', () => ({ callLLM: vi.fn(), extractJSON: vi.fn() }));
vi.mock('../Landing/LandingPage', () => ({ GetReadyTabStrip: () => null }));

import { buildSystemPrompt } from './AICoach';

describe('AI Coach context: only what is true, and labelled', () => {
  const prompt = (memory = {}, form = {}) => buildSystemPrompt(memory, form);

  it('does not invent a market or an industry the user never gave', () => {
    const p = prompt({}, {});
    expect(p).toContain('Market: not stated');
    expect(p).toContain('Industry: not stated');
    expect(p).not.toMatch(/Singapore|Tech\b/);
  });

  it('uses the market and industry the user did give, and says the market was selected by the user', () => {
    const p = prompt({}, { market: 'Southeast Asia', industry: 'Finance' });
    expect(p).toContain('Market: Southeast Asia (selected by the user)');
    expect(p).toContain('Industry: Finance');
  });

  it('does not present the product default market as the user\'s choice: the app starts on Singapore, so Singapore may not have been chosen', () => {
    const p = prompt({}, { market: 'Singapore' });
    expect(p).toContain('Market: Singapore (product default; the user may not have chosen it)');
    expect(p).not.toContain('selected by the user');
  });

  it('does not state a resume ATS score: its only source has no live writer, so it cannot be verified', () => {
    for (const mem of [{ scanHistory: [{ score: 64 }] }, { scanHistory: [{ score: null }] }, { scanHistory: [] }]) {
      expect(prompt(mem)).not.toMatch(/ATS|resume scan|scan has no score/i);
    }
  });

  it('calls the newest STAR story the most recent one, not the best', () => {
    const p = prompt({ starBank: [{ bankAs: 'Cut report time' }, { bankAs: 'Older story' }] });
    expect(p).toContain('Most recent STAR story: "Cut report time"');
    expect(p).not.toMatch(/Best STAR/i);
  });

  it('labels the interview score as an AI estimate of first attempts', () => {
    const p = prompt({ mockSessions: [{ avgScore: 68 }, { avgScore: 60 }] });
    expect(p).toContain('Mock interviews completed: 2');
    expect(p).toMatch(/latest session average 68\/100.*AI estimate.*first attempt/i);
  });

  it('never tells the model a missing score is "null/100" or invents a number', () => {
    const p = prompt({ mockSessions: [{ avgScore: null }] });
    expect(p).not.toMatch(/null|undefined|NaN/);
    expect(p).toMatch(/latest session has no scored answer/i);
  });

  it('describes honestly what the coach has: a short summary, not the documents', () => {
    const p = prompt({ starBank: [{ bankAs: 'x' }] });
    expect(p).not.toMatch(/full context/i);
    expect(p).toMatch(/short summary/i);
    expect(p).toMatch(/do not have the user's resume text/i);
    expect(p).toMatch(/Do not claim to have seen them/i);
  });

  it('does not pass the old match-rate forecast to the model', () => {
    const p = prompt({ skillsGap: { result: { matchRate: 61, projectedMatchRate: 88, skills: [{ name: 'Kubernetes', status: 'gap' }] } } });
    expect(p).not.toMatch(/61|88|match rate/i);
    expect(p).toContain('Kubernetes');
  });

  it('keeps the context small whatever the user typed: long free-text fields are clipped', () => {
    const long = 'x'.repeat(500000);
    const p = prompt({ jdAnalyses: [{ roleTitle: long }], starBank: [{ bankAs: long }], skillsGap: { result: { skills: [{ name: long, status: 'gap' }] } } }, { role: long, level: long, market: long, industry: long });
    expect(p.length).toBeLessThan(3000);
  });
});
