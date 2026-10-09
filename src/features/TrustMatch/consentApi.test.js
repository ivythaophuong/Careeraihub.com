// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({ sb: { select: vi.fn(), insert: vi.fn(), update: vi.fn() } }));
import { sb } from '../../lib/supabase';
import { grantConsent, listConsents, stopSharing } from './consentApi';
import { buildGrant } from './consent';

beforeEach(() => vi.clearAllMocks());

describe('listConsents', () => {
  it('reads the consents table newest first with the user token', async () => {
    sb.select.mockResolvedValue([{ id: 'c1' }]);
    expect(await listConsents('tok')).toEqual([{ id: 'c1' }]);
    expect(sb.select).toHaveBeenCalledWith('consents', { order: 'granted_at.desc', limit: '200' }, 'tok');
  });
  it('fails when the reply is not a list', async () => {
    sb.select.mockResolvedValue({ message: 'x' });
    await expect(listConsents('tok')).rejects.toThrow(/Could not load/);
  });
});

describe('grantConsent: success only when the database returns the row', () => {
  const row = buildGrant({ employerId: 'e1', now: new Date('2026-10-09T00:00:00Z') });
  it('sends exactly the grant row to the consents table', async () => {
    sb.insert.mockResolvedValue([{ id: 'c1', ...row }]);
    const out = await grantConsent(row, 'tok');
    expect(sb.insert).toHaveBeenCalledTimes(1);
    const [table, body, token] = sb.insert.mock.calls[0];
    expect(table).toBe('consents');
    expect(Object.keys(body).sort()).toEqual(['employer_id', 'expires_at', 'purpose', 'scope']);
    expect(token).toBe('tok');
    expect(out.id).toBe('c1');
  });
  it('treats an empty reply as a failure (nothing is shown as shared)', async () => {
    sb.insert.mockResolvedValue([]);
    await expect(grantConsent(row, 'tok')).rejects.toThrow(/nothing was shared/);
    sb.insert.mockResolvedValue(null);
    await expect(grantConsent(row, 'tok')).rejects.toThrow(/nothing was shared/);
  });
  it('passes a database error on', async () => {
    sb.insert.mockRejectedValue(Object.assign(new Error('violates constraint'), { status: 400 }));
    await expect(grantConsent(row, 'tok')).rejects.toThrow(/violates/);
  });
});

describe('stopSharing: one request per employer', () => {
  it('patches only revoked_at, filtered on the employer and on not-yet-revoked', async () => {
    sb.update.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    const now = new Date('2026-10-09T01:02:03Z');
    const out = await stopSharing('e1', 'tok', now);
    expect(sb.update).toHaveBeenCalledTimes(1);
    expect(sb.update).toHaveBeenCalledWith('consents', { employer_id: 'eq.e1', revoked_at: 'is.null' }, { revoked_at: '2026-10-09T01:02:03.000Z' }, 'tok');
    expect(out).toHaveLength(2);
  });
  it('accepts an empty list (nothing was active) without failing', async () => {
    sb.update.mockResolvedValue([]);
    await expect(stopSharing('e1', 'tok')).resolves.toEqual([]);
  });
  it('fails when the reply is not a list (so the UI keeps showing the consent as active)', async () => {
    sb.update.mockResolvedValue(null);
    await expect(stopSharing('e1', 'tok')).rejects.toThrow(/unchanged/);
  });
  it('refuses to run without an employer', async () => {
    await expect(stopSharing('', 'tok')).rejects.toThrow();
    expect(sb.update).not.toHaveBeenCalled();
  });
});
