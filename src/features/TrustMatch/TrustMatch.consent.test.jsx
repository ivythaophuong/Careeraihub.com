// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('../../lib/supabase', () => ({ sb: { select: vi.fn(), rpc: vi.fn(), insert: vi.fn(), update: vi.fn(), upsert: vi.fn() } }));
import { sb } from '../../lib/supabase';
import TrustMatch from './TrustMatch';

const user = { id: 'u1', token: 'tok', name: 'Alice', email: 'a@x.test' };
const profile = { user_id: 'u1', full_name: 'Alice', trust_score: 0, is_visible: false };
const plainJob = { id: 'j1', employer_id: 'e1', title: 'Analyst', description: 'Do analysis' };
const namedJob = { ...plainJob, employer_name: 'Verified Co' };

let consentRows;
beforeEach(() => {
  vi.clearAllMocks();
  consentRows = [];
  sb.select.mockImplementation(async (table) => {
    if (table === 'candidate_trust_profiles') return [profile];
    if (table === 'job_listings') return [plainJob];
    if (table === 'consents') return consentRows;
    return [];
  });
  sb.rpc.mockResolvedValue([namedJob]);
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

const open = async () => {
  render(<TrustMatch user={user} memory={{}} updateMemory={vi.fn()} syncedAt={0} />);
  await waitFor(() => expect(screen.queryByText('Loading opportunities…')).toBeNull());
};

describe('flag OFF (the default): nothing changes', () => {
  it('shows no sharing control and no tab, and never calls the new endpoints', async () => {
    await open();
    expect(screen.getByText('Analyst')).toBeTruthy();
    expect(screen.queryByText(/Share my profile/)).toBeNull();
    expect(screen.queryByText('My sharing')).toBeNull();
    expect(sb.rpc).not.toHaveBeenCalled();
    expect(sb.select.mock.calls.map((c) => c[0])).not.toContain('consents');
  });
});

describe('flag ON', () => {
  beforeEach(() => vi.stubEnv('VITE_CONSENT_FLOW', 'true'));

  it('uses the open-jobs function to get the employer name and offers sharing for that employer', async () => {
    await open();
    expect(sb.rpc).toHaveBeenCalledWith('list_open_jobs', { p_limit: 20 }, 'tok');
    expect(await screen.findByRole('button', { name: 'Share my profile with Verified Co' })).toBeTruthy();
    expect(screen.getByText('My sharing')).toBeTruthy();
  });

  it('fails closed when the function is missing: the jobs still list, but sharing is not offered', async () => {
    sb.rpc.mockRejectedValue(Object.assign(new Error('Could not find the function'), { status: 404 }));
    await open();
    expect(screen.getByText('Analyst')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Share my profile/ })).toBeNull();
    expect(screen.getByText(/employer could not be identified/)).toBeTruthy();
  });

  it('full flow: share, the card changes only after the database lists the consent, then stop', async () => {
    sb.insert.mockImplementation(async (table, row) => {
      expect(table).toBe('consents');
      consentRows = [{ id: 'c1', ...row, revoked_at: null }];
      return [consentRows[0]];
    });
    sb.update.mockImplementation(async (table, filters, data) => {
      expect(table).toBe('consents');
      expect(filters).toEqual({ employer_id: 'eq.e1', revoked_at: 'is.null' });
      expect(Object.keys(data)).toEqual(['revoked_at']);
      const revoked = consentRows.map((c) => ({ ...c, revoked_at: data.revoked_at }));
      consentRows = revoked;
      return revoked;
    });
    await open();
    fireEvent.click(await screen.findByRole('button', { name: 'Share my profile with Verified Co' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(await screen.findByText(/Shared until/)).toBeTruthy();
    const body = sb.insert.mock.calls[0][1];
    expect(Object.keys(body).sort()).toEqual(['employer_id', 'expires_at', 'purpose', 'scope']);

    fireEvent.click(screen.getByText('My sharing'));
    expect(await screen.findByText(/profile · Shared until/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Stop sharing' }));
    await waitFor(() => expect(screen.getByText('You are not sharing your profile with anyone.')).toBeTruthy());
    expect(sb.update).toHaveBeenCalledTimes(1);
  });

  it('a failed insert shows an error and the card never says "Shared"', async () => {
    sb.insert.mockRejectedValue(new Error('constraint'));
    await open();
    fireEvent.click(await screen.findByRole('button', { name: 'Share my profile with Verified Co' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText(/Shared until/)).toBeNull();
  });

  it('a failed consent list shows an error on the My sharing tab instead of "nothing shared"', async () => {
    sb.select.mockImplementation(async (table) => {
      if (table === 'consents') throw new Error('network');
      if (table === 'candidate_trust_profiles') return [profile];
      return [plainJob];
    });
    await open();
    fireEvent.click(await screen.findByText('My sharing'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not load/);
    expect(screen.queryByText('You are not sharing your profile with anyone.')).toBeNull();
  });

  it('never reads other candidates: the only profile read is the candidate\'s own', async () => {
    await open();
    const reads = sb.select.mock.calls.filter((c) => c[0] === 'candidate_trust_profiles');
    for (const c of reads) expect(c[1]).toEqual({ user_id: 'eq.u1' });
  });
});
