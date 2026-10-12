// Specification found by the STAR Builder audit (docs/audits/STAR-BUILDER-AUDIT-2026-10-12.md). Each `it.fails` is a behaviour that is
// needed and not met yet; turn it into a normal `it` in the change that fixes it. The audit changes no behaviour.
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

describe('saving a story the server already has', () => {
  it.fails('does not add a second copy to the list on screen when the server says it is a duplicate (the count would be inflated until a reload)', async () => {
    reviewStarOnServer.mockResolvedValue({ result: normalizeStarResult(RAW), receipt: { ts: 1, sig: 's' } });
    saveStarOnServer.mockResolvedValue({ saved: true, id: 'row-1', score: 62, duplicate: true });
    const existing = { id: 1, score: 62, oneLiner: RAW.oneLiner, situation: IN.Situation, date: '2026-10-01T00:00:00Z' };
    const updateMemory = vi.fn();
    render(<STARBuilder memory={{ starBank: [existing] }} updateMemory={updateMemory} setAuthModal={vi.fn()} user={{ id: 'u1', token: 't' }} />);
    fill();
    fireEvent.click(screen.getByText(/Refine My Story/));
    fireEvent.click(await screen.findByRole('button', { name: /save|bank/i }));
    await waitFor(() => expect(updateMemory).toHaveBeenCalled());
    const after = updateMemory.mock.calls[0][0]({ starBank: [existing] }).starBank;
    expect(after).toHaveLength(1);
  });
});

describe('deleting a story', () => {
  it.fails('deletes only the story the user chose: two stories with the same one-line summary but different situations must not both go', () => {
    const a = { id: 7, score: 82, oneLiner: 'Led a migration', situation: 'Situation A', date: '2026-01-02T00:00:00Z', refined: RAW.refined };
    const b = { id: 8, score: 55, oneLiner: 'Led a migration', situation: 'Situation B', date: '2026-01-01T00:00:00Z', refined: RAW.refined };
    render(<STARBuilder memory={{ starBank: [a, b] }} updateMemory={vi.fn()} setAuthModal={vi.fn()} user={{ id: 'u1', token: 't' }} />);
    fireEvent.click(screen.getAllByText('Led a migration')[0]);
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Confirm delete'));
    const filter = sb.delete.mock.calls[0][1];
    expect(filter).toMatchObject({ user_id: 'eq.u1', one_liner: 'eq.Led a migration' });
    expect(filter.situation).toBe('eq.Situation A');
  });
});
