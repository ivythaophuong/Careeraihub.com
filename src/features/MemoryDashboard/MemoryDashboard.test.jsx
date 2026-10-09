// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({ callLLM: vi.fn(), extractJSON: () => ({ error: true }) }));
vi.mock('../../lib/supabase', async (orig) => ({ ...(await orig()), sb: { delete: vi.fn() } }));
import MemoryDashboard, { buildMemoryContext } from './MemoryDashboard';

afterEach(cleanup);
const form = { role: 'PM', level: '', industry: 'Fintech', market: 'Singapore' };

describe('buildMemoryContext: missing data is left out, never a number', () => {
  it('does not average a story bank where some stories have no score', () => {
    const t = buildMemoryContext({ starBank: [{ score: 80 }, { oneLiner: 'legacy, no score' }, { score: 60 }] }, form);
    expect(t).toContain('3 stories banked, avg score 70/100'); // (80+60)/2, the legacy story is not a 0
    expect(t).not.toMatch(/NaN/);
  });

  it('shows no average at all when no story has a score', () => {
    const t = buildMemoryContext({ starBank: [{ oneLiner: 'a' }, { oneLiner: 'b' }] }, form);
    expect(t).toContain('2 stories banked');
    expect(t).not.toMatch(/avg score|NaN/);
  });

  it('does not count a JD analysis without a resume as a 0% match', () => {
    const t = buildMemoryContext({ jdAnalyses: [{ matchScore: 80 }, { matchScore: null }, { matchScore: 60 }] }, form);
    expect(t).toContain('3 analyzed, avg match score 70%');
  });

  it('shows no match average when none was scored against a resume', () => {
    const t = buildMemoryContext({ jdAnalyses: [{ matchScore: null }, {}] }, form);
    expect(t).toContain('2 analyzed');
    expect(t).not.toMatch(/avg match score|NaN/);
  });

  it('reads the latest scan from the newest-first list and the trend against the oldest scored scan', () => {
    const newestFirst = [{ score: 80 }, { score: 70 }, { score: 50 }];
    expect(buildMemoryContext({ scanHistory: newestFirst }, form)).toContain('latest score 80/100 (improving)');
    expect(buildMemoryContext({ scanHistory: [{ score: 40 }, { score: 70 }] }, form)).toContain('latest score 40/100 (declining)');
    expect(buildMemoryContext({ scanHistory: [{ score: 60 }, { score: 60 }] }, form)).toContain('(unchanged)');
    expect(buildMemoryContext({ scanHistory: [{ score: 60 }] }, form)).toContain('(first scan)');
  });

  it('skips unscored scans when finding the latest, and says so when none has a score', () => {
    expect(buildMemoryContext({ scanHistory: [{}, { score: 55 }] }, form)).toContain('latest score 55/100');
    const none = buildMemoryContext({ scanHistory: [{}, {}] }, form);
    expect(none).toContain('2 scans, no score recorded');
    expect(none).not.toMatch(/undefined|NaN/);
  });

  it('writes the target without "undefined" when the level is not set', () => {
    expect(buildMemoryContext({}, form)).toContain('Target: PM in Fintech, Singapore');
  });
});

describe('MemoryDashboard rendering', () => {
  const dash = (memory) => render(<MemoryDashboard memory={memory} form={form} user={{ id: 'u', token: 't' }} updateMemory={vi.fn()} setActiveModule={vi.fn()} embedded />);

  it('shows "No score recorded yet" instead of an empty or NaN chart when scans have no score', () => {
    dash({ scanHistory: [{ date: '2026-01-02T00:00:00Z' }, { date: '2026-01-01T00:00:00Z' }] });
    expect(screen.getByText('No score recorded yet.')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/NaN|undefined/);
  });

  it('draws only scored scans and compares first with latest of those', () => {
    dash({ scanHistory: [{ score: 80, date: '2026-01-03T00:00:00Z' }, { date: '2026-01-02T00:00:00Z' }, { score: 50, date: '2026-01-01T00:00:00Z' }] });
    expect(screen.queryByText('No score recorded yet.')).toBeNull();
    expect(screen.getByText(/\+30 pts improvement/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/NaN/);
  });
});
