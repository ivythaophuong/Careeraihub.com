// Saving and deleting keep the list on screen true to the database (findings F3 and F4 of docs/audits/STAR-BUILDER-AUDIT-2026-10-12.md).
// A story is identified by its database row id; the server returns it on save, and entries loaded from the database already carry it.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({ callLLM: vi.fn(), extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } } }));
vi.mock('../../lib/serverScoring', () => ({ serverScoringOn: () => true, reviewStarOnServer: vi.fn(), saveStarOnServer: vi.fn() }));
vi.mock('../CoverLetterGen/coverLetter', () => ({ copyToClipboard: vi.fn().mockResolvedValue(true) }));
vi.mock('../../lib/supabase', async (orig) => ({ ...(await orig()), sb: { delete: vi.fn().mockResolvedValue(undefined) } }));
import { sb } from '../../lib/supabase';
import { reviewStarOnServer, saveStarOnServer } from '../../lib/serverScoring';
import { normalizeStarResult } from './star';
import STARBuilder from './STARBuilder';

const IN = {
  Situation: 'Our checkout team had to migrate platforms while 2 million users shopped daily.',
  Task: 'I owned the migration plan and had to avoid downtime.',
  Action: 'I set up blue-green deployments and wrote rollback scripts.',
  Result: 'We finished with no downtime and conversion rose 15 percent.',
};
const RAW = {
  scores: { situation: 60, task: 70, action: 80, result: 50 },
  refined: { situation: 'I led checkout during a platform migration for 2M daily users.', task: 'I owned the plan to avoid downtime.', action: 'I built blue-green deployments and rollback scripts.', result: 'We finished with no downtime and conversion rose 15 percent.' },
  oneLiner: 'Led a zero-downtime checkout migration for 2M users.', feedback: ['x'], missingDetails: [], competencies: ['ownership'],
};

beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(cleanup);

const fill = () => Object.entries(IN).forEach(([k, v]) => fireEvent.change(screen.getByLabelText(k), { target: { value: v } }));

const reviewAndSave = async (memory, reply) => {
  reviewStarOnServer.mockResolvedValue({ result: normalizeStarResult(RAW), receipt: { ts: 1, sig: 's' } });
  saveStarOnServer.mockResolvedValue(reply);
  const updateMemory = vi.fn();
  render(<STARBuilder memory={memory} updateMemory={updateMemory} setAuthModal={vi.fn()} user={{ id: 'u1', token: 't' }} />);
  fill();
  fireEvent.click(screen.getByText(/Refine My Story/));
  fireEvent.click(await screen.findByRole('button', { name: /save|bank/i }));
  await waitFor(() => expect(updateMemory).toHaveBeenCalled());
  return { updateMemory, apply: (list) => updateMemory.mock.calls[0][0]({ starBank: list }).starBank };
};
const EXISTING = { id: 1, score: 62, oneLiner: RAW.oneLiner, situation: IN.Situation, date: '2026-10-01T00:00:00Z' };

describe('saving a story the server already has', () => {
  it('does not add a second copy to the list on screen when the server says it is a duplicate', async () => {
    const { apply } = await reviewAndSave({ starBank: [EXISTING] }, { saved: true, id: 'row-1', score: 62, duplicate: true });
    expect(apply([EXISTING])).toHaveLength(1);
  });

  it('gives the copy already on screen the database id, so a later delete is exact', async () => {
    const { apply } = await reviewAndSave({ starBank: [EXISTING] }, { saved: true, id: 'row-1', score: 62, duplicate: true });
    expect(apply([EXISTING])[0]).toMatchObject({ id: 1, dbId: 'row-1' });
  });

  it('a duplicate the screen does not have yet (older than the list kept, or from another session) is added once, with its database id', async () => {
    const { apply } = await reviewAndSave({ starBank: [] }, { saved: true, id: 'row-1', score: 62, duplicate: true });
    const after = apply([]);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ dbId: 'row-1', score: 62 });
  });

  it('tells the user it was already saved, and the Save button shows saved', async () => {
    await reviewAndSave({ starBank: [EXISTING] }, { saved: true, id: 'row-1', score: 62, duplicate: true });
    expect(await screen.findByText(/already saved/i)).toBeTruthy();
  });

  it('a new story is added once and carries the database id the server returned', async () => {
    const { apply } = await reviewAndSave({ starBank: [] }, { saved: true, id: 'row-2', score: 60 });
    const after = apply([EXISTING]);
    expect(after).toHaveLength(2);
    expect(after[0]).toMatchObject({ dbId: 'row-2', id: 'row-2', score: 60 });
    expect(screen.queryByText(/already saved/i)).toBeNull();
  });
});

describe('deleting a story', () => {
  const del = (bank, title = 'Led a migration', nth = 0) => {
    const updateMemory = vi.fn();
    render(<STARBuilder memory={{ starBank: bank }} updateMemory={updateMemory} setAuthModal={vi.fn()} user={{ id: 'u1', token: 't' }} />);
    fireEvent.click(screen.getAllByText(title)[nth]);
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Confirm delete'));
    return updateMemory;
  };
  const A = { id: 7, dbId: 'row-A', score: 82, oneLiner: 'Led a migration', situation: 'Situation A', date: '2026-01-02T00:00:00Z', refined: RAW.refined };
  const B = { id: 8, dbId: 'row-B', score: 55, oneLiner: 'Led a migration', situation: 'Situation B', date: '2026-01-01T00:00:00Z', refined: RAW.refined };

  it('deletes by the database id: two stories with the same one-line summary do not both go', () => {
    const updateMemory = del([A, B]);
    expect(sb.delete).toHaveBeenCalledTimes(1);
    expect(sb.delete).toHaveBeenCalledWith('star_stories', { user_id: 'eq.u1', id: 'eq.row-A' }, 't');
    expect(updateMemory.mock.calls[0][0]({ starBank: [A, B] }).starBank).toEqual([B]);
  });

  it('a story loaded from the database (it has user_id and the row id as its id) is deleted by that id', () => {
    del([{ id: 'row-C', user_id: 'u1', score: 70, oneLiner: 'Fixed an outage', date: '2026-01-02T00:00:00Z', refined: RAW.refined }], 'Fixed an outage');
    expect(sb.delete).toHaveBeenCalledWith('star_stories', { user_id: 'eq.u1', id: 'eq.row-C' }, 't');
  });

  it('an older story kept only on screen, with no database id, is matched on its one-line summary AND its situation, never on the summary alone when it has a situation', () => {
    del([{ id: 99, score: 60, oneLiner: 'Led a migration', situation: 'Situation A', date: '2026-01-02T00:00:00Z', refined: RAW.refined }]);
    expect(sb.delete).toHaveBeenCalledWith('star_stories', { user_id: 'eq.u1', one_liner: 'eq.Led a migration', situation: 'eq.Situation A' }, 't');
  });

  it('an entry with no situation at all falls back to the one-line summary only (nothing else to match on)', () => {
    del([{ id: 99, score: 60, oneLiner: 'Led a migration', date: '2026-01-02T00:00:00Z', refined: RAW.refined }]);
    expect(sb.delete).toHaveBeenCalledWith('star_stories', { user_id: 'eq.u1', one_liner: 'eq.Led a migration' }, 't');
  });

  it('only the chosen story leaves the list, and the other keeps its database id for its own delete', () => {
    const updateMemory = del([A, B], 'Led a migration', 1);
    expect(sb.delete).toHaveBeenCalledWith('star_stories', { user_id: 'eq.u1', id: 'eq.row-B' }, 't');
    expect(updateMemory.mock.calls[0][0]({ starBank: [A, B] }).starBank).toEqual([A]);
  });
});
