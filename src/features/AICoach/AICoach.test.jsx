// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/ai', () => ({ callLLM: vi.fn(), extractJSON: vi.fn() }));
vi.mock('../Landing/LandingPage', () => ({ GetReadyTabStrip: () => null }));

import { buildSystemPrompt } from './AICoach';

describe('AI Coach context', () => {
  it('states the latest ATS score when there is one', () => {
    expect(buildSystemPrompt({ scanHistory: [{ score: 64 }] }, {})).toContain('Latest resume ATS score: 64/100');
  });

  it('never tells the model a missing score is "null/100"', () => {
    const p = buildSystemPrompt({ scanHistory: [{ score: null }] }, {});
    expect(p).not.toMatch(/null|undefined/);
    expect(p).toContain('no score recorded');
  });

  it('does not pass the old match-rate forecast to the model', () => {
    const p = buildSystemPrompt({ skillsGap: { result: { matchRate: 61, projectedMatchRate: 88, skills: [{ name: 'Kubernetes', status: 'gap' }] } } }, {});
    expect(p).not.toMatch(/61|88|match rate/i);
    expect(p).toContain('Kubernetes');
  });

  it('keeps the context small whatever the user typed: long free-text fields are clipped', () => {
    const long = 'x'.repeat(500000);
    const p = buildSystemPrompt({ jdAnalyses: [{ roleTitle: long }], starBank: [{ bankAs: long }], skillsGap: { result: { skills: [{ name: long, status: 'gap' }] } } }, { role: long, level: long, market: long, industry: long });
    expect(p.length).toBeLessThan(3000);
  });
});
