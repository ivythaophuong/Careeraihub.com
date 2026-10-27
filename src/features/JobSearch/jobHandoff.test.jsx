import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { buildActiveJob, isFreshJob, useActiveJob, HANDOFF_MAX_AGE_MS, requestTrackerTab, peekRequestedTab, clearRequestedTab } from './jobHandoff';

describe('buildActiveJob', () => {
  it('carries the job and caps the description', () => {
    const j = buildActiveJob({ id: 7, company: 'A', role: 'PM', jd: 'x'.repeat(9000) }, 1000);
    expect(j).toMatchObject({ appId: 7, company: 'A', role: 'PM', ts: 1000 });
    expect(j.jd).toHaveLength(6000);
  });
});

describe('isFreshJob', () => {
  it('ignores a missing, malformed or old hand-over', () => {
    const now = 10_000_000;
    expect(isFreshJob(null, now)).toBe(false);
    expect(isFreshJob({ ts: 'x' }, now)).toBe(false);
    expect(isFreshJob({ ts: now - HANDOFF_MAX_AGE_MS - 1 }, now)).toBe(false);
    expect(isFreshJob({ ts: now - 1000 }, now)).toBe(true);
  });
});

describe('useActiveJob', () => {
  it('returns the job once and clears it from memory', () => {
    const updateMemory = vi.fn();
    const job = { appId: 1, company: 'A', role: 'PM', jd: '', ts: Date.now() };
    const { result } = renderHook(() => useActiveJob({ activeJob: job }, updateMemory));
    expect(result.current).toEqual(job);
    expect(updateMemory).toHaveBeenCalledWith({ activeJob: null });
  });
  it('does nothing without a job, and survives a missing updateMemory', () => {
    const updateMemory = vi.fn();
    expect(renderHook(() => useActiveJob({}, updateMemory)).result.current).toBeNull();
    expect(updateMemory).not.toHaveBeenCalled();
    expect(() => renderHook(() => useActiveJob({ activeJob: { ts: Date.now() } }, undefined))).not.toThrow();
  });
  it('ignores a stale job but still clears it', () => {
    const updateMemory = vi.fn();
    const { result } = renderHook(() => useActiveJob({ activeJob: { company: 'Old', ts: Date.now() - HANDOFF_MAX_AGE_MS - 5 } }, updateMemory));
    expect(result.current).toBeNull();
    expect(updateMemory).toHaveBeenCalledWith({ activeJob: null });
  });
});

describe('tracker tab request', () => {
  it('is read without being consumed, then cleared', () => {
    clearRequestedTab();
    expect(peekRequestedTab()).toBeNull();
    requestTrackerTab();
    expect(peekRequestedTab()).toBe('tracker');
    expect(peekRequestedTab()).toBe('tracker');
    clearRequestedTab();
    expect(peekRequestedTab()).toBeNull();
  });
});
