// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({
  sb: { select: vi.fn(async () => []), upsert: vi.fn(async () => null), insert: vi.fn(async () => []) },
}));
import { sb } from '../lib/supabase';
import { useMemory } from './useMemory';

const user = { id: 'u1', email: 'a@b.c', token: 't' };

async function booted() {
  const setIsRestoring = vi.fn();
  const hook = renderHook(() => useMemory(user, true, setIsRestoring, vi.fn()));
  await waitFor(() => expect(setIsRestoring).toHaveBeenCalledWith(false));
  return hook;
}
const lastBackup = () => sb.upsert.mock.calls.filter(c => c[0] === 'user_memory').at(-1)[1].data;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('useMemory.updateMemory merges instead of replacing', () => {
  it('keeps unrelated memory when an updater returns only its own key', async () => {
    const { result } = await booted();
    await act(async () => { await result.current.updateMemory({ resumeText: 'cv', scanResult: { s: 1 }, scanPdfBase64: 'PDF' }); });
    // This is exactly what STAR Builder, JD Analyzer, Cover Letter, HM Simulator and Job Search do:
    await act(async () => { await result.current.updateMemory(m => ({ starBank: [{ id: 1 }, ...(m.starBank || [])] })); });
    expect(result.current.memory).toMatchObject({ resumeText: 'cv', scanResult: { s: 1 }, scanPdfBase64: 'PDF', starBank: [{ id: 1 }] });
  });

  it('persists the merged state, so the saved backup does not lose the resume either', async () => {
    const { result } = await booted();
    await act(async () => { await result.current.updateMemory({ resumeText: 'cv' }); });
    await act(async () => { await result.current.updateMemory(() => ({ applications: [{ id: 9 }] })); });
    expect(lastBackup()).toMatchObject({ resumeText: 'cv', applications: [{ id: 9 }] });
  });

  it('still supports updaters that spread the previous state', async () => {
    const { result } = await booted();
    await act(async () => { await result.current.updateMemory({ a: 1 }); });
    await act(async () => { await result.current.updateMemory(m => ({ ...m, b: 2 })); });
    expect(result.current.memory).toMatchObject({ a: 1, b: 2 });
  });

  it('stacks back-to-back updates made in the same tick', async () => {
    const { result } = await booted();
    await act(async () => {
      result.current.updateMemory(m => ({ n: (m.n || 0) + 1 }));
      result.current.updateMemory(m => ({ n: (m.n || 0) + 1 }));
      result.current.updateMemory(m => ({ n: (m.n || 0) + 1 }));
    });
    expect(result.current.memory.n).toBe(3);
  });

  it('tolerates an updater that returns nothing', async () => {
    const { result } = await booted();
    await act(async () => { await result.current.updateMemory({ keep: 1 }); });
    await act(async () => { await result.current.updateMemory(() => undefined); });
    expect(result.current.memory.keep).toBe(1);
  });
});

describe('Clear Memory pattern (empties every key on top of merging)', () => {
  // Mirrors the updater used by MemoryDashboard.clearMemory
  const wipe = m => ({
    scanHistory: [], starBank: [],
    ...Object.fromEntries(Object.keys(m || {}).map(k => [k, Array.isArray(m[k]) ? [] : typeof m[k] === 'number' ? 0 : null])),
  });

  it('removes the resume and every other stored key, not only the listed defaults', async () => {
    const { result } = await booted();
    await act(async () => { await result.current.updateMemory({ resumeText: 'cv', scanResult: { s: 1 }, aiChat: [{ role: 'user' }], credits: 4, starBank: [{ id: 1 }] }); });
    await act(async () => { await result.current.updateMemory(wipe); });
    expect(result.current.memory).toMatchObject({ resumeText: null, scanResult: null, aiChat: [], credits: 0, starBank: [], scanHistory: [] });
  });
});

describe('syncError tells the UI when a save fails', () => {
  it('is null at first and after a successful save', async () => {
    const { result } = await booted();
    expect(result.current.syncError).toBeNull();
    await act(async () => { await result.current.updateMemory({ a: 1 }); });
    expect(result.current.syncError).toBeNull();
  });

  it('is set when saving fails, with the reason', async () => {
    const { result } = await booted();
    sb.upsert.mockRejectedValue(new Error('JWT expired'));
    await act(async () => { await result.current.updateMemory({ a: 1 }); });
    expect(result.current.syncError).toMatchObject({ message: 'JWT expired' });
  });

  it('is set when only the relational row fails but the backup saves', async () => {
    const { result } = await booted();
    sb.insert.mockRejectedValue(new Error('insert denied'));
    await act(async () => { await result.current.updateMemory({ a: 1 }, { table: 'mock_sessions', data: { avg_score: 5 } }); });
    expect(result.current.syncError).toMatchObject({ message: 'insert denied' });
  });

  it('is a new object on every failure so each one can be announced, and clears after a good save', async () => {
    const { result } = await booted();
    sb.upsert.mockRejectedValue(new Error('down'));
    await act(async () => { await result.current.updateMemory({ a: 1 }); });
    const first = result.current.syncError;
    await act(async () => { await result.current.updateMemory({ a: 2 }); });
    expect(result.current.syncError).not.toBe(first);
    sb.upsert.mockResolvedValue(null);
    await act(async () => { await result.current.updateMemory({ a: 3 }); });
    expect(result.current.syncError).toBeNull();
  });
});

describe('fails closed when the stored memory cannot be read', () => {
  afterEach(() => { sb.select.mockImplementation(async () => []); });

  it('keeps saving locked and reports the error, so nothing is overwritten', async () => {
    sb.select.mockImplementation(async (table) => { if (table === 'user_memory') throw new Error('network down'); return []; });
    const setIsRestoring = vi.fn();
    const setRestoreError = vi.fn();
    const { result } = renderHook(() => useMemory(user, true, setIsRestoring, setRestoreError));
    await waitFor(() => expect(setRestoreError).toHaveBeenCalledWith(true));
    expect(setIsRestoring).not.toHaveBeenCalledWith(false);

    await act(async () => { await result.current.updateMemory({ resumeText: 'typed after the failed load' }); });
    expect(sb.upsert).not.toHaveBeenCalled();
    expect(sb.insert).not.toHaveBeenCalled();
  });

  it('still starts when only a non-critical table fails to load', async () => {
    sb.select.mockImplementation(async (table) => { if (table === 'resume_scans') throw new Error('table unavailable'); return []; });
    const setIsRestoring = vi.fn();
    const setRestoreError = vi.fn();
    renderHook(() => useMemory(user, true, setIsRestoring, setRestoreError));
    await waitFor(() => expect(setIsRestoring).toHaveBeenCalledWith(false));
    expect(setRestoreError).not.toHaveBeenCalled();
  });

  it('keeps the stored memory when it loads fine', async () => {
    sb.select.mockImplementation(async (table) => table === 'user_memory' ? [{ data: { resumeText: 'saved cv' } }] : []);
    const setIsRestoring = vi.fn();
    const { result } = renderHook(() => useMemory(user, true, setIsRestoring, vi.fn()));
    await waitFor(() => expect(setIsRestoring).toHaveBeenCalledWith(false));
    expect(result.current.memory.resumeText).toBe('saved cv');
  });
});

describe('syncedAt lets screens re-read database-computed values', () => {
  it('starts at 0 and changes after each fully successful save', async () => {
    const { result } = await booted();
    expect(result.current.syncedAt).toBe(0);
    await act(async () => { await result.current.updateMemory({ a: 1 }); });
    const first = result.current.syncedAt;
    expect(first).toBeGreaterThan(0);
    await new Promise(r => setTimeout(r, 5));
    await act(async () => { await result.current.updateMemory({ a: 2 }); });
    expect(result.current.syncedAt).toBeGreaterThan(first);
  });

  it('does not change when the save fails', async () => {
    const { result } = await booted();
    sb.upsert.mockRejectedValue(new Error('down'));
    await act(async () => { await result.current.updateMemory({ a: 1 }); });
    expect(result.current.syncedAt).toBe(0);
    sb.upsert.mockResolvedValue(null);
  });
});
