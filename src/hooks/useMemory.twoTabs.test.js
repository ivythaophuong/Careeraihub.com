// @vitest-environment jsdom
// Two browser tabs of the same user. Each tab loads the stored memory once and later writes its whole in-memory copy back (useMemory.writeBackup),
// with no check that the stored copy changed in between. This file pins down that a stale tab cannot erase what another tab saved.
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

  // A field with no table of its own is kept only in the user_memory blob. The write reads the stored blob first and overwrites only the keys this tab changed.
  it('a field kept only in the backup blob, saved by one tab, survives the other tab saving last', async () => {
    const a = await openTab();
    const b = await openTab();
    await save(b, () => ({ resumeData: { personalInfo: { fullName: 'Ann Lee' } } }));
    await save(a, () => ({ targetRole: 'PM' }));
    const c = await openTab();
    expect(c.result.current.memory.resumeData).toEqual({ personalInfo: { fullName: 'Ann Lee' } });
  });

  it('a failed write keeps the changed keys, so the next save still carries them', async () => {
    const a = await openTab();
    sb.upsert.mockRejectedValueOnce(new Error('network down'));
    await save(a, () => ({ resumeData: { personalInfo: { fullName: 'Ann Lee' } } }));
    expect(store.user_memory).toEqual([]);
    await save(a, () => ({ targetRole: 'PM' }));
    const c = await openTab();
    expect(c.result.current.memory.resumeData).toEqual({ personalInfo: { fullName: 'Ann Lee' } });
  });

  it('when the stored copy cannot be read, nothing is written over it', async () => {
    const a = await openTab();
    await save(a, () => ({ targetRole: 'PM' }));
    const before = JSON.stringify(store.user_memory);
    const reads = sb.select.getMockImplementation();
    sb.select.mockImplementation(async (table, ...rest) => { if (table === 'user_memory') throw new Error('read failed'); return reads(table, ...rest); });
    await save(a, () => ({ targetRole: 'Designer' }));
    expect(JSON.stringify(store.user_memory)).toBe(before);
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

describe('what counts as a change made by this tab', () => {
  it('a caller that returns the whole memory spread ({ ...m, key }) only changes that key', async () => {
    // AICoach, VerifyCreds and others write like this: updateMemory(m => ({ ...m, credentials: [...] })). Both tabs already hold an older aiChat.
    store.user_memory = [{ user_id: 'u1', data: { aiChat: [{ role: 'user', content: 'old', ts: 0 }] } }];
    const a = await openTab();
    const b = await openTab();
    await save(b, () => ({ aiChat: [{ role: 'user', content: 'new', ts: 1 }] }));
    await save(a, (m) => ({ ...m, credentials: [{ id: 'c1' }] }));
    const c = await openTab();
    expect(c.result.current.memory.aiChat).toEqual([{ role: 'user', content: 'new', ts: 1 }]);
    expect(c.result.current.memory.credentials).toEqual([{ id: 'c1' }]);
  });

  it('clearing a key on purpose (empty list, null, 0) is saved, not mistaken for "unchanged"', async () => {
    const a = await openTab();
    await save(a, () => ({ aiChat: [{ role: 'user', content: 'hi', ts: 1 }], profile: { x: 1 }, totalSessions: 5 }));
    const b = await openTab();
    await save(b, (m) => ({ ...m, aiChat: [], profile: null, totalSessions: 0 }));
    const c = await openTab();
    expect(c.result.current.memory).toMatchObject({ aiChat: [], profile: null, totalSessions: 0 });
  });

  it('two tabs changing the same key: the later save wins as a whole value (no deep merge)', async () => {
    const a = await openTab();
    const b = await openTab();
    await save(b, () => ({ credentials: [{ id: 'from-b' }] }));
    await save(a, () => ({ credentials: [{ id: 'from-a' }] }));
    const c = await openTab();
    expect(c.result.current.memory.credentials).toEqual([{ id: 'from-a' }]); // known limit: not a merge of the two lists
  });

  it('a change made while a save is in flight is kept for the next save', async () => {
    const a = await openTab();
    let releaseUpsert;
    const real = sb.upsert.getMockImplementation();
    sb.upsert.mockImplementationOnce(async (...args) => { await new Promise(r => { releaseUpsert = r; }); return real(...args); });
    let first;
    await act(async () => { a.result.current.updateMemory(() => ({ credentials: [{ id: 'c1' }] })); first = a.result.current.flushMemory(); });
    await waitFor(() => expect(releaseUpsert).toBeTypeOf('function'));
    await act(async () => { a.result.current.updateMemory(() => ({ targetRole: 'PM' })); });
    await act(async () => { releaseUpsert(); await first; await a.result.current.flushMemory(); });
    const c = await openTab();
    expect(c.result.current.memory).toMatchObject({ credentials: [{ id: 'c1' }], targetRole: 'PM' });
  });
});
