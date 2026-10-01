import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({
  sb: {
    select: vi.fn(async () => []),
    upsert: vi.fn(async () => null),
    insert: vi.fn(async () => []),
  },
}));

import { sb } from '../lib/supabase';
import { useMemory } from './useMemory';

const user = { id: 'u1', email: 'a@b.c', token: 't' };

async function bootedHook() {
  const setIsRestoring = vi.fn();
  const hook = renderHook(() => useMemory(user, true, setIsRestoring, vi.fn()));
  await waitFor(() => expect(setIsRestoring).toHaveBeenCalledWith(false));
  return hook;
}

beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, 'log').mockImplementation(() => {}); });

describe('useMemory.updateMemory', () => {
  it('merges object updates into existing memory', async () => {
    const { result } = await bootedHook();
    await act(async () => { await result.current.updateMemory({ resumeText: 'cv' }); });
    await act(async () => { await result.current.updateMemory({ scanResult: { s: 1 } }); });
    expect(result.current.memory).toMatchObject({ resumeText: 'cv', scanResult: { s: 1 } });
  });

  // Known defect (audit 2.2): nextState is read right after setMemory, but React runs the
  // updater lazily, so user_memory is upserted with `data: undefined`. Confirmed by this test.
  it.fails('persists the new state to user_memory', async () => {
    const { result } = await bootedHook();
    await act(async () => { await result.current.updateMemory(m => ({ ...m, resumeText: 'cv' })); });
    const payload = sb.upsert.mock.calls.at(-1)[1];
    expect(payload.data).toMatchObject({ resumeText: 'cv' });
  });

  // Known defect (audit 1.1): callers like JobSearch/STARBuilder/JDAnalyzer return only
  // their own key from the updater, and updateMemory replaces state with that result.
  // Flip to a normal `it` once updateMemory merges.
  it.fails('keeps unrelated memory when an updater returns only its own key', async () => {
    const { result } = await bootedHook();
    await act(async () => { await result.current.updateMemory({ resumeText: 'cv', scanResult: { s: 1 } }); });
    await act(async () => { await result.current.updateMemory(() => ({ applications: [{ id: 1 }] })); });
    expect(result.current.memory.resumeText).toBe('cv');
    expect(result.current.memory.scanResult).toEqual({ s: 1 });
  });
});
