// @vitest-environment jsdom
// Two browser tabs of the same user. Each tab loads the stored memory once and later writes its whole in-memory copy back (useMemory.writeBackup),
// with no check that the stored copy changed in between. This file pins down what that does and does not lose.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({
  sb: { select: vi.fn(), upsert: vi.fn(), insert: vi.fn() },
}));
import { sb } from '../lib/supabase';
import { useMemory } from './useMemory';

const user = { id: 'u1', email: 'a@b.c', token: 't' };
let store;

async function openTab() {
  const setIsRestoring = vi.fn();
  const hook = renderHook(() => useMemory(user, true, setIsRestoring, vi.fn()));
  await waitFor(() => expect(setIsRestoring).toHaveBeenCalledWith(false));
  return hook;
}
const save = async (tab, ...args) => {
  await act(async () => { await tab.result.current.updateMemory(...args); await tab.result.current.flushMemory(); });
};

beforeEach(() => {
  store = { user_memory: [], star_stories: [] };
  vi.clearAllMocks();
  sb.select.mockImplementation(async (table) => JSON.parse(JSON.stringify(store[table] || [])));
  sb.upsert.mockImplementation(async (table, row) => { if (table === 'user_memory') store.user_memory = [{ user_id: row.user_id, data: JSON.parse(JSON.stringify(row.data)) }]; return null; });
  sb.insert.mockImplementation(async (table, row) => { (store[table] ||= []).push({ ...row, id: store[table].length + 1, created_at: new Date().toISOString() }); return []; });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); });

describe('two tabs of the same user', () => {
  it('a row saved to its own table by one tab is still there after the other tab saves last', async () => {
    const a = await openTab();
    const b = await openTab();
    await save(b, () => ({ starBank: [{ oneLiner: 'Cut checkout time' }] }), { table: 'star_stories', data: { one_liner: 'Cut checkout time' } });
    await save(a, () => ({ targetRole: 'PM' }));
    const c = await openTab(); // a fresh tab reads what is stored
    expect(c.result.current.memory.starBank.map(s => s.oneLiner)).toEqual(['Cut checkout time']);
  });

  // KNOWN GAP (not fixed here): a field that has no table of its own is kept only in the user_memory blob, and the stale tab writes the blob last,
  // without the field the other tab saved. Turn this into a plain `it` when the write checks the stored copy (merge on write or a version check).
  it.fails('a field kept only in the backup blob, saved by one tab, survives the other tab saving last', async () => {
    const a = await openTab();
    const b = await openTab();
    await save(b, () => ({ resumeData: { personalInfo: { fullName: 'Ann Lee' } } }));
    await save(a, () => ({ targetRole: 'PM' }));
    const c = await openTab();
    expect(c.result.current.memory.resumeData).toEqual({ personalInfo: { fullName: 'Ann Lee' } });
  });

  it('one tab on its own never loses a field it saved earlier', async () => {
    const a = await openTab();
    await save(a, () => ({ resumeData: { personalInfo: { fullName: 'Ann Lee' } } }));
    await save(a, () => ({ targetRole: 'PM' }));
    const c = await openTab();
    expect(c.result.current.memory.resumeData).toEqual({ personalInfo: { fullName: 'Ann Lee' } });
    expect(c.result.current.memory.targetRole).toBe('PM');
  });
});
