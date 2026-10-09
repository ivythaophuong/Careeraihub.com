import React, { useEffect, useState, useCallback } from 'react';
import { COPY } from './consentCopy';
import { buildGrant, canShare, formatDate, groupByEmployer, releasedFields } from './consent';
import { grantConsent, listConsents, stopSharing } from './consentApi';

// Candidate consent flow (docs/architecture/plans/CONSENT-FLOW-DESIGN.md). Rendered only when the flag is on.
// The screens show the DATABASE's state: after every grant or stop they reload the consent list instead of assuming success.

const C = {
  bg: '#0E1420', bg2: '#131B2E', text: '#F0F4FF', text2: '#8B9DC3', text3: '#4A5A7A',
  line: 'rgba(236,72,153,.25)', accent: '#EC4899', ok: '#00E5A0', warn: '#FFD233', err: '#FF4D6A',
};
const btn = (primary, disabled) => ({
  padding: '9px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
  border: `1px solid ${primary ? C.accent : 'rgba(255,255,255,.12)'}`, background: primary ? 'rgba(236,72,153,.15)' : 'rgba(255,255,255,.04)', color: primary ? C.accent : C.text2,
});

// Loads the candidate's consents from the database and reloads on request.
export function useConsents({ token, enabled }) {
  const [consents, setConsents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!enabled || !token) return;
    try { setConsents(await listConsents(token)); setError(''); }
    catch { setError(COPY.loadFailed); }
    setLoaded(true);
  }, [token, enabled]);
  useEffect(() => { reload(); }, [reload]);
  return { consents, loaded, error, reload };
}

export function ShareDialog({ employerName, profile, busy, error, onShare, onCancel }) {
  const [shareSalary, setShareSalary] = useState(false);
  const gate = canShare(profile);
  const expires = new Date(Date.now() + 90 * 86_400_000).toISOString();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="consent-title"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 14, padding: 22, width: 'min(440px, 92vw)', color: C.text }}>
        <h2 id="consent-title" style={{ fontSize: 16, margin: '0 0 10px' }}>{COPY.dialogTitle(employerName)}</h2>
        <div style={{ fontSize: 12, color: C.text2, marginBottom: 6 }}>{COPY.willSee(employerName)}</div>
        <ul aria-label="Shared fields" style={{ margin: '0 0 10px 18px', padding: 0, fontSize: 12, lineHeight: 1.7 }}>
          {releasedFields({ shareSalary, profile }).map((f) => <li key={f}>{f}</li>)}
        </ul>
        <div style={{ fontSize: 11, color: C.text3, marginBottom: 12 }}>{COPY.notShared}</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 12 }}>
          <input type="checkbox" checked={shareSalary} onChange={(e) => setShareSalary(e.target.checked)} disabled={busy} />
          {COPY.salaryLabel}
        </label>
        <div style={{ fontSize: 11, color: C.text2, marginBottom: 12 }}>{COPY.expiry(formatDate(expires))}</div>
        {!gate.ok && <div role="note" style={{ fontSize: 11, color: C.warn, marginBottom: 10 }}>{gate.reason}</div>}
        {error && <div role="alert" style={{ fontSize: 11, color: C.err, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" style={btn(false, busy)} onClick={onCancel} disabled={busy}>{COPY.cancel}</button>
          <button type="button" style={btn(true, busy || !gate.ok)} disabled={busy || !gate.ok} onClick={() => onShare({ shareSalary })}>
            {busy ? COPY.sharing : COPY.share}
          </button>
        </div>
      </div>
    </div>
  );
}

// The sharing control under one job card.
export function ShareControl({ job, profile, token, consents, onChanged }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stopError, setStopError] = useState('');
  const group = groupByEmployer(consents).get(job.employer_id);
  const active = group && group.active.length > 0 ? group : null;

  if (!job.employer_id || !job.employer_name) {
    return <div style={{ fontSize: 10, color: C.text3, marginTop: 8 }}>{COPY.unavailable}</div>;
  }

  const share = async ({ shareSalary }) => {
    setBusy(true); setError('');
    try {
      await grantConsent(buildGrant({ employerId: job.employer_id, shareSalary }), token);
      await onChanged();           // the card changes only when the reloaded list shows the consent
      setOpen(false);
    } catch { setError(COPY.shareFailed); }
    setBusy(false);
  };
  const stop = async () => {
    setBusy(true); setStopError('');
    try { await stopSharing(job.employer_id, token); await onChanged(); }
    catch { setStopError(COPY.stopFailed); }
    setBusy(false);
  };

  return (
    <div style={{ marginTop: 8 }}>
      {active ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: C.ok }}>{COPY.sharedUntil(formatDate(active.expiresAt))}</span>
          <button type="button" style={btn(false, busy)} disabled={busy} onClick={stop}>{busy ? COPY.stopping : COPY.stop}</button>
        </div>
      ) : (
        <button type="button" style={btn(true, false)} onClick={() => { setError(''); setOpen(true); }}>{COPY.shareButton(job.employer_name)}</button>
      )}
      {stopError && <div role="alert" style={{ fontSize: 11, color: C.err, marginTop: 6 }}>{stopError}</div>}
      {open && <ShareDialog employerName={job.employer_name} profile={profile} busy={busy} error={error} onShare={share} onCancel={() => setOpen(false)} />}
    </div>
  );
}

// The "My sharing" tab: what is shared now, with whom, until when; and the history.
export function MySharing({ consents, employerNames, token, loadError, onChanged }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const groups = [...groupByEmployer(consents).values()];
  const activeGroups = groups.filter((g) => g.active.length > 0);
  const history = groups.flatMap((g) => g.history.map((c) => ({ ...c, employerId: g.employerId })));
  const nameOf = (id) => employerNames[id] || COPY.unknownEmployer;
  const partsText = (parts) => parts.map((p) => (p === 'salary' ? COPY.partsSalary : p === 'profile' ? COPY.partsProfile : p)).join(', ');

  const stop = async (employerId) => {
    setBusyId(employerId); setError('');
    try { await stopSharing(employerId, token); await onChanged(); }
    catch { setError(COPY.stopFailed); }
    setBusyId(null);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', color: C.text }}>
      {loadError && <div role="alert" style={{ fontSize: 12, color: C.err, marginBottom: 10 }}>{loadError}</div>}
      {error && <div role="alert" style={{ fontSize: 12, color: C.err, marginBottom: 10 }}>{error}</div>}
      {activeGroups.length === 0 && !loadError ? (
        <div style={{ fontSize: 12, color: C.text3, padding: '30px 0', textAlign: 'center' }}>{COPY.emptyActive}</div>
      ) : activeGroups.map((g) => (
        <div key={g.employerId} style={{ background: C.bg2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{nameOf(g.employerId)}</div>
          <div style={{ fontSize: 11, color: C.text2, margin: '4px 0 8px' }}>{partsText(g.parts)} · {COPY.sharedUntil(formatDate(g.expiresAt))}</div>
          <button type="button" style={btn(false, busyId === g.employerId)} disabled={busyId === g.employerId} onClick={() => stop(g.employerId)}>
            {busyId === g.employerId ? COPY.stopping : COPY.stop}
          </button>
        </div>
      ))}
      {history.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: C.text3, marginBottom: 6 }}>{COPY.historyHeading}</div>
          {history.map((c) => (
            <div key={c.id} style={{ fontSize: 11, color: C.text2, padding: '4px 0' }}>
              {nameOf(c.employerId)} · {partsText(c.scope?.parts || [])} · {c.revoked_at ? 'stopped' : 'expired'} {formatDate(c.revoked_at || c.expires_at)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

