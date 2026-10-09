import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({
  callLLM: vi.fn(),
  extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } },
}));
vi.mock('../../lib/serverScoring', () => ({ serverScoringOn: () => globalThis.__serverScoring === true, reviewStarOnServer: vi.fn(), saveStarOnServer: vi.fn() }));
vi.mock('../CoverLetterGen/coverLetter', () => ({ copyToClipboard: vi.fn().mockResolvedValue(true) }));
vi.mock('../../lib/supabase', async (orig) => ({ ...(await orig()), sb: { delete: vi.fn().mockResolvedValue(undefined) } }));
import { sb } from '../../lib/supabase';
import { callLLM } from '../../lib/ai.jsx';
import { reviewStarOnServer, saveStarOnServer } from '../../lib/serverScoring';
import { copyToClipboard } from '../CoverLetterGen/coverLetter';
import STARBuilder from './STARBuilder';

const IN = {
  Situation: 'Our checkout team had to migrate platforms while 2 million users shopped daily.',
  Task: 'I owned the migration plan and had to avoid downtime.',
  Action: 'I set up blue-green deployments and wrote rollback scripts.',
  Result: 'We finished with no downtime and conversion rose 15 percent.',
};
const REPLY = {
  scores: { situation: 60, task: 70, action: 80, result: 50 },
  refined: { situation: 'I led checkout during a platform migration for 2M daily users.', task: 'I owned the plan to avoid downtime.', action: 'I built blue-green deployments and rollback scripts.', result: 'We had no downtime and conversion rose 15%.' },
  oneLiner: 'Led a zero-downtime checkout migration for 2M users.',
  feedback: ['Say how many people worked on it'], missingDetails: ['What was the baseline conversion?'], competencies: ['ownership'],
};

const setup = (props = {}) => {
  const p = { memory: {}, updateMemory: vi.fn(), setAuthModal: vi.fn(), ...props };
  render(<STARBuilder {...p} />);
  return p;
};
const fill = (over = {}) => Object.entries({ ...IN, ...over }).forEach(([k, v]) => fireEvent.change(screen.getByLabelText(k), { target: { value: v } }));
const refine = () => fireEvent.click(screen.getByText(/Refine My Story/));

beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); copyToClipboard.mockResolvedValue(true); });
afterEach(cleanup);

describe('STARBuilder', () => {
  it('shows no Preview banner and no result before the user acts', () => {
    setup();
    expect(screen.queryByText(/Preview/)).toBeNull();
    expect(screen.queryByText(/Refined STAR Output/)).toBeNull();
  });

  it('asks for more detail on short sections without calling the AI', () => {
    setup();
    fill({ Action: 'did it' });
    refine();
    expect(screen.getByRole('alert').textContent).toMatch(/Action/);
    expect(callLLM).not.toHaveBeenCalled();
  });

  it('sends what the user wrote and renders the real review, score and feedback', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    setup(); fill(); refine();
    await screen.findByText(/Refined STAR Output/);
    const prompt = callLLM.mock.calls[0][0][0].content;
    for (const v of Object.values(IN)) expect(prompt).toContain(v);
    expect(screen.getByLabelText('Overall score').textContent).toContain('67');
    expect(screen.getByText('"Led a zero-downtime checkout migration for 2M users."')).toBeTruthy();
    expect(screen.getByText('• Say how many people worked on it')).toBeTruthy();
    expect(screen.getByText('• What was the baseline conversion?')).toBeTruthy();
    expect(screen.queryByText(/Check these numbers/)).toBeNull(); // 2M and 15% both came from the user
  });

  it('warns when the AI added numbers the user never wrote', async () => {
    callLLM.mockResolvedValue(JSON.stringify({ ...REPLY, refined: { ...REPLY.refined, result: 'Conversion rose 15% and revenue grew 40%.' } }));
    setup(); fill(); refine();
    const warn = await screen.findByText(/Check these numbers before you use this story/);
    expect(warn.closest('div').parentElement.textContent).toContain('40%');
    expect(screen.getByText(/not in what you wrote/).textContent).not.toContain('15%');
  });

  it('does not bank anything automatically; saving is an explicit action', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    const p = setup(); fill(); refine();
    await screen.findByText(/Refined STAR Output/);
    expect(p.updateMemory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(/Save to Story Bank/));
    expect(p.updateMemory).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Saved ✓')).toBeTruthy();
    fireEvent.click(screen.getByText('Saved ✓')); // second click is a no-op
    expect(p.updateMemory).toHaveBeenCalledTimes(1);
  });

  it('banks the real story, newest first, capped at 30, keeping the user\'s original', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    const p = setup(); fill(); refine();
    await screen.findByText(/Refined STAR Output/);
    fireEvent.click(screen.getByText(/Save to Story Bank/));
    const next = p.updateMemory.mock.calls[0][0]({ starBank: Array.from({ length: 40 }, (_, i) => ({ id: i })) });
    expect(next.starBank).toHaveLength(30);
    expect(next.starBank[0]).toMatchObject({ score: 67, oneLiner: REPLY.oneLiner, refined: REPLY.refined, original: { situation: IN.Situation, task: IN.Task, action: IN.Action, result: IN.Result }, situation: IN.Situation });
    expect(next.starBank[1].id).toBe(0);
    expect(Object.keys(next)).toEqual(['starBank']);
  });

  it('banks the input that was analysed, even if the user edits the boxes afterwards', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    const p = setup(); fill(); refine();
    await screen.findByText(/Refined STAR Output/);
    fireEvent.change(screen.getByLabelText('Result'), { target: { value: 'Something completely different now.' } });
    fireEvent.click(screen.getByText(/Save to Story Bank/));
    expect(p.updateMemory.mock.calls[0][0]({}).starBank[0].original.result).toBe(IN.Result);
  });

  it('copies the refined story', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    setup(); fill(); refine();
    await screen.findByText(/Refined STAR Output/);
    fireEvent.click(screen.getByText('Copy Story'));
    await screen.findByText('Copied ✓');
    expect(copyToClipboard.mock.calls[0][0]).toContain('Situation: I led checkout');
  });

  it('shows an error and keeps nothing when the reply is unusable', async () => {
    callLLM.mockResolvedValue('no json here');
    const p = setup(); fill(); refine();
    expect((await screen.findByRole('alert')).textContent).toMatch(/unreadable review/);
    expect(screen.queryByText(/Refined STAR Output/)).toBeNull();
    expect(p.updateMemory).not.toHaveBeenCalled();
  });

  it('opens sign-up for guests (401)', async () => {
    callLLM.mockRejectedValue(Object.assign(new Error('Please sign in'), { status: 401 }));
    const p = setup(); fill(); refine();
    await waitFor(() => expect(p.setAuthModal).toHaveBeenCalledWith('register'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Create a free account/);
  });
});

describe('star_stories row (hotfix persistence, written when the story is banked)', () => {
  it('writes the row with the computed score and the original wording, only on Save', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    const p = setup(); fill(); refine();
    await screen.findByText(/Refined STAR Output/);
    expect(p.updateMemory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(/Save to Story Bank/));
    const rel = p.updateMemory.mock.calls[0][1];
    expect(rel.table).toBe('star_stories');
    expect(rel.data).toMatchObject({
      one_liner: REPLY.oneLiner,
      score: Math.round(60 * 0.15 + 70 * 0.15 + 80 * 0.4 + 50 * 0.3), // 66, computed here, not taken from the model
      situation: IN.Situation, task: IN.Task, action: IN.Action, result: IN.Result,
      refined: REPLY.refined,
    });
  });

  it('tells the model what role the candidate is preparing for, but not to use it as a source of facts', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    setup({ form: { role: 'Product Manager', level: 'Senior', industry: 'Fintech' } }); fill(); refine();
    await screen.findByText(/Refined STAR Output/);
    const prompt = callLLM.mock.calls[0][0][0].content;
    expect(prompt).toContain('Product Manager · Senior · Fintech');
    expect(prompt).toContain('NOT a source of facts');
  });

  it('never asks the model to add plausible metrics', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    setup(); fill(); refine();
    await screen.findByText(/Refined STAR Output/);
    expect(callLLM.mock.calls[0][0][0].content).not.toMatch(/plausible metrics|estimate/i);
  });

  it('deleting a banked story also deletes its saved row, so it does not come back after a reload', async () => {
    const bank = [{ id: 7, score: 82, oneLiner: 'Led a migration', date: '2026-01-02T00:00:00Z', refined: REPLY.refined }];
    setup({ memory: { starBank: bank }, user: { id: 'u1', token: 't' } });
    fireEvent.click(screen.getByText('Led a migration'));
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Confirm delete'));
    expect(sb.delete).toHaveBeenCalledWith('star_stories', { user_id: 'eq.u1', one_liner: 'eq.Led a migration' }, 't');
  });

  it('says so when the saved copy cannot be removed', async () => {
    sb.delete.mockRejectedValueOnce(new Error('denied'));
    const showToast = vi.fn();
    const bank = [{ id: 7, score: 82, oneLiner: 'Led a migration', date: '2026-01-02T00:00:00Z', refined: REPLY.refined }];
    setup({ memory: { starBank: bank }, user: { id: 'u1', token: 't' }, showToast });
    fireEvent.click(screen.getByText('Led a migration'));
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Confirm delete'));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/could not be deleted/), 'error'));
  });
});

describe('Story bank list', () => {
  const bank = [
    { id: 1, score: 82, oneLiner: 'Led a migration', date: '2026-01-02T00:00:00Z', refined: REPLY.refined },
    { id: 2, oneLiner: 'Old fake-era entry', situation: 'Old situation' }, // legacy shape: no score/refined
  ];

  it('lists saved stories, including legacy entries without a score', () => {
    setup({ memory: { starBank: bank } });
    expect(screen.getByText(/Your Story Bank/)).toBeTruthy();
    expect(screen.getByText('Led a migration')).toBeTruthy();
    expect(screen.getByText('Old fake-era entry')).toBeTruthy();
    expect(screen.getByText('–')).toBeTruthy();
  });

  it('expands a story, copies it, and deletes only after confirmation', async () => {
    const p = setup({ memory: { starBank: bank } });
    fireEvent.click(screen.getByText('Led a migration'));
    expect(screen.getByText('I owned the plan to avoid downtime.')).toBeTruthy();
    fireEvent.click(screen.getByText('Copy'));
    await screen.findByText('Copied ✓');
    fireEvent.click(screen.getByText('Delete'));
    expect(p.updateMemory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Confirm delete'));
    const next = p.updateMemory.mock.calls[0][0]({ starBank: bank });
    expect(next.starBank.map(s => s.id)).toEqual([2]);
  });

  it('can cancel a delete', () => {
    const p = setup({ memory: { starBank: bank } });
    fireEvent.click(screen.getByText('Led a migration'));
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByText('Delete')).toBeTruthy();
    expect(p.updateMemory).not.toHaveBeenCalled();
  });
});

describe('server scoring (F-1): the browser never sends a score to be stored', () => {
  const SERVER_RESULT = { ...REPLY, score: 66, competencies: ['ownership'] };
  beforeEach(() => { globalThis.__serverScoring = true; });
  afterEach(() => { globalThis.__serverScoring = false; });

  it('grades through the server, not the model directly', async () => {
    reviewStarOnServer.mockResolvedValue({ result: SERVER_RESULT, receipt: { ts: 1, sig: 'x' } });
    setup(); fill(); refine();
    await screen.findByText(/Refined STAR Output/);
    expect(callLLM).not.toHaveBeenCalled();
    expect(reviewStarOnServer.mock.calls[0][0]).toMatchObject({ situation: IN.Situation });
  });

  it('saves through the server and writes no star_stories row from the browser', async () => {
    reviewStarOnServer.mockResolvedValue({ result: SERVER_RESULT, receipt: { ts: 1, sig: 'x' } });
    saveStarOnServer.mockResolvedValue({ saved: true, score: 61 });
    const p = setup(); fill(); refine();
    await screen.findByText(/Refined STAR Output/);
    fireEvent.click(screen.getByText(/Save to Story Bank/));
    await waitFor(() => expect(p.updateMemory).toHaveBeenCalled());
    expect(saveStarOnServer).toHaveBeenCalledWith(expect.objectContaining({ situation: IN.Situation }), SERVER_RESULT, { ts: 1, sig: 'x' });
    expect(p.updateMemory.mock.calls[0][1]).toBeUndefined(); // no relational write
    expect(p.updateMemory.mock.calls[0][0]({}).starBank[0].score).toBe(61); // the score the server returned
  });

  it('keeps the story unsaved and shows the error when the server refuses', async () => {
    reviewStarOnServer.mockResolvedValue({ result: SERVER_RESULT, receipt: { ts: 1, sig: 'x' } });
    saveStarOnServer.mockRejectedValue(new Error('Daily limit of saved stories reached.'));
    const p = setup(); fill(); refine();
    await screen.findByText(/Refined STAR Output/);
    fireEvent.click(screen.getByText(/Save to Story Bank/));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Daily limit/);
    expect(p.updateMemory).not.toHaveBeenCalled();
  });
});
