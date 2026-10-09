// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('./consentApi', () => ({ grantConsent: vi.fn(), listConsents: vi.fn(), stopSharing: vi.fn() }));
import { grantConsent, stopSharing } from './consentApi';
import { ShareDialog, ShareControl, MySharing } from './ConsentUI';

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const FUTURE = '2099-01-01T00:00:00Z';
const profile = { full_name: 'Alice', salary_min: 90000, salary_max: 120000, currency: 'SGD' };
const job = { id: 'j1', employer_id: 'e1', employer_name: 'Verified Co', title: 'Analyst' };
const active = (o = {}) => ({ id: 'c1', employer_id: 'e1', purpose: 'recruiter_review', scope: { parts: ['profile'] }, expires_at: FUTURE, revoked_at: null, ...o });

describe('ShareDialog', () => {
  const open = (extra = {}) => render(<ShareDialog employerName="Verified Co" profile={profile} busy={false} error="" onShare={vi.fn()} onCancel={vi.fn()} {...extra} />);

  it('names the receiver, lists the profile fields and what is not shared, and has an expiry date', () => {
    open();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Share your profile with Verified Co?')).toBeTruthy();
    expect(screen.getByText('Verified Co will be able to see:')).toBeTruthy();
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(['Name', 'Headline', 'Bio', 'Skills', 'Location', 'Work preference']);
    expect(screen.getByText(/Not shared: your resume text, email address, credentials and practice scores/)).toBeTruthy();
    expect(screen.getByText(/This lasts until \d{1,2} \w{3} \d{4}/)).toBeTruthy();
  });
  it('the salary checkbox is OFF by default and adds the salary line only when ticked', () => {
    open();
    const box = screen.getByLabelText('Also share my expected salary range');
    expect(box.checked).toBe(false);
    expect(screen.queryByText(/Expected salary range/)).toBeNull();
    fireEvent.click(box);
    expect(screen.getByText('Expected salary range (SGD 90000–120000)')).toBeTruthy();
  });
  it('Share passes the choice on; Cancel and Escape close without sharing', () => {
    const onShare = vi.fn(); const onCancel = vi.fn();
    open({ onShare, onCancel });
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(onShare).toHaveBeenCalledWith({ shareSalary: false });
    fireEvent.click(screen.getByLabelText('Also share my expected salary range'));
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(onShare).toHaveBeenLastCalledWith({ shareSalary: true });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
  it('cannot share without a saved profile, and says why', () => {
    open({ profile: null });
    expect(screen.getByRole('button', { name: 'Share' }).disabled).toBe(true);
    expect(screen.getByRole('note').textContent).toMatch(/Save your TrustMatch profile first/);
  });
  it('shows an error and locks the buttons while busy', () => {
    open({ busy: true, error: 'boom' });
    expect(screen.getByRole('alert').textContent).toBe('boom');
    expect(screen.getByRole('button', { name: 'Cancel' }).disabled).toBe(true);
  });
});

describe('ShareControl', () => {
  const setup = (consents, props = {}) => {
    const onChanged = vi.fn().mockResolvedValue();
    const out = render(<ShareControl job={job} profile={profile} token="tok" consents={consents} onChanged={onChanged} {...props} />);
    return { onChanged, ...out };
  };

  it('offers the share button when nothing is shared', () => {
    setup([]);
    expect(screen.getByRole('button', { name: 'Share my profile with Verified Co' })).toBeTruthy();
    expect(screen.queryByText(/Shared until/)).toBeNull();
  });
  it('does not offer sharing when the employer cannot be identified', () => {
    setup([], { job: { id: 'j2', title: 'Analyst' } });
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/employer could not be identified/)).toBeTruthy();
  });
  it('shares only what the dialog says, then reloads from the database before changing the card', async () => {
    grantConsent.mockResolvedValue({ id: 'c9' });
    const { onChanged } = setup([]);
    fireEvent.click(screen.getByRole('button', { name: 'Share my profile with Verified Co' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(grantConsent).toHaveBeenCalledTimes(1));
    const [row, token] = grantConsent.mock.calls[0];
    expect(token).toBe('tok');
    expect(row.employer_id).toBe('e1');
    expect(row.scope).toEqual({ parts: ['profile'] });
    expect(row.purpose).toBe('recruiter_review');
    expect(Object.keys(row)).not.toContain('candidate_id');
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('a failed share shows an error, keeps the dialog, and never shows "Shared"', async () => {
    grantConsent.mockRejectedValue(new Error('x'));
    const { onChanged } = setup([]);
    fireEvent.click(screen.getByRole('button', { name: 'Share my profile with Verified Co' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/nothing was shared/));
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText(/Shared until/)).toBeNull();
  });
  it('shows the state of the database: shared until the latest expiry, with Stop sharing', () => {
    setup([active({ expires_at: '2099-01-01T00:00:00Z' }), active({ id: 'c2', expires_at: '2099-06-01T00:00:00Z', scope: { parts: ['salary'] } })]);
    expect(screen.getByText('Shared until 1 Jun 2099')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Share my profile/ })).toBeNull();
  });
  it('an expired or revoked consent is not "shared"', () => {
    setup([active({ revoked_at: '2026-01-01T00:00:00Z' }), active({ id: 'c3', expires_at: '2020-01-01T00:00:00Z' })]);
    expect(screen.queryByText(/Shared until/)).toBeNull();
    expect(screen.getByRole('button', { name: /Share my profile/ })).toBeTruthy();
  });
  it('Stop sharing calls the single revoke for that employer and reloads', async () => {
    stopSharing.mockResolvedValue([{ id: 'c1' }]);
    const { onChanged } = setup([active()]);
    fireEvent.click(screen.getByRole('button', { name: 'Stop sharing' }));
    await waitFor(() => expect(stopSharing).toHaveBeenCalledWith('e1', 'tok'));
    expect(stopSharing).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
  it('a failed stop keeps the consent shown as active and says so', async () => {
    stopSharing.mockRejectedValue(new Error('x'));
    const { onChanged } = setup([active()]);
    fireEvent.click(screen.getByRole('button', { name: 'Stop sharing' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/still shown as active/));
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByText(/Shared until/)).toBeTruthy();
  });
});

describe('MySharing', () => {
  it('lists active sharing per employer with parts and expiry, and the history separately', () => {
    render(<MySharing token="tok" loadError="" onChanged={vi.fn()} employerNames={{ e1: 'Verified Co' }}
      consents={[active({ scope: { parts: ['profile', 'salary'] } }), active({ id: 'h1', revoked_at: '2026-01-02T00:00:00Z' }), active({ id: 'h2', employer_id: 'e7', expires_at: '2020-03-04T00:00:00Z' })]} />);
    expect(screen.getByText('Verified Co')).toBeTruthy();
    expect(screen.getByText(/profile, salary range · Shared until 1 Jan 2099/)).toBeTruthy();
    expect(screen.getByText('History')).toBeTruthy();
    expect(screen.getByText(/Verified Co · profile · stopped 2 Jan 2026/)).toBeTruthy();
    expect(screen.getByText(/Employer \(name unavailable\) · profile · expired 4 Mar 2020/)).toBeTruthy();
  });
  it('says so when nothing is shared', () => {
    render(<MySharing token="tok" loadError="" onChanged={vi.fn()} employerNames={{}} consents={[]} />);
    expect(screen.getByText('You are not sharing your profile with anyone.')).toBeTruthy();
  });
  it('shows a load error instead of claiming nothing is shared', () => {
    render(<MySharing token="tok" loadError="We could not load your sharing settings." onChanged={vi.fn()} employerNames={{}} consents={[]} />);
    expect(screen.getByRole('alert').textContent).toMatch(/could not load/);
    expect(screen.queryByText('You are not sharing your profile with anyone.')).toBeNull();
  });
  it('stop is one call per employer, and a failure keeps the entry', async () => {
    stopSharing.mockRejectedValue(new Error('x'));
    const onChanged = vi.fn();
    render(<MySharing token="tok" loadError="" onChanged={onChanged} employerNames={{ e1: 'Verified Co' }} consents={[active()]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Stop sharing' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/still shown as active/));
    expect(stopSharing).toHaveBeenCalledWith('e1', 'tok');
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByText('Verified Co')).toBeTruthy();
  });
});
