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
});
