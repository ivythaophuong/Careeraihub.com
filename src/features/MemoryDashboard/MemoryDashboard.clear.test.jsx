// @vitest-environment jsdom
// "Clear All Memory" must say what actually happened: every delete finished, some failed, or the account was not reached (decision E1c).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({ callLLM: vi.fn(), extractJSON: () => ({}) }));
vi.mock('../../lib/aiFeature.js', () => ({ callLLMFor: () => vi.fn() }));
vi.mock('../../lib/supabase', async (orig) => ({ ...(await orig()), sb: { delete: vi.fn() } }));
import { sb } from '../../lib/supabase';
import MemoryDashboard from './MemoryDashboard';

const form = { role: 'PM', level: '', industry: 'Fintech', market: 'Singapore' };
const draw = (user = { id: 'u1', token: 't' }) => {
  const updateMemory = vi.fn();
  render(<MemoryDashboard memory={{ mockSessions: [], starBank: [] }} form={form} user={user} updateMemory={updateMemory} />);
  return updateMemory;
};
const press = () => fireEvent.click(screen.getByRole('button', { name: /Clear All Memory/i }));

beforeEach(() => { sb.delete.mockReset(); });
afterEach(cleanup);

describe('Clear All Memory reports the real outcome', () => {
  it('says nothing about success until every delete has settled', async () => {
    const releases = [];
    sb.delete.mockImplementation(() => new Promise(res => { releases.push(res); }));
    draw();
    press();
    expect(screen.queryByText(/Memory cleared|Fresh start|deleted|could not be deleted/i)).toBeNull();
    releases.forEach(r => r(null));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/deleted/i));
  });

  it('reports completion when every table delete succeeded, without a failure message', async () => {
    sb.delete.mockResolvedValue(null);
    draw();
    press();
    const box = await screen.findByRole('status');
    expect(box.textContent).toMatch(/deleted/i);
    expect(box.textContent).not.toMatch(/could not be deleted|may still contain/i);
    expect(box.textContent).not.toMatch(/Fresh start/i);
    expect(sb.delete).toHaveBeenCalledTimes(8);
  });

  it('reports an incomplete clear, names the failed table and does not claim success', async () => {
    sb.delete.mockImplementation(async (table) => { if (table === 'mock_sessions') throw new Error('Database delete failed.'); return null; });
    draw();
    press();
    const box = await screen.findByRole('alert');
    expect(box.textContent).toContain('Some data could not be deleted yet.');
    expect(box.textContent).toMatch(/may still contain information you asked to delete/i);
    expect(box.textContent).toMatch(/mock sessions/i);
    expect(box.textContent).toMatch(/try again or contact support/i);
    expect(screen.queryByText(/✓/)).toBeNull();
    expect(screen.queryByText(/Fresh start/i)).toBeNull();
  });

  it('does not claim an account deletion when there is no signed-in session to delete with', async () => {
    const updateMemory = draw({ id: null, token: null });
    press();
    const box = await screen.findByRole('status');
    expect(box.textContent).toMatch(/could not confirm|not confirmed/i);
    expect(box.textContent).not.toMatch(/were deleted|Fresh start/i);
    expect(sb.delete).not.toHaveBeenCalled();
    expect(updateMemory).toHaveBeenCalled(); // the in-app memory is still emptied
  });
});
