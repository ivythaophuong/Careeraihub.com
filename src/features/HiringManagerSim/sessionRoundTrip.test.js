// @vitest-environment jsdom
// A finished practice session must survive a reload: the row that is written and the way useMemory
// reads it back have to agree, otherwise the score would exist only in memory.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../lib/supabase', () => ({ sb: { select: vi.fn(), upsert: vi.fn(async () => null), insert: vi.fn(async () => []) } }));
import { sb } from '../../lib/supabase';
import { useMemory } from '../../hooks/useMemory';
import { summarize, buildSessionRecord, toSessionRow } from './interview';

const results = [
  { question: 'q1', focus: 'f', answer: 'a', score: 80, verdict: 'strong' },
  { question: 'q2', focus: 'f', answer: 'b', score: 60, verdict: 'ok' },
  { question: 'q3', focus: 'f', skipped: true },
];

describe('mock session: write, then reload', () => {
  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(async () => { cleanup(); await new Promise(r => setTimeout(r, 0)); });

  const rec = buildSessionRecord({ personaId: 'startup', role: 'PM', results, summary: summarize(results) });

  it('writes the columns the score trigger and the loader both rely on', () => {
    expect(toSessionRow(rec)).toEqual({ avg_score: 70, questions_count: 2, mode: 'startup' });
  });

  it('comes back after a reload with the same score and question count', async () => {
    // What the database would hold after the insert (the trigger reads avg_score from this table)
    const dbRow = { id: 'row-1', user_id: 'u1', created_at: '2026-10-06T10:00:00Z', ...toSessionRow(rec) };
    sb.select.mockImplementation(async (table) => (table === 'mock_sessions' ? [dbRow] : []));
    const setIsRestoring = vi.fn();
    const { result } = renderHook(() => useMemory({ id: 'u1', token: 't' }, true, setIsRestoring, vi.fn()));
    await waitFor(() => expect(setIsRestoring).toHaveBeenCalledWith(false));
    expect(result.current.memory.mockSessions).toHaveLength(1);
    expect(result.current.memory.mockSessions[0]).toMatchObject({ avgScore: rec.avgScore, questionsCount: rec.questionsCount, date: '2026-10-06T10:00:00Z' });
  });
});
