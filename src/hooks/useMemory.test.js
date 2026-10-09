// @vitest-environment jsdom
// Merged from the hotfix and main test suites (every case from both is kept).
// The backup write is debounced, so cases that look at what was saved call flushMemory() first.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({
  sb: { select: vi.fn(async () => []), upsert: vi.fn(async () => null), insert: vi.fn(async () => []) },
}));
import { sb } from '../lib/supabase';
import { useMemory, toBackup, BACKUP_DEBOUNCE_MS } from './useMemory';

const user = { id: 'u1', email: 'a@b.c', token: 't' };

async function booted() {
  const setIsRestoring = vi.fn();
  const hook = renderHook(() => useMemory(user, true, setIsRestoring, vi.fn()));
  await waitFor(() => expect(setIsRestoring).toHaveBeenCalledWith(false));
  return hook;
}
const backups = () => sb.upsert.mock.calls.filter(c => c[0] === 'user_memory');
const lastBackup = () => backups().at(-1)[1].data;
const save = async (result, ...args) => {
  await act(async () => { await result.current.updateMemory(...args); await result.current.flushMemory(); });
};

beforeEach(() => {
  vi.clearAllMocks();
  sb.select.mockReset(); sb.select.mockResolvedValue([]);
  sb.upsert.mockReset(); sb.upsert.mockResolvedValue(null);
  sb.insert.mockReset(); sb.insert.mockResolvedValue([]);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => {
  vi.useRealTimers();
  // vitest runs with globals off, so testing-library does not unmount for us. Unmount here (which
  // flushes any pending backup) and let that write finish before the next test clears the mocks.
  cleanup();
  await new Promise(r => setTimeout(r, 0));
});

describe('useMemory.updateMemory merges instead of replacing', () => {
  it('merges object updates into existing memory', async () => {
    const { result } = await booted();
    await act(async () => { result.current.updateMemory({ resumeText: 'cv' }); });
    await act(async () => { result.current.updateMemory({ scanResult: { s: 1 } }); });
    expect(result.current.memory).toMatchObject({ resumeText: 'cv', scanResult: { s: 1 } });
  });

  it('keeps unrelated memory when an updater returns only its own key', async () => {
    const { result } = await booted();
    await act(async () => { await result.current.updateMemory({ resumeText: 'cv', scanResult: { s: 1 }, scanPdfBase64: 'PDF' }); });
    // This is exactly what STAR Builder, JD Analyzer, Cover Letter, HM Simulator and Job Search do:
    await act(async () => { await result.current.updateMemory(m => ({ starBank: [{ id: 1 }, ...(m.starBank || [])] })); });
    expect(result.current.memory).toMatchObject({ resumeText: 'cv', scanResult: { s: 1 }, scanPdfBase64: 'PDF', starBank: [{ id: 1 }] });
  });

  it('keeps the other keys when an updater returns only one (main variant)', async () => {
    const { result } = await booted();
    await act(async () => { result.current.updateMemory({ resumeText: 'cv', scanResult: { s: 1 } }); });
    await act(async () => { result.current.updateMemory(() => ({ applications: [{ id: 1 }] })); });
    expect(result.current.memory.resumeText).toBe('cv');
    expect(result.current.memory.scanResult).toEqual({ s: 1 });
    expect(result.current.memory.applications).toEqual([{ id: 1 }]);
  });

  it('persists the merged state, so the saved backup does not lose the resume either', async () => {
    const { result } = await booted();
    await act(async () => { await result.current.updateMemory({ resumeText: 'cv' }); });
    await save(result, () => ({ applications: [{ id: 9 }] }));
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

describe('persistence: ordered, debounced, and never storing the PDF', () => {
  it('persists the new state to user_memory (never undefined)', async () => {
    const { result } = await booted();
    await act(async () => { result.current.updateMemory(m => ({ ...m, resumeText: 'cv' })); });
    await act(async () => { await result.current.flushMemory(); });
    expect(lastBackup()).toMatchObject({ resumeText: 'cv' });
  });

  it('debounces rapid edits into a single backup write', async () => {
    const { result } = await booted();
    vi.useFakeTimers();
    for (let i = 0; i < 20; i++) act(() => { result.current.updateMemory({ resumeData: { draft: i } }); });
    expect(backups()).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(BACKUP_DEBOUNCE_MS + 50); });
    expect(backups()).toHaveLength(1);
    expect(lastBackup().resumeData).toEqual({ draft: 19 });
  });

  it('never writes the PDF or blob URL into the backup, but keeps them in state', async () => {
    const { result } = await booted();
    await save(result, { scanPdfBase64: 'AAAA', originalFileUrl: 'blob:x', resumeText: 'cv' });
    expect(lastBackup()).not.toHaveProperty('scanPdfBase64');
    expect(lastBackup()).not.toHaveProperty('originalFileUrl');
    expect(lastBackup().resumeText).toBe('cv');
    expect(result.current.memory.scanPdfBase64).toBe('AAAA');
  });

  it('still saves the backup when the relational insert fails', async () => {
    sb.insert.mockRejectedValueOnce(new Error('rls'));
    const { result } = await booted();
    await save(result, { x: 1 }, { table: 'resume_scans', data: { a: 1 } });
    expect(sb.insert).toHaveBeenCalledWith('resume_scans', { a: 1, user_id: 'u1' }, 't');
    expect(lastBackup().x).toBe(1);
  });

  it('flushes a pending backup when the component unmounts', async () => {
    const { result, unmount } = await booted();
    act(() => { result.current.updateMemory({ resumeText: 'unsaved' }); });
    expect(backups()).toHaveLength(0);
    unmount();
    await waitFor(() => expect(backups()).toHaveLength(1));
    expect(lastBackup().resumeText).toBe('unsaved');
  });

  it('resolves the returned promise once the relational row is written', async () => {
    const { result } = await booted();
    await act(async () => { await result.current.updateMemory({ a: 1 }, { table: 'mock_sessions', data: { avg_score: 5 } }); });
    expect(sb.insert).toHaveBeenCalledWith('mock_sessions', { avg_score: 5, user_id: 'u1' }, 't');
  });
});

describe('syncError tells the UI when a save fails', () => {
  it('is null at first and after a successful save', async () => {
    const { result } = await booted();
    expect(result.current.syncError).toBeNull();
    await save(result, { a: 1 });
    expect(result.current.syncError).toBeNull();
  });

  it('is set when saving fails, with the reason', async () => {
    const { result } = await booted();
    sb.upsert.mockRejectedValue(new Error('JWT expired'));
    await save(result, { a: 1 });
    expect(result.current.syncError).toMatchObject({ message: 'JWT expired' });
  });

  it('is set when only the relational row fails but the backup saves', async () => {
    const { result } = await booted();
    sb.insert.mockRejectedValue(new Error('insert denied'));
    await save(result, { a: 1 }, { table: 'mock_sessions', data: { avg_score: 5 } });
    expect(result.current.syncError).toMatchObject({ message: 'insert denied' });
    expect(lastBackup().a).toBe(1); // the backup was still written
  });

  it('is a new object on every failure so each one can be announced, and clears after a good save', async () => {
    const { result } = await booted();
    sb.upsert.mockRejectedValue(new Error('down'));
    await save(result, { a: 1 });
    const first = result.current.syncError;
    await save(result, { a: 2 });
    expect(result.current.syncError).not.toBe(first);
    sb.upsert.mockResolvedValue(null);
    await save(result, { a: 3 });
    expect(result.current.syncError).toBeNull();
  });

  it('stays visible after a relational failure until a fully good save', async () => {
    const { result } = await booted();
    sb.insert.mockRejectedValueOnce(new Error('insert denied'));
    await save(result, { a: 1 }, { table: 'mock_sessions', data: { avg_score: 5 } });
    expect(result.current.syncError).not.toBeNull();
    await save(result, { a: 2 });
    expect(result.current.syncError).toBeNull();
  });
});

describe('fails closed when the stored memory cannot be read', () => {
  it('keeps saving locked and reports the error, so nothing is overwritten', async () => {
    sb.select.mockImplementation(async (table) => { if (table === 'user_memory') throw new Error('network down'); return []; });
    const setIsRestoring = vi.fn();
    const setRestoreError = vi.fn();
    const { result } = renderHook(() => useMemory(user, true, setIsRestoring, setRestoreError));
    await waitFor(() => expect(setRestoreError).toHaveBeenCalledWith(true));
    expect(setIsRestoring).not.toHaveBeenCalledWith(false);

    await save(result, { resumeText: 'typed after the failed load' });
    expect(sb.upsert).not.toHaveBeenCalled();
    expect(sb.insert).not.toHaveBeenCalled();
  });

  it('flags an error on a 401 from any table instead of presenting empty data', async () => {
    sb.select.mockRejectedValue(Object.assign(new Error('JWT expired'), { status: 401 }));
    const setRestoreError = vi.fn();
    const { result } = renderHook(() => useMemory(user, true, vi.fn(), setRestoreError));
    await waitFor(() => expect(setRestoreError).toHaveBeenCalledWith(true));
    expect(result.current.memory).toEqual({});
  });

  it('treats a 401 on a non-critical table as fatal too', async () => {
    sb.select.mockImplementation(async (table) => {
      if (table === 'resume_scans') throw Object.assign(new Error('JWT expired'), { status: 401 });
      return [];
    });
    const setRestoreError = vi.fn();
    renderHook(() => useMemory(user, true, vi.fn(), setRestoreError));
    await waitFor(() => expect(setRestoreError).toHaveBeenCalledWith(true));
  });

  it('flags an error when the main backup row cannot be read', async () => {
    sb.select.mockImplementation(async (table) => {
      if (table === 'user_memory') throw Object.assign(new Error('boom'), { status: 500 });
      return [];
    });
    const setRestoreError = vi.fn();
    renderHook(() => useMemory(user, true, vi.fn(), setRestoreError));
    await waitFor(() => expect(setRestoreError).toHaveBeenCalledWith(true));
  });

  it('still starts when only a non-critical table fails to load', async () => {
    sb.select.mockImplementation(async (table) => { if (table === 'resume_scans') throw new Error('table unavailable'); return []; });
    const setIsRestoring = vi.fn();
    const setRestoreError = vi.fn();
    renderHook(() => useMemory(user, true, setIsRestoring, setRestoreError));
    await waitFor(() => expect(setIsRestoring).toHaveBeenCalledWith(false));
    expect(setRestoreError).not.toHaveBeenCalled();
  });

  it('tolerates a failure of a non-critical table and falls back to the backup', async () => {
    sb.select.mockImplementation(async (table) => {
      if (table === 'user_memory') return [{ data: { resumeText: 'cv', starBank: [{ id: 1 }] } }];
      if (table === 'star_stories') throw Object.assign(new Error('missing table'), { status: 404 });
      return [];
    });
    const { result } = await booted();
    expect(result.current.memory.starBank).toEqual([{ id: 1 }]);
    expect(result.current.memory.resumeText).toBe('cv');
  });

  it('keeps the stored memory when it loads fine', async () => {
    sb.select.mockImplementation(async (table) => table === 'user_memory' ? [{ data: { resumeText: 'saved cv' } }] : []);
    const setIsRestoring = vi.fn();
    const { result } = renderHook(() => useMemory(user, true, setIsRestoring, vi.fn()));
    await waitFor(() => expect(setIsRestoring).toHaveBeenCalledWith(false));
    expect(result.current.memory.resumeText).toBe('saved cv');
  });
});

describe('a change made while the stored memory is still loading', () => {
  it('is saved after boot together with the loaded memory, never over it', async () => {
    let release;
    sb.select.mockImplementation((table) => table === 'user_memory'
      ? new Promise(r => { release = () => r([{ data: { starBank: [{ id: 1 }], resumeText: null } }]); })
      : Promise.resolve([]));
    const setIsRestoring = vi.fn();
    const { result } = renderHook(() => useMemory(user, true, setIsRestoring, vi.fn()));
    await waitFor(() => expect(release).toBeTypeOf('function'));

    // e.g. onboarding resume upload finishing before the stored data arrives
    await act(async () => { result.current.updateMemory({ resumeText: 'uploaded during boot' }); });
    expect(backups()).toHaveLength(0); // nothing written while locked

    await act(async () => { release(); });
    await waitFor(() => expect(setIsRestoring).toHaveBeenCalledWith(false));

    expect(result.current.memory).toMatchObject({ resumeText: 'uploaded during boot', starBank: [{ id: 1 }] });
    // The saved backup holds the loaded memory too, not just the in-flight key
    expect(lastBackup()).toMatchObject({ resumeText: 'uploaded during boot', starBank: [{ id: 1 }] });
  });
});

describe('syncedAt lets screens re-read database-computed values', () => {
  it('starts at 0 and changes after each fully successful save', async () => {
    const { result } = await booted();
    expect(result.current.syncedAt).toBe(0);
    await save(result, { a: 1 });
    const first = result.current.syncedAt;
    expect(first).toBeGreaterThan(0);
    await new Promise(r => setTimeout(r, 5));
    await save(result, { a: 2 });
    expect(result.current.syncedAt).toBeGreaterThan(first);
  });

  it('changes only after the relational row is written, so the trigger-computed score can be re-read', async () => {
    const order = [];
    sb.insert.mockImplementation(async () => { order.push('insert'); return []; });
    sb.upsert.mockImplementation(async () => { order.push('backup'); return null; });
    const { result } = await booted();
    await save(result, { mockSessions: [{ avgScore: 80 }] }, { table: 'mock_sessions', data: { avg_score: 80, questions_count: 5, mode: 'startup' } });
    expect(order).toEqual(['insert', 'backup']);
    expect(sb.insert).toHaveBeenCalledWith('mock_sessions', { avg_score: 80, questions_count: 5, mode: 'startup', user_id: 'u1' }, 't');
    expect(result.current.syncedAt).toBeGreaterThan(0);
  });

  it('does not change when the save fails', async () => {
    const { result } = await booted();
    sb.upsert.mockRejectedValue(new Error('down'));
    await save(result, { a: 1 });
    expect(result.current.syncedAt).toBe(0);
  });
});

describe('toBackup', () => {
  it('strips session-only fields without mutating the input', () => {
    const state = { a: 1, scanPdfBase64: 'x', originalFileUrl: 'blob:y' };
    expect(toBackup(state)).toEqual({ a: 1 });
    expect(state).toHaveProperty('scanPdfBase64');
  });
});
