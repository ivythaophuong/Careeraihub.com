// @vitest-environment jsdom
// In the score breakdown the ATS part is computed by code; the interview and STAR parts are AI estimates and are named so.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

vi.mock('../../lib/supabase', () => ({ sb: { select: vi.fn(), rpc: vi.fn(), insert: vi.fn(), update: vi.fn(), upsert: vi.fn() } }));
import { sb } from '../../lib/supabase';
import TrustMatch from './TrustMatch';

afterEach(cleanup);
const user = { id: 'u1', token: 'tok', name: 'Alice', email: 'a@x.test' };

describe('TrustMatch score breakdown', () => {
  it('names the interview and STAR numbers as AI estimates, not the ATS number, and says they are not verified assessments', async () => {
    sb.select.mockImplementation(async (table) => (table === 'candidate_trust_profiles'
      ? [{ user_id: 'u1', full_name: 'Alice', trust_score: 50, ats_score: 70, interview_score: 40, star_score: 55, is_visible: false }] : []));
    sb.rpc.mockResolvedValue([]);
    render(<TrustMatch user={user} memory={{}} updateMemory={vi.fn()} syncedAt={0} />);
    await waitFor(() => expect(screen.getByText(/Score breakdown/i)).toBeTruthy());
    const t = document.body.textContent;
    expect(t).toMatch(/Interview Sim \(AI estimate\)/);
    expect(t).toMatch(/STAR Stories \(AI estimate\)/);
    expect(t).toMatch(/ATS Resume\s*\(40%\)/);
    expect(t).not.toMatch(/ATS Resume \(AI estimate\)/);
    expect(t).toMatch(/not verified assessments/i);
  });
});
