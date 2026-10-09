// @vitest-environment jsdom
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

vi.mock('../../lib/supabase', () => ({ sb: { select: vi.fn(), rpc: vi.fn(), insert: vi.fn(), update: vi.fn(), upsert: vi.fn() } }));
import { sb } from '../../lib/supabase';
import EmployerPortal from './EmployerPortal';

const user = { id: 'rec1', token: 'tok', name: 'Rec', email: 'r@x.test', company: 'Verified Co' };
const verified = { id: 'emp1', name: 'Verified Co', owner_id: 'rec1', verified_at: '2026-01-01T00:00:00Z' };
const unverified = { ...verified, verified_at: null };
const shared = { user_id: 'cand1', full_name: 'Alice Tan', headline: 'Data analyst', bio: 'Shared bio', skills: ['sql'], location: 'Singapore',
  work_preference: 'remote', salary_min: null, salary_max: null, currency: null, consented_parts: ['profile'], consent_expires_at: '2099-01-01T00:00:00Z' };

const reads = (table) => sb.select.mock.calls.filter((c) => c[0] === table);
let employerRows;
beforeEach(() => {
  vi.clearAllMocks();
  employerRows = [verified];
  sb.select.mockImplementation(async (table) => {
    if (table === 'employers') return employerRows;
    if (table === 'candidate_trust_profiles') return [{ user_id: 'old1', full_name: 'Legacy Visible', headline: 'x', trust_score: 91, ats_score: 80, interview_score: 70, star_score: 60, skills: [] }];
    return [];
  });
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

const open = async (waitFor_ = () => screen.queryByText('Loading…') === null) => {
  render(<EmployerPortal user={user} onLogout={vi.fn()} />);
  await waitFor(() => expect(waitFor_()).toBe(true));
};

describe('flag OFF (default): the Portal behaves as before', () => {
  it('still reads the visible profiles directly and never calls the new function', async () => {
    await open();
    await waitFor(() => expect(reads('candidate_trust_profiles').length).toBe(1));
    expect(sb.rpc).not.toHaveBeenCalled();
    expect(screen.queryByText(/Candidates appear here after they choose/)).toBeNull();
  });
});

describe('flag ON: consent-only and fail-closed', () => {
  beforeEach(() => vi.stubEnv('VITE_CONSENT_FLOW', 'true'));

  it('reads candidates only through employer_view_candidates for this employer, and never queries the profile table', async () => {
    sb.rpc.mockResolvedValue([shared]);
    await open();
    await waitFor(() => expect(sb.rpc).toHaveBeenCalledWith('employer_view_candidates', { p_employer_id: 'emp1' }, 'tok'));
    expect(await screen.findByText('Alice Tan')).toBeTruthy();
    expect(reads('candidate_trust_profiles')).toHaveLength(0);
  });

  it('shows no practice score even if the server sent one', async () => {
    sb.rpc.mockResolvedValue([{ ...shared, trust_score: 77, ats_score: 66, interview_score: 55, star_score: 44 }]);
    await open();
    await screen.findByText('Alice Tan');
    const row = screen.getByText('Alice Tan').closest('tr');
    expect(row.textContent).not.toMatch(/77|66|55|44/);
  });

  it('FAILS CLOSED when the function is missing: an error, no candidates, and no direct query', async () => {
    sb.rpc.mockRejectedValue(Object.assign(new Error('Could not find the function public.employer_view_candidates'), { status: 404 }));
    await open();
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not load the candidates/);
    expect(screen.queryByText('Alice Tan')).toBeNull();
    expect(screen.queryByText('Legacy Visible')).toBeNull();
    expect(reads('candidate_trust_profiles')).toHaveLength(0);
  });

  it('FAILS CLOSED on a permission error', async () => {
    sb.rpc.mockRejectedValue(Object.assign(new Error('permission denied for function'), { status: 403 }));
    await open();
    await screen.findByRole('alert');
    expect(reads('candidate_trust_profiles')).toHaveLength(0);
  });

  it('FAILS CLOSED on an unexpected reply', async () => {
    sb.rpc.mockResolvedValue({ message: 'weird' });
    await open();
    await screen.findByRole('alert');
    expect(screen.queryByText('Alice Tan')).toBeNull();
    expect(reads('candidate_trust_profiles')).toHaveLength(0);
  });

  it('an empty answer explains that candidates appear after they share, and is not an error', async () => {
    sb.rpc.mockResolvedValue([]);
    await open();
    expect(await screen.findByText(/Candidates appear here after they choose to share their profile with you/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('an unverified employer makes no candidate request at all', async () => {
    employerRows = [unverified];
    render(<EmployerPortal user={user} onLogout={vi.fn()} />);
    await screen.findByText(/awaiting verification/);
    expect(sb.rpc).not.toHaveBeenCalled();
    expect(reads('candidate_trust_profiles')).toHaveLength(0);
  });
});

describe('source check: the consent path has no fallback query', () => {
  it('the consent branch of the bootstrap never mentions candidate_trust_profiles, not even in its catch block', () => {
    const src = fs.readFileSync(path.resolve(__dirname, 'EmployerPortal.jsx'), 'utf8');
    const start = src.indexOf('if (consentMode) {');
    const end = src.indexOf('return;', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const branch = src.slice(start, end).split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');   // comments may name the table
    expect(branch).toContain("sb.rpc('employer_view_candidates'");
    expect(branch).not.toMatch(/candidate_trust_profiles|sb\.select/);
  });
  it('the only direct read of candidate_trust_profiles in the Portal is the legacy path used when the flag is off', () => {
    const src = fs.readFileSync(path.resolve(__dirname, 'EmployerPortal.jsx'), 'utf8');
    const hits = src.split('\n').filter((l) => /sb\.select\('candidate_trust_profiles'/.test(l));
    expect(hits).toHaveLength(1);
  });
});
