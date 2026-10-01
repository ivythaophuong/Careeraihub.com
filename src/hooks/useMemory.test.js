import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({
  sb: {
    select: vi.fn(async () => []),
    upsert: vi.fn(async () => null),
    insert: vi.fn(async () => []),
  },
}));

import { sb } from '../lib/supabase';
import { useMemory, toBackup, BACKUP_DEBOUNCE_MS } from './useMemory';

const user = { id: 'u1', email: 'a@b.c', token: 't' };

async function bootedHook() {
  const setIsRestoring = vi.fn();
  const hook = renderHook(() => useMemory(user, true, setIsRestoring, vi.fn()));
  await waitFor(() => expect(setIsRestoring).toHaveBeenCalledWith(false));
  return hook;
}

const backups = () => sb.upsert.mock.calls.filter(c => c[0] === 'user_memory');
const lastBackup = () => backups().at(-1)[1];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('useMemory.updateMemory — merging (audit 1.1)', () => {
  it('merges object updates into existing memory', async () => {
    const { result } = await bootedHook();
    await act(async () => { result.current.updateMemory({ resumeText: 'cv' }); });
    await act(async () => { result.current.updateMemory({ scanResult: { s: 1 } }); });
    expect(result.current.memory).toMatchObject({ resumeText: 'cv', scanResult: { s: 1 } });
  });

  it('keeps unrelated memory when an updater returns only its own key', async () => {
    const { result } = await bootedHook();
    await act(async () => { result.current.updateMemory({ resumeText: 'cv', scanResult: { s: 1 } }); });
    await act(async () => { result.current.updateMemory(() => ({ applications: [{ id: 1 }] })); });
    expect(result.current.memory.resumeText).toBe('cv');
    expect(result.current.memory.scanResult).toEqual({ s: 1 });
    expect(result.current.memory.applications).toEqual([{ id: 1 }]);
  });

  it('gives updaters the latest state even for back-to-back updates in one tick', async () => {
    const { result } = await bootedHook();
    await act(async () => {
      result.current.updateMemory(m => ({ n: (m.n || 0) + 1 }));
      result.current.updateMemory(m => ({ n: (m.n || 0) + 1 }));
      result.current.updateMemory(m => ({ n: (m.n || 0) + 1 }));
    });
    expect(result.current.memory.n).toBe(3);
  });
});

describe('useMemory.updateMemory — persistence (audit 2.2 / 2.3)', () => {
  it('persists the new state to user_memory (never undefined)', async () => {
    const { result } = await bootedHook();
    await act(async () => { result.current.updateMemory(m => ({ ...m, resumeText: 'cv' })); });
    await act(async () => { await result.current.flushMemory(); });
    expect(lastBackup().data).toMatchObject({ resumeText: 'cv' });
  });

  it('debounces rapid edits into a single backup write', async () => {
    const { result } = await bootedHook();
    vi.useFakeTimers();
    for (let i = 0; i < 20; i++) act(() => { result.current.updateMemory({ resumeData: { draft: i } }); });
    expect(backups()).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(BACKUP_DEBOUNCE_MS + 50); });
    expect(backups()).toHaveLength(1);
    expect(lastBackup().data.resumeData).toEqual({ draft: 19 });
  });

  it('never writes the PDF or blob URL into the backup, but keeps them in state', async () => {
    const { result } = await bootedHook();
    await act(async () => {
      result.current.updateMemory({ scanPdfBase64: 'AAAA', originalFileUrl: 'blob:x', resumeText: 'cv' });
      await result.current.flushMemory();
    });
    expect(lastBackup().data).not.toHaveProperty('scanPdfBase64');
    expect(lastBackup().data).not.toHaveProperty('originalFileUrl');
    expect(lastBackup().data.resumeText).toBe('cv');
    expect(result.current.memory.scanPdfBase64).toBe('AAAA');
  });

  it('still saves the backup when the relational insert fails', async () => {
    sb.insert.mockRejectedValueOnce(new Error('rls'));
    const { result } = await bootedHook();
    await act(async () => {
      result.current.updateMemory({ x: 1 }, { table: 'resume_scans', data: { a: 1 } });
      await result.current.flushMemory();
    });
    expect(sb.insert).toHaveBeenCalledWith('resume_scans', { a: 1, user_id: 'u1' }, 't');
    expect(lastBackup().data.x).toBe(1);
  });

  it('flushes a pending backup when the component unmounts', async () => {
    const { result, unmount } = await bootedHook();
    act(() => { result.current.updateMemory({ resumeText: 'unsaved' }); });
    expect(backups()).toHaveLength(0);
    unmount();
    await waitFor(() => expect(backups()).toHaveLength(1));
    expect(lastBackup().data.resumeText).toBe('unsaved');
  });
});

describe('toBackup', () => {
  it('strips session-only fields without mutating the input', () => {
    const state = { a: 1, scanPdfBase64: 'x', originalFileUrl: 'blob:y' };
    expect(toBackup(state)).toEqual({ a: 1 });
    expect(state).toHaveProperty('scanPdfBase64');
  });
});
