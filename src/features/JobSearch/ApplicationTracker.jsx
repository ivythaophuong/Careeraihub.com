import React, { useState } from 'react';
import { C } from '../../styles/theme';
import { Card, Btn, Badge } from '../../components/CommonUI';
import {
  STAGES, STATUS_LIST, STATUS_LABEL, groupByStage, stageOf, pipelineStats, nextStep, attentionList,
  followUpDraft, thankYouDraft, appliedOn, daysSince, daysUntil, agoText, toDay,
} from './jobTracker';

const SOFT = '#9FB0CC'; // secondary text that stays readable on the dark cards
const STAGE_COLOR = { saved: C.muted, applied: C.accent, noreply: C.purple, interviewing: C.gold, offer: C.green, closed: C.red };

const fieldStyle = { width: '100%', boxSizing: 'border-box', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: '10px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit' };
const labelStyle = { display: 'block', color: SOFT, fontSize: 11, fontWeight: 700, marginBottom: 6 };
const safeLink = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);

// ── Rejection Coach ──────────────────────────────────────────────────────────
export function RejectionCoach({ rejection }) {
  return (
    <div style={{ marginTop: 12, padding: '12px 14px', background: C.red + '08', borderLeft: `3px solid ${C.red}`, borderRadius: '0 8px 8px 0' }}>
      <div style={{ color: C.red, fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Recovery Tips</div>
      <div style={{ color: C.text, fontSize: 12, lineHeight: 1.6 }}>
        Don't let {rejection.company} slow you down. Rejections are a normal part of a job search, and each one is a chance to learn something for the next application.
        <span style={{ color: C.gold, display: 'block', marginTop: 4 }}>💡 Pro Tip: Send a "Thank you & Feedback" note to the recruiter to stay in their talent pool.</span>
      </div>
    </div>
  );
}

// ── Add a job ────────────────────────────────────────────────────────────────
// `onSave(fields, { checkFit })`. A link alone cannot be read (the app does not fetch job pages), so checking fit needs pasted text.
export function AddJobForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState({ company: '', role: '', link: '', jd: '', status: 'Saved', ...initial });
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
    <Card style={{ border: `1px solid ${C.green}44`, background: C.green + '05' }}>
      <div style={{ color: C.text, fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Add a job you found</div>
      <div style={{ color: SOFT, fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>Paste the job link or the job description, then add the company and role. Nothing is saved until you add it.</div>
      <label style={labelStyle} htmlFor="jt-paste">Job link or description</label>
      <textarea id="jt-paste" value={paste} onChange={onPaste} rows={3} placeholder="Paste here" style={{ ...fieldStyle, resize: 'vertical', marginBottom: 12 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div><label style={labelStyle} htmlFor="jt-company">Company</label><input id="jt-company" value={f.company} onChange={set('company')} style={fieldStyle} /></div>
        <div><label style={labelStyle} htmlFor="jt-role">Role</label><input id="jt-role" value={f.role} onChange={set('role')} style={fieldStyle} /></div>
        <div>
          <label style={labelStyle} htmlFor="jt-status">Where is it now?</label>
          <select id="jt-status" value={f.status} onChange={set('status')} style={fieldStyle}>
            <option value="Saved">Saved, not applied yet</option>
            <option value="Applied">I already applied</option>
          </select>
        </div>
      </div>
      {f.link && <div style={{ color: SOFT, fontSize: 11, marginBottom: 10, wordBreak: 'break-all' }}>Link: {f.link}</div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Btn onClick={() => submit(false)} color={C.green} dark style={{ minHeight: 44 }}>Add to tracker</Btn>
        <Btn onClick={() => submit(true)} disabled={!f.jd.trim()} color={C.accent} style={{ minHeight: 44 }}>Add and check my fit</Btn>
        {onCancel && <Btn onClick={onCancel} color={C.muted} style={{ minHeight: 44 }}>Cancel</Btn>}
      </div>
      {!f.jd.trim() && <div style={{ color: SOFT, fontSize: 11, marginTop: 8 }}>To check your fit, paste the job description text. A link alone cannot be read.</div>}
      {err && <div role="alert" style={{ color: C.red, fontSize: 12, marginTop: 10 }}>⚠️ {err}</div>}
    </Card>
  );
}

// ── Board card ───────────────────────────────────────────────────────────────
function cardMeta(app, stage, now) {
  const when = daysSince(appliedOn(app), now);
  switch (stage) {
    case 'saved': return { text: `Saved ${agoText(daysSince(app.savedOn || app.date, now))}`, color: SOFT };
    case 'applied': return { text: `Applied ${agoText(when)}`, color: SOFT };
    case 'noreply': return { text: `Applied ${agoText(when)}`, color: SOFT };
    case 'interviewing': {
      const left = daysUntil(app.interviewDate, now);
      if (left == null) return { text: 'Add the interview date', color: SOFT };
      return { text: left < 0 ? `Interview was ${agoText(-left)}` : left === 0 ? 'Interview today' : `Interview in ${left} day${left === 1 ? '' : 's'}`, color: C.gold };
    }
    case 'offer': return { text: 'Offer received', color: C.green };
    default: return { text: 'Rejected / closed', color: '#FF8A94' };
  }
}

function BoardCard({ app, stage, selected, onSelect, now }) {
  const meta = cardMeta(app, stage, now);
  const step = nextStep(app, now);
  return (
    <button
      type="button"
      onClick={() => onSelect(app.id)}
      aria-pressed={selected}
      aria-label={`${app.company}, ${app.role}. ${meta.text}`}
      style={{ textAlign: 'left', width: '100%', cursor: 'pointer', font: 'inherit', background: C.card, color: C.text, borderRadius: 12, padding: 12, border: `1px solid ${selected ? STAGE_COLOR[stage] : C.border}`, minHeight: 44 }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{app.company}</div>
      <div style={{ fontSize: 12, color: SOFT }}>{app.role}</div>
      <div style={{ fontSize: 11, marginTop: 8, color: meta.color, fontWeight: stage === 'interviewing' ? 700 : 500 }}>{meta.text}</div>
      {app.fitScore != null && <div style={{ fontSize: 11, marginTop: 4, color: SOFT }}>AI fit estimate {app.fitScore}%</div>}
      {stage === 'noreply' && app.status !== 'Follow-up' && <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: '#DDD6FE', background: C.purple + '22', borderRadius: 6, padding: '4px 8px', display: 'inline-block' }}>{step.actions[0].label}</div>}
    </button>
  );
}

// ── Detail panel ─────────────────────────────────────────────────────────────
function Detail({ app, now, userName, openDraft, setOpenDraft, onPatch, onStatus, onDelete, onOpen, onClose }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const stage = stageOf(app, now);
  const step = nextStep(app, now);
  const link = safeLink(app.link);
  const draftText = openDraft === 'thankYou' ? thankYouDraft(app, userName) : openDraft === 'followUp' ? followUpDraft(app, userName) : '';

  const run = (a) => {
    if (a.kind === 'module') onOpen(a.module, app);
    else if (a.kind === 'draft') setOpenDraft(openDraft === a.draft ? null : a.draft);
    else if (a.kind === 'status') onStatus(app.id, a.status);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(draftText); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked: the text stays selectable */ }
  };

  const events = [
    app.savedOn || (app.status === 'Saved' ? toDay(app.date) : null) ? { k: 'Saved', d: app.savedOn || toDay(app.date) } : null,
    appliedOn(app) && app.status !== 'Saved' ? { k: 'Applied', d: appliedOn(app) } : null,
    app.followedUpOn ? { k: 'Followed up', d: app.followedUpOn } : null,
    app.interviewDate ? { k: 'Interview', d: app.interviewDate } : null,
    app.closedOn ? { k: 'Closed', d: app.closedOn } : null,
  ].filter(Boolean);

  return (
    <Card style={{ border: `1px solid ${STAGE_COLOR[stage]}66` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: C.text, fontWeight: 900, fontSize: 18 }}>{app.company}</div>
          <div style={{ color: SOFT, fontSize: 13, marginTop: 2 }}>
            {app.role}{link && <> · <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: C.accent }}>Open the job ↗</a></>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={labelStyle} htmlFor={`jt-st-${app.id}`}>Status</label>
            <select id={`jt-st-${app.id}`} value={STATUS_LIST.includes(app.status) ? app.status : 'Applied'} onChange={e => onStatus(app.id, e.target.value)} style={{ ...fieldStyle, width: 'auto', minHeight: 44, borderColor: STAGE_COLOR[stage] }}>
              {STATUS_LIST.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <Btn onClick={onClose} color={C.muted} style={{ minHeight: 44 }}>Close</Btn>
        </div>
      </div>

      {/* Next best step */}
      <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: C.purple + '12', border: `1px solid ${C.purple}44` }}>
        <div style={{ color: '#C4B5FD', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Your next best step</div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 15, marginTop: 4 }}>{step.title}</div>
        <div style={{ color: SOFT, fontSize: 12, lineHeight: 1.6, marginTop: 2 }}>{step.why}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {step.actions.map((a, i) => (
            <Btn key={a.id} onClick={() => run(a)} disabled={a.needs === 'jd' && !app.jd} color={i === 0 ? C.accent : C.muted} dark={i === 0 && !(a.needs === 'jd' && !app.jd)} style={{ minHeight: 44, padding: '8px 16px' }}>{a.label}</Btn>
          ))}
        </div>
        {draftText && (
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle} htmlFor={`jt-draft-${app.id}`}>Draft (edit before you send)</label>
            <textarea id={`jt-draft-${app.id}`} readOnly value={draftText} rows={9} style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.5 }} />
            <Btn onClick={copy} color={C.green} style={{ marginTop: 8, minHeight: 44 }}>{copied ? 'Copied' : 'Copy draft'}</Btn>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 16 }}>
        <div>
          {app.status === 'Interviewing' && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle} htmlFor={`jt-int-${app.id}`}>Interview date</label>
              <input id={`jt-int-${app.id}`} type="date" value={toDay(app.interviewDate) || ''} onChange={e => onPatch(app.id, { interviewDate: e.target.value || null })} style={{ ...fieldStyle, minHeight: 44 }} />
            </div>
          )}
          <label style={labelStyle} htmlFor={`jt-notes-${app.id}`}>{stage === 'closed' ? 'What did you learn?' : 'Notes'}</label>
          <textarea id={`jt-notes-${app.id}`} defaultValue={app.notes || ''} onBlur={e => { if (e.target.value !== (app.notes || '')) onPatch(app.id, { notes: e.target.value }); }} rows={4} style={{ ...fieldStyle, resize: 'vertical' }} />
          <label style={{ ...labelStyle, marginTop: 12 }} htmlFor={`jt-jd-${app.id}`}>Job description {app.fitScore != null && <span style={{ fontWeight: 500 }}>· AI fit estimate {app.fitScore}%</span>}</label>
          <textarea id={`jt-jd-${app.id}`} defaultValue={app.jd || ''} onBlur={e => { if (e.target.value.trim() !== (app.jd || '')) onPatch(app.id, { jd: e.target.value.trim() }); }} rows={4} placeholder="Paste the description to check your fit and practise for this job" style={{ ...fieldStyle, resize: 'vertical' }} />
        </div>
        <div>
          <div style={labelStyle}>Timeline</div>
          {events.length === 0 && <div style={{ color: SOFT, fontSize: 12 }}>No dates yet.</div>}
          {events.map(ev => (
            <div key={ev.k} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 13, padding: '5px 0' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, flexShrink: 0 }} />
              <span style={{ color: C.text, fontWeight: 600 }}>{ev.k}</span><span style={{ color: SOFT }}>{ev.d}</span>
            </div>
          ))}
          <div style={{ marginTop: 16 }}>
            {!confirmDelete
              ? <Btn onClick={() => setConfirmDelete(true)} color={C.red} style={{ minHeight: 44 }}>Delete this job</Btn>
              : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn onClick={() => onDelete(app.id)} color={C.red} dark style={{ minHeight: 44 }}>Yes, delete</Btn>
                  <Btn onClick={() => setConfirmDelete(false)} color={C.muted} style={{ minHeight: 44 }}>Keep it</Btn>
                </div>}
          </div>
        </div>
      </div>
      {stage === 'closed' && <RejectionCoach rejection={app} />}
    </Card>
  );
}

// ── Tracker ──────────────────────────────────────────────────────────────────
export default function ApplicationTracker({ apps, now = new Date(), userName = '', onPatch, onStatus, onDelete, onOpen, onAddClick, onFind }) {
  const [selectedId, setSelectedId] = useState(null);
  const [openDraft, setOpenDraft] = useState(null);
  const selected = apps.find(a => a.id === selectedId) || null;
  const stats = pipelineStats(apps);
  const groups = groupByStage(apps, now);
  const attention = attentionList(apps, now);

  const select = (id) => { setSelectedId(id === selectedId ? null : id); setOpenDraft(null); };
  const runFromStrip = ({ app, step }) => {
    const a = step.actions[0];
    if (a.kind === 'module' && !(a.needs === 'jd' && !app.jd)) onOpen(a.module, app);
    else { setSelectedId(app.id); setOpenDraft(a.kind === 'draft' ? a.draft : null); }
  };

  if (apps.length === 0) {
    return (
      <Card style={{ textAlign: 'center', padding: 48 }}>
        <div style={{ fontSize: 44, marginBottom: 16 }} aria-hidden="true">📋</div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>Your tracker is empty</div>
        <div style={{ color: SOFT, fontSize: 13, marginTop: 4, marginBottom: 20 }}>Search for jobs, then add the ones you like. Each one gets a next step.</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Btn onClick={onAddClick} color={C.green} dark style={{ minHeight: 44 }}>+ Add a job</Btn>
          <Btn onClick={onFind} color={C.accent} style={{ minHeight: 44 }}>Find jobs</Btn>
        </div>
      </Card>
    );
  }

  const statCard = (label, value, sub) => (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px' }}>
      <div style={{ color: SOFT, fontSize: 12 }}>{label}</div>
      <div style={{ color: C.text, fontSize: 24, fontWeight: 800, marginTop: 2 }}>{value}{sub && <span style={{ fontSize: 12, fontWeight: 500, color: SOFT }}> {sub}</span>}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ color: "var(--lp-text)", fontWeight: 900, fontSize: 18 }}>Active Pipeline</div>
        <Btn onClick={onAddClick} color={C.green} dark style={{ padding: '8px 16px', fontSize: 12, minHeight: 44 }}>+ Add Job</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {statCard('Applied', stats.applied)}
        {statCard('Heard back', stats.heardBack, stats.applied ? `of ${stats.applied}` : '')}
        {statCard('Interviews', stats.interviews)}
        {statCard('Offers', stats.offers)}
      </div>

      {attention.length > 0 && (
        <div style={{ background: '#1F1030', border: `1px solid ${C.purple}55`, borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ color: '#C4B5FD', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Do this next</div>
          {attention.map(item => (
            <div key={item.app.id} style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', padding: '6px 0' }}>
              <div style={{ color: C.text, fontSize: 13, flex: '1 1 240px' }}><strong>{item.app.company}</strong> · {item.step.title}</div>
              <Btn onClick={() => runFromStrip(item)} color={C.accent} dark style={{ minHeight: 44, padding: '8px 16px', fontSize: 12 }}>{item.step.actions[0].label}</Btn>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <Detail
          key={selected.id} app={selected} now={now} userName={userName} openDraft={openDraft} setOpenDraft={setOpenDraft}
          onPatch={onPatch} onStatus={onStatus} onOpen={onOpen}
          onDelete={(id) => { setSelectedId(null); onDelete(id); }} onClose={() => setSelectedId(null)}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, alignItems: 'start' }}>
        {STAGES.map(stage => (
          <section key={stage.id} aria-label={`${stage.label}, ${groups[stage.id].length}`} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px' }}>
              <Badge label={stage.label} color={STAGE_COLOR[stage.id]} />
              <span style={{ color: SOFT, fontSize: 12, fontWeight: 700 }}>{groups[stage.id].length}</span>
            </div>
            {groups[stage.id].map(a => <BoardCard key={a.id} app={a} stage={stage.id} selected={a.id === selectedId} onSelect={select} now={now} />)}
            {groups[stage.id].length === 0 && stage.id === 'offer' && <div style={{ color: SOFT, fontSize: 12, padding: 8, lineHeight: 1.5 }}>When an offer arrives, Salary Coach opens from here.</div>}
          </section>
        ))}
      </div>
    </div>
  );
}
