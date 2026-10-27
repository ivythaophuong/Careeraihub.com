import React, { useState, useEffect, useRef } from 'react';
import { C } from '../../styles/theme';
import { Card } from '../../components/CommonUI';
import {
  NO_REPLY_DAYS, STAGES, STATUS_LIST, STATUS_LABEL, groupByStage, stageOf, pipelineStats, nextStep, attentionList,
  followUpDraft, thankYouDraft, appliedOn, daysSince, daysUntil, agoText, toDay,
} from './jobTracker';
import { SOFT, GRAD, STAGE_COLOR, GradBtn, GhostBtn, Eyebrow } from './jobUI';
import './jobhunt.css';

const fieldStyle = { width: '100%', boxSizing: 'border-box', background: '#0F1520', border: '1px solid #26354F', borderRadius: 11, color: C.text, padding: '12px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit' };
const labelStyle = { display: 'block', color: '#C7D3EA', fontSize: 12.5, fontWeight: 700, marginBottom: 6 };
const safeLink = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);

// How each stage looks on a card: surface, border, monogram and the colour of the small status text.
const TONE = {
  saved: { bg: '#131B2A', bd: '#22314B', mono: '#1F2C47', monoFg: '#C7D6F2', role: SOFT, chip: SOFT },
  applied: { bg: '#131B2A', bd: '#22314B', mono: '#1F2C47', monoFg: '#C7D6F2', role: SOFT, chip: SOFT },
  noreply: { bg: '#1A1710', bd: '#5A4413', mono: '#2B2412', monoFg: '#F6C768', role: '#B9B3A4', chip: '#F6C768' },
  interviewing: { bg: '#0F1B2B', bd: '#1F4A6B', mono: '#12304A', monoFg: '#7DD3FC', role: SOFT, chip: '#7DD3FC' },
  offer: { bg: '#0E1B18', bd: '#14543F', mono: '#113B2E', monoFg: '#6EE7B7', role: SOFT, chip: '#6EE7B7' },
  closed: { bg: '#131B2A', bd: '#22314B', mono: '#2A1A22', monoFg: '#FDA4AF', role: SOFT, chip: '#FDA4AF' },
};
const SHORT_LABEL = { saved: 'Saved', applied: 'Applied', noreply: 'No reply', interviewing: 'Interviewing', offer: 'Offer', closed: 'Closed' };
const PHONE_ORDER = ['noreply', 'interviewing', 'offer', 'applied', 'saved', 'closed']; // what needs you first
const ACTION_LABEL = { interviewing: 'Practise now', offer: 'Prepare to negotiate' };

const initial = (app) => (app.company || '?').trim().charAt(0).toUpperCase() || '?';
const shortAge = (d) => (d == null ? '' : d <= 0 ? 'today' : d < 7 ? `${d}d` : d < 30 ? `${Math.floor(d / 7)}w` : `${Math.floor(d / 30)}mo`);
const niceDate = (ymd) => {
  const d = ymd ? new Date(`${toDay(ymd)}T00:00:00`) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
};
const dayMonth = (ymd) => {
  const d = ymd ? new Date(`${toDay(ymd)}T00:00:00`) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : (ymd || '');
};

function useNarrow(px = 700) {
  const query = `(max-width: ${px}px)`;
  const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const [narrow, setNarrow] = useState(() => supported && window.matchMedia(query).matches);
  useEffect(() => {
    if (!supported) return undefined;
    const m = window.matchMedia(query);
    const on = () => setNarrow(m.matches);
    on();
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, [query, supported]);
  return narrow;
}

// ── Rejection Coach ──────────────────────────────────────────────────────────
export function RejectionCoach({ rejection }) {
  return (
    <div style={{ padding: '14px 16px', background: 'rgba(251,113,133,.07)', borderLeft: '3px solid #FB7185', borderRadius: '0 12px 12px 0' }}>
      <div style={{ color: '#FB7185', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Recovery Tips</div>
      <div style={{ color: C.text, fontSize: 13, lineHeight: 1.6 }}>
        Don't let {rejection.company} slow you down. Rejections are a normal part of a job search, and each one is a chance to learn something for the next application.
        <span style={{ color: C.gold, display: 'block', marginTop: 4 }}>💡 Pro Tip: Send a "Thank you & Feedback" note to the recruiter to stay in their talent pool.</span>
      </div>
    </div>
  );
}

// ── Add a job ────────────────────────────────────────────────────────────────
// `onSave(fields, { checkFit })`. A link alone cannot be read (the app does not fetch job pages), so checking fit needs pasted text.
export function AddJobForm({ initial: init, onSave, onCancel }) {
  const [f, setF] = useState({ company: '', role: '', link: '', jd: '', status: 'Saved', ...init });
  const [paste, setPaste] = useState('');
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));

  const onPaste = (e) => {
    const v = e.target.value;
    setPaste(v);
    const t = v.trim();
    if (/^https?:\/\/\S+$/i.test(t)) setF(p => ({ ...p, link: t })); // a lone link fills the link
    else setF(p => ({ ...p, jd: t }));                                   // anything longer is the job description
  };

  const submit = (checkFit) => {
    if (!f.company.trim() || !f.role.trim()) { setErr('Add the company and the role so you can find this job later.'); return; }
    setErr('');
    onSave(f, { checkFit });
  };

  return (
    <div style={{ borderRadius: 18, padding: 1.5, background: GRAD }}>
      <div style={{ background: '#120E1F', color: '#E8F0FE', borderRadius: 17, padding: '20px 22px' }}>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Add a job you found</div>
        <div style={{ color: SOFT, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>Paste the job link or the job description, then add the company and role. Nothing is saved until you add it.</div>
        <label style={labelStyle} htmlFor="jt-paste">Job link or description</label>
        <textarea id="jt-paste" value={paste} onChange={onPaste} rows={3} placeholder="Paste here" style={{ ...fieldStyle, resize: 'vertical', marginBottom: 14 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 14 }}>
          <div><label style={labelStyle} htmlFor="jt-company">Company</label><input id="jt-company" value={f.company} onChange={set('company')} style={{ ...fieldStyle, minHeight: 44 }} /></div>
          <div><label style={labelStyle} htmlFor="jt-role">Role</label><input id="jt-role" value={f.role} onChange={set('role')} style={{ ...fieldStyle, minHeight: 44 }} /></div>
          <div>
            <label style={labelStyle} htmlFor="jt-status">Where is it now?</label>
            <select id="jt-status" value={f.status} onChange={set('status')} style={{ ...fieldStyle, minHeight: 44 }}>
              <option value="Saved">Saved, not applied yet</option>
              <option value="Applied">I already applied</option>
            </select>
          </div>
        </div>
        {f.link && <div style={{ color: SOFT, fontSize: 12, marginBottom: 12, wordBreak: 'break-all' }}>Link: {f.link}</div>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <GradBtn onClick={() => submit(false)}>Add to tracker</GradBtn>
          <GhostBtn onClick={() => submit(true)} disabled={!f.jd.trim()}>Add and check my fit</GhostBtn>
          {onCancel && <GhostBtn onClick={onCancel} color={SOFT} border="#26354F">Cancel</GhostBtn>}
        </div>
        {!f.jd.trim() && <div style={{ color: SOFT, fontSize: 12, marginTop: 10 }}>To check your fit, paste the job description text. A link alone cannot be read.</div>}
        {err && <div role="alert" style={{ color: '#FB7185', fontSize: 13, marginTop: 12 }}>⚠️ {err}</div>}
      </div>
    </div>
  );
}

// ── Board card ───────────────────────────────────────────────────────────────
// Long text for screen readers and the card's name.
function cardMeta(app, stage, now) {
  const when = daysSince(appliedOn(app), now);
  switch (stage) {
    case 'saved': return `Saved ${agoText(daysSince(app.savedOn || app.date, now))}`;
    case 'applied':
    case 'noreply': return `Applied ${agoText(when)}`;
    case 'interviewing': {
      const left = daysUntil(app.interviewDate, now);
      if (left == null) return 'Add the interview date';
      return left < 0 ? `Interview was ${agoText(-left)}` : left === 0 ? 'Interview today' : `Interview in ${left} day${left === 1 ? '' : 's'}`;
    }
    case 'offer': return 'Offer received';
    default: return 'Rejected / closed';
  }
}

// Short text for the corner of the card.
function chipText(app, stage, now) {
  switch (stage) {
    case 'saved': return shortAge(daysSince(app.savedOn || app.date, now));
    case 'applied': return shortAge(daysSince(appliedOn(app), now));
    case 'noreply': return app.status === 'Follow-up' ? 'Followed up' : `${shortAge(daysSince(appliedOn(app), now))} quiet`;
    case 'interviewing': {
      const left = daysUntil(app.interviewDate, now);
      if (left == null) return 'Add date';
      return left < 0 ? `${shortAge(-left)} ago` : left === 0 ? 'today' : `in ${left} day${left === 1 ? '' : 's'}`;
    }
    case 'offer': return 'received';
    default: return shortAge(daysSince(app.closedOn || app.statusChangedOn || appliedOn(app), now));
  }
}

// The one line under a card: a hint, or (for stages that need you) a real button.
function cardHint(app, stage, step) {
  if (stage === 'saved') return app.jd ? 'Check your fit' : 'Add the job description';
  if (stage === 'closed') return 'What did you learn?';
  if (stage === 'applied') return step.actions[0].label;
  return null;
}

function Monogram({ app, stage, size = 28 }) {
  const t = TONE[stage];
  return (
    <div aria-hidden="true" style={{ width: size, height: size, flex: 'none', borderRadius: size > 32 ? 11 : 8, background: t.mono, color: t.monoFg, fontWeight: 800, fontSize: size > 32 ? 16 : 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initial(app)}</div>
  );
}

const actionBtn = (stage) => {
  const solid = { noreply: ['#F59E0B', '#1A1203'], interviewing: ['#38BDF8', '#04121C'], offer: ['#00D484', '#04120C'] }[stage];
  return { width: '100%', minHeight: 44, borderRadius: 10, border: 'none', background: solid[0], color: solid[1], fontWeight: 800, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' };
};

function BoardCard({ app, stage, selected, onSelect, onAct, now }) {
  const t = TONE[stage];
  const step = nextStep(app, now);
  const hint = cardHint(app, stage, step);
  const act = ACTION_LABEL[stage] || (stage === 'noreply' ? step.actions[0].label : null);
  return (
    <div className="jh-card" style={{ background: t.bg, border: `1px solid ${selected ? STAGE_COLOR[stage] : t.bd}`, borderRadius: 12, boxShadow: selected ? `0 0 0 1px ${STAGE_COLOR[stage]}` : 'none', opacity: stage === 'closed' ? 0.92 : 1 }}>
      <button
        type="button" className="jh-card-main"
        onClick={() => onSelect(app.id)}
        aria-pressed={selected}
        aria-label={`${app.company}, ${app.role}. ${cardMeta(app, stage, now)}`}
        style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', width: '100%', cursor: 'pointer', font: 'inherit', background: 'transparent', border: 'none', color: C.text, borderRadius: 12, padding: 12, minHeight: 44, boxSizing: 'border-box' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Monogram app={app} stage={stage} />
          <span style={{ fontSize: 11, fontWeight: stage === 'noreply' || stage === 'interviewing' || stage === 'offer' ? 700 : 500, color: t.chip }}>{chipText(app, stage, now)}</span>
        </span>
        <span>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 800, overflowWrap: 'anywhere' }}>{app.company}</span>
          <span style={{ display: 'block', fontSize: 12.5, color: t.role, marginTop: 1, overflowWrap: 'anywhere' }}>{app.role}</span>
        </span>
        {app.fitScore != null && <span style={{ fontSize: 11, color: SOFT }}>AI fit estimate {app.fitScore}%</span>}
        {hint && <span style={{ fontSize: 12, fontWeight: 700, color: stage === 'closed' ? '#FDA4AF' : '#C7D3EA' }}>{hint}</span>}
      </button>
      {act && (
        <div style={{ padding: '0 12px 12px' }}>
          <button type="button" className="jh-btn" onClick={() => onAct({ app, step })} style={actionBtn(stage)}>{act}</button>
        </div>
      )}
    </div>
  );
}

// One row of the phone list: the same card in a single line, the colour bar on the left tells the stage.
function JobRow({ app, stage, selected, onSelect, onAct, now }) {
  const t = TONE[stage];
  const step = nextStep(app, now);
  return (
    <div className="jh-card" style={{ background: t.bg, borderStyle: 'solid', borderWidth: '1px 1px 1px 4px', borderColor: `${selected ? STAGE_COLOR[stage] : t.bd} ${selected ? STAGE_COLOR[stage] : t.bd} ${selected ? STAGE_COLOR[stage] : t.bd} ${STAGE_COLOR[stage]}`, borderRadius: 14, opacity: stage === 'closed' ? 0.9 : 1 }}>
      <button
        type="button" className="jh-card-main" onClick={() => onSelect(app.id)} aria-pressed={selected}
        aria-label={`${app.company}, ${app.role}. ${cardMeta(app, stage, now)}`}
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit', background: 'transparent', border: 'none', color: C.text, padding: 14, minHeight: 44, boxSizing: 'border-box', borderRadius: 14 }}
      >
        <Monogram app={app} stage={stage} size={40} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800, overflowWrap: 'anywhere' }}>{app.company}</span>
          <span style={{ display: 'block', fontSize: 13, color: t.role, overflowWrap: 'anywhere' }}>{app.role}</span>
        </span>
        <span style={{ flex: 'none', fontSize: 11.5, fontWeight: 700, color: t.chip }}>{stage === 'closed' ? 'Closed' : chipText(app, stage, now)}</span>
      </button>
      {stage === 'noreply' && (
        <div style={{ padding: '0 14px 14px' }}>
          <button type="button" className="jh-btn" onClick={() => onAct({ app, step })} style={actionBtn('noreply')}>{step.actions[0].label}</button>
        </div>
      )}
    </div>
  );
}

// ── Detail drawer ────────────────────────────────────────────────────────────
const STEPS = ['Saved', 'Applied', 'Interviewing', 'Offer'];
const STEP_INDEX = { saved: 0, applied: 1, noreply: 1, interviewing: 2, offer: 3 };

function Stepper({ app, stage }) {
  const closed = stage === 'closed';
  const reached = closed ? (app.reachedInterview ? 2 : appliedOn(app) && app.status !== 'Saved' ? 1 : 0) : STEP_INDEX[stage];
  const current = closed ? STAGE_COLOR.closed : STAGE_COLOR[stage];
  return (
    <div style={{ background: '#0F1520', border: '1px solid #1E2D45', borderRadius: 16, padding: '16px 18px 14px' }}>
      <ol aria-label="Progress" className="jh-steps">
        {STEPS.map((label, i) => {
          const done = i < reached || (closed && i <= reached);
          const here = !closed && i === reached;
          return (
            <li key={label} aria-current={here ? 'step' : undefined}>
              <div style={{ height: 6, borderRadius: 99, background: here ? current : done ? (closed ? '#7F3A47' : '#A78BFA') : '#1B2740' }} />
              <div style={{ marginTop: 9, fontSize: 12, fontWeight: 700, color: here ? current : done ? '#C4B5FD' : '#8D9DBA' }}>{label}</div>
            </li>
          );
        })}
      </ol>
      {closed && <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: '#FDA4AF' }}>Closed</div>}
    </div>
  );
}

function Detail({ app, now, userName, openDraft, setOpenDraft, onPatch, onStatus, onDelete, onOpen, onClose }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);
  const stage = stageOf(app, now);
  const step = nextStep(app, now);
  const link = safeLink(app.link);
  const tone = TONE[stage];
  const draftText = openDraft === 'thankYou' ? thankYouDraft(app, userName) : openDraft === 'followUp' ? followUpDraft(app, userName) : '';

  // A dialog: focus moves in, Tab stays inside, Escape closes, and focus goes back to the card that opened it.
  useEffect(() => {
    const opener = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll('a[href], button:not(:disabled), input, select, textarea, [tabindex]:not([tabindex="-1"])')];
      if (items.length === 0) return;
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (opener && opener.isConnected) opener.focus?.(); };
  }, [onClose]);

  const run = (a) => {
    if (a.kind === 'module') onOpen(a.module, app);
    else if (a.kind === 'draft') setOpenDraft(openDraft === a.draft ? null : a.draft);
    else if (a.kind === 'status') onStatus(app.id, a.status);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(draftText); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked: the text stays selectable */ }
  };

  const events = [
    app.savedOn || (app.status === 'Saved' ? toDay(app.date) : null) ? { k: 'Saved', d: app.savedOn || toDay(app.date), c: STAGE_COLOR.saved } : null,
    appliedOn(app) && app.status !== 'Saved' ? { k: 'Applied', d: appliedOn(app), c: STAGE_COLOR.applied } : null,
    app.followedUpOn ? { k: 'Followed up', d: app.followedUpOn, c: STAGE_COLOR.noreply } : null,
    app.interviewDate ? { k: 'Interview', d: toDay(app.interviewDate), c: STAGE_COLOR.interviewing } : null,
    app.closedOn ? { k: 'Closed', d: app.closedOn, c: STAGE_COLOR.closed } : null,
  ].filter(Boolean).sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0)); // newest first

  const left = stage === 'interviewing' ? daysUntil(app.interviewDate, now) : null;
  const badge = stage === 'interviewing' && left != null && left >= 0 ? (left === 0 ? 'Interview today' : `Interview in ${left} day${left === 1 ? '' : 's'}`) : null;

  return (
    <>
      <div className="jh-scrim" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className="jh-drawer" role="dialog" aria-modal="true" aria-label={`${app.company}, ${app.role}`} tabIndex={-1}>
        <div className="jh-grip" aria-hidden="true" />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
            <Monogram app={app} stage={stage} size={52} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.01em', overflowWrap: 'anywhere' }}>{app.company}</div>
              <div style={{ fontSize: 14.5, color: SOFT, marginTop: 2, overflowWrap: 'anywhere' }}>
                {app.role}{link && <> · <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: '#7DD3FC' }}>Open the job ↗</a></>}
              </div>
            </div>
          </div>
          <button type="button" className="jh-close" aria-label="Close" onClick={onClose} style={{ width: 44, height: 44, flex: 'none', borderRadius: 12, border: '1px solid #26354F', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#C7D3EA" strokeWidth="2" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>
          </button>
        </div>

        <Stepper app={app} stage={stage} />

        {/* Next best step */}
        <div style={{ borderRadius: 18, padding: 1.5, background: GRAD }}>
          <div style={{ background: '#120E1F', color: '#E8F0FE', borderRadius: 17, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <Eyebrow color="#F9A8D4">Your next best step</Eyebrow>
              {badge && <div style={{ fontSize: 12, fontWeight: 800, color: '#07101C', background: '#7DD3FC', borderRadius: 99, padding: '4px 10px' }}>{badge}</div>}
            </div>
            <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.25 }}>{step.title}</div>
            <div style={{ fontSize: 14, color: '#C7D3EA', lineHeight: 1.5 }}>{step.why}</div>
            <div className="jh-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {step.actions.map((a, i) => {
                const off = a.needs === 'jd' && !app.jd;
                return i === 0
                  ? <GradBtn key={a.id} onClick={() => run(a)} disabled={off}>{a.label}</GradBtn>
                  : <GhostBtn key={a.id} onClick={() => run(a)} disabled={off}>{a.label}</GhostBtn>;
              })}
            </div>
            {draftText && (
              <div style={{ marginTop: 4 }}>
                <label style={labelStyle} htmlFor={`jt-draft-${app.id}`}>Draft (edit before you send)</label>
                <textarea id={`jt-draft-${app.id}`} readOnly value={draftText} rows={9} style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.5 }} />
                <GhostBtn onClick={copy} color="#6EE7B7" border="#14543F" style={{ marginTop: 10 }}>{copied ? 'Copied' : 'Copy draft'}</GhostBtn>
              </div>
            )}
          </div>
        </div>

        {/* Details and timeline */}
        <div style={{ display: 'flex', gap: '20px 24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Eyebrow>Details</Eyebrow>
            <div>
              <label style={labelStyle} htmlFor={`jt-st-${app.id}`}>Status</label>
              <select id={`jt-st-${app.id}`} aria-label={`Status for ${app.role} at ${app.company}`} value={STATUS_LIST.includes(app.status) ? app.status : 'Applied'} onChange={e => onStatus(app.id, e.target.value)} style={{ ...fieldStyle, minHeight: 48, fontWeight: 700, borderColor: STAGE_COLOR[stage] + '99' }}>
                {STATUS_LIST.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            {app.status === 'Interviewing' && (
              <div>
                <label style={labelStyle} htmlFor={`jt-int-${app.id}`}>Interview date</label>
                <input id={`jt-int-${app.id}`} type="date" value={toDay(app.interviewDate) || ''} onChange={e => onPatch(app.id, { interviewDate: e.target.value || null })} style={{ ...fieldStyle, minHeight: 48 }} />
              </div>
            )}
            <div>
              <label style={labelStyle} htmlFor={`jt-notes-${app.id}`}>{stage === 'closed' ? 'What did you learn?' : 'Notes'}</label>
              <textarea id={`jt-notes-${app.id}`} defaultValue={app.notes || ''} onBlur={e => { if (e.target.value !== (app.notes || '')) onPatch(app.id, { notes: e.target.value }); }} rows={4} style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.5 }} />
            </div>
            <div>
              <label style={labelStyle} htmlFor={`jt-jd-${app.id}`}>Job description {app.fitScore != null && <span style={{ fontWeight: 500 }}>· AI fit estimate {app.fitScore}%</span>}</label>
              <textarea id={`jt-jd-${app.id}`} defaultValue={app.jd || ''} onBlur={e => { if (e.target.value.trim() !== (app.jd || '')) onPatch(app.id, { jd: e.target.value.trim() }); }} rows={4} placeholder="Paste the description to check your fit and practise for this job" style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.5 }} />
            </div>
          </div>

          <div style={{ flex: '0 1 200px', minWidth: 160, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Eyebrow>Timeline</Eyebrow>
            {events.length === 0 && <div style={{ color: SOFT, fontSize: 13 }}>No dates yet.</div>}
            <ol style={{ listStyle: 'none', margin: 0, padding: '0 0 0 6px' }}>
              {events.map((ev, i) => (
                <li key={ev.k} style={{ display: 'flex', gap: 12 }}>
                  <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: ev.c, boxShadow: i === 0 ? `0 0 0 4px ${ev.c}2E` : 'none', marginTop: 3 }} />
                    {i < events.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 34, background: '#26354F' }} />}
                  </div>
                  <div style={{ paddingBottom: 14 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800 }}>{ev.k}</div>
                    <div style={{ fontSize: 12, color: SOFT }}>{dayMonth(ev.d)}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {stage === 'closed' && <RejectionCoach rejection={app} />}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderTop: '1px solid #1E2D45', paddingTop: 14 }}>
          {!confirmDelete
            ? <button type="button" className="jh-btn" onClick={() => setConfirmDelete(true)} style={{ minHeight: 44, padding: 0, background: 'none', border: 'none', color: '#FB7185', fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}>Delete this job</button>
            : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <GradBtn onClick={() => onDelete(app.id)} style={{ background: '#FB7185' }}>Yes, delete</GradBtn>
                <GhostBtn onClick={() => setConfirmDelete(false)} color={SOFT} border="#26354F">Keep it</GhostBtn>
              </div>}
          <div style={{ fontSize: 12, color: '#8D9DBA' }}>Notes and description save when you click away.</div>
        </div>
      </div>
    </>
  );
}

// ── Today's best move ────────────────────────────────────────────────────────
function Ring({ left, color, children }) {
  const offset = left == null ? 0 : 207 * Math.min(Math.max(left, 0), 7) / 7; // a week out is an empty ring, today is full
  return (
    <div aria-hidden="true" style={{ width: 76, height: 76, flex: 'none', position: 'relative' }}>
      <svg width="76" height="76" viewBox="0 0 76 76" style={{ position: 'absolute', left: 0, top: 0 }}>
        <circle cx="38" cy="38" r="33" fill="none" stroke="#2A2540" strokeWidth="6" />
        <circle cx="38" cy="38" r="33" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray="207" strokeDashoffset={offset} transform="rotate(-90 38 38)" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  );
}

function heroCopy(app, stage, step, now) {
  const left = stage === 'interviewing' ? daysUntil(app.interviewDate, now) : null;
  switch (stage) {
    case 'interviewing': return { title: `Interview at ${app.company}`, sub: `${app.role}${app.interviewDate ? ` · ${niceDate(app.interviewDate)}` : ''}`, left: left != null && left >= 0 ? left : null };
    case 'offer': return { title: `Offer from ${app.company}`, sub: app.role, left: null };
    case 'noreply': return { title: `Follow up with ${app.company}`, sub: `${app.role} · ${step.why}`, left: null };
    default: return { title: step.title, sub: `${app.company} · ${app.role}`, left: null };
  }
}

function TodayCard({ item, others, now, onAct, onOpenJob }) {
  const { app, step } = item;
  const stage = stageOf(app, now);
  const copy = heroCopy(app, stage, step, now);
  const color = STAGE_COLOR[stage] === STAGE_COLOR.noreply ? '#F59E0B' : STAGE_COLOR[stage];
  return (
    <section className="jh-today" aria-label="Today's best move" style={{ borderRadius: 18, padding: 1.5, background: GRAD }}>
      <div style={{ background: '#120E1F', color: '#E8F0FE', borderRadius: 17, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16, height: '100%', boxSizing: 'border-box' }}>
        <Eyebrow color="#F9A8D4">Today's best move</Eyebrow>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Ring left={copy.left} color={color}>
            {copy.left == null
              ? <span style={{ fontSize: 26, fontWeight: 800, color: TONE[stage].monoFg }}>{initial(app)}</span>
              : copy.left === 0
                ? <span style={{ fontSize: 15, fontWeight: 800 }}>Today</span>
                : <><span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{copy.left}</span><span style={{ fontSize: 11, color: SOFT }}>{copy.left === 1 ? 'day' : 'days'}</span></>}
          </Ring>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 800, overflowWrap: 'anywhere' }}>{copy.title}</div>
            <div style={{ fontSize: 13.5, color: '#C7D3EA', marginTop: 3, overflowWrap: 'anywhere' }}>{copy.sub}</div>
            {copy.left != null && <span className="jh-sr">{copy.left === 0 ? 'Interview today' : `Interview in ${copy.left} day${copy.left === 1 ? '' : 's'}`}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <GradBtn onClick={() => onAct(item)} style={{ flex: '1 1 160px' }}>{step.actions[0].label}</GradBtn>
          <GhostBtn className="jh-narrow-hide" onClick={() => onOpenJob(app.id)}>Open job</GhostBtn>
        </div>
        {others.length > 0 && (
          <div className="jh-narrow-hide" style={{ borderTop: '1px solid #2A2540', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {others.map(o => (
              <div key={o.app.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 13, color: '#C7D3EA' }}>
                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}><b style={{ color: '#E8F0FE' }}>{o.app.company}</b> · {o.step.title}</span>
                <button type="button" className="jh-btn" onClick={() => onAct(o)} style={{ flex: 'none', minHeight: 44, padding: '0 4px', background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: STAGE_COLOR[stageOf(o.app, now)], cursor: 'pointer' }}>{o.step.actions[0].label}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Pipeline ─────────────────────────────────────────────────────────────────
function Pipeline({ stats }) {
  const pct = (n) => (stats.applied ? Math.round((n / stats.applied) * 100) : 0);
  const cell = (label, value, share, color, showPct) => (
    <div className="jh-stat" key={label}>
      <div style={{ fontSize: 13, color: SOFT }}>{label}</div>
      <div style={{ fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 800, lineHeight: 1.1, marginTop: 2 }}>{value}{showPct && <span style={{ fontSize: 15, fontWeight: 700, color: SOFT }}> {share}%</span>}</div>
      <div aria-hidden="true" style={{ height: 6, borderRadius: 99, background: '#1B2740', marginTop: 12 }}><div style={{ width: `${share}%`, height: 6, borderRadius: 99, background: color }} /></div>
    </div>
  );
  return (
    <section className="jh-pipe" aria-label="Your pipeline">
      <div className="jh-narrow-hide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <Eyebrow>Your pipeline</Eyebrow>
        <div style={{ fontSize: 12.5, color: SOFT }}>Quiet for {NO_REPLY_DAYS} days moves a job to <b style={{ color: '#F59E0B' }}>No reply</b></div>
      </div>
      <div className="jh-stats">
        {cell('Applied', stats.applied, stats.applied ? 100 : 0, '#A78BFA', false)}
        {cell('Heard back', stats.heardBack, pct(stats.heardBack), '#38BDF8', true)}
        {cell('Interviews', stats.interviews, pct(stats.interviews), '#F472B6', true)}
        {cell('Offers', stats.offers, pct(stats.offers), '#00D484', true)}
      </div>
    </section>
  );
}

// ── Tracker ──────────────────────────────────────────────────────────────────
export default function ApplicationTracker({ apps, now = new Date(), userName = '', onPatch, onStatus, onDelete, onOpen, onAddClick, onFind }) {
  const [selectedId, setSelectedId] = useState(null);
  const [openDraft, setOpenDraft] = useState(null);
  const [filter, setFilter] = useState('all');
  const narrow = useNarrow();
  const selected = apps.find(a => a.id === selectedId) || null;
  const stats = pipelineStats(apps);
  const groups = groupByStage(apps, now);
  const attention = attentionList(apps, now);

  const select = (id) => { setSelectedId(id === selectedId ? null : id); setOpenDraft(null); };
  const close = React.useCallback(() => setSelectedId(null), []);
  const runFromStrip = ({ app, step }) => {
    const a = step.actions[0];
    if (a.kind === 'module' && !(a.needs === 'jd' && !app.jd)) onOpen(a.module, app);
    else { setSelectedId(app.id); setOpenDraft(a.kind === 'draft' ? a.draft : null); }
  };

  if (apps.length === 0) {
    return (
      <Card style={{ textAlign: 'center', padding: '48px 24px', borderRadius: 18 }}>
        <div style={{ fontSize: 44, marginBottom: 16 }} aria-hidden="true">📋</div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 18 }}>Your tracker is empty</div>
        <div style={{ color: SOFT, fontSize: 14, marginTop: 6, marginBottom: 22 }}>Search for jobs, then add the ones you like. Each one gets a next step.</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <GradBtn onClick={onAddClick}>+ Add a job</GradBtn>
          <GhostBtn onClick={onFind}>Search for jobs</GhostBtn>
        </div>
      </Card>
    );
  }

  // Today's best move: whatever needs you soonest, else the newest job that is still moving.
  const calm = [...groups.applied, ...groups.saved][0];
  const hero = attention[0] || (calm ? { app: calm, step: nextStep(calm, now) } : null);
  const others = hero ? attention.filter(i => i.app.id !== hero.app.id).slice(0, 2) : [];

  const phoneRows = PHONE_ORDER.flatMap(id => groups[id].map(a => ({ a, id })));
  const chips = [{ id: 'all', label: 'All', count: apps.length }, ...PHONE_ORDER.filter(id => groups[id].length).map(id => ({ id, label: SHORT_LABEL[id], count: groups[id].length }))];
  const activeFilter = chips.some(c => c.id === filter) ? filter : 'all';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div className="jh-hero">
        <Pipeline stats={stats} />
        {hero && <TodayCard item={hero} others={others} now={now} onAct={runFromStrip} onOpenJob={select} />}
      </div>

      {narrow ? (
        <section aria-label="Your jobs" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div role="group" aria-label="Show stage" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -16px', padding: '0 16px 2px' }}>
            {chips.map(c => {
              const on = activeFilter === c.id;
              return (
                <button key={c.id} type="button" className="jh-chip" aria-pressed={on} onClick={() => setFilter(c.id)}
                  style={{ flex: 'none', minHeight: 44, boxSizing: 'border-box', padding: '0 14px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'inherit', fontSize: 13, fontWeight: on ? 800 : 700, cursor: 'pointer', background: on ? '#E8F0FE' : 'transparent', color: on ? '#0B1220' : '#C7D3EA', border: `1px solid ${on ? '#E8F0FE' : '#26354F'}` }}>
                  {c.id !== 'all' && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_COLOR[c.id] }} />}
                  {c.label} {c.count}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {phoneRows.filter(r => activeFilter === 'all' || r.id === activeFilter).map(({ a, id }) => (
              <JobRow key={a.id} app={a} stage={id} selected={a.id === selectedId} onSelect={select} onAct={runFromStrip} now={now} />
            ))}
          </div>
        </section>
      ) : (
        <div className="jh-board">
          {STAGES.map(stage => (
            <section key={stage.id} aria-label={`${stage.label}, ${groups[stage.id].length}`} style={{ background: '#0F1520', borderStyle: 'solid', borderWidth: '3px 1px 1px', borderColor: `${STAGE_COLOR[stage.id]} #1E2D45 #1E2D45`, borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span title={stage.label} style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{SHORT_LABEL[stage.id]}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: SOFT, background: '#1B2740', borderRadius: 99, padding: '2px 9px' }}>{groups[stage.id].length}</span>
              </div>
              {groups[stage.id].map(a => <BoardCard key={a.id} app={a} stage={stage.id} selected={a.id === selectedId} onSelect={select} onAct={runFromStrip} now={now} />)}
              {stage.id === 'offer' && groups.offer.length === 0 && <div style={{ color: '#8D9DBA', fontSize: 12, padding: 4, lineHeight: 1.5 }}>When an offer arrives, Salary Coach opens from here.</div>}
              {stage.id === 'closed' && <div style={{ border: '1px dashed #2A3A58', borderRadius: 12, padding: '14px 12px', fontSize: 12, color: '#8D9DBA', textAlign: 'center', lineHeight: 1.5 }}>Every no gets a short recovery plan</div>}
            </section>
          ))}
        </div>
      )}

      {selected && (
        <Detail
          key={selected.id} app={selected} now={now} userName={userName} openDraft={openDraft} setOpenDraft={setOpenDraft}
          onPatch={onPatch} onStatus={onStatus} onOpen={onOpen}
          onDelete={(id) => { setSelectedId(null); onDelete(id); }} onClose={close}
        />
      )}
    </div>
  );
}
