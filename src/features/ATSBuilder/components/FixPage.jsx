import React, { useState, useRef, useEffect } from 'react';
import { fixTargets, suggestionFor, saveFix, issueStatus, nextUnresolved, firstUnresolved, summaryCounts, issueKey, fieldText, withFieldText } from '../fixPage.js';

// The Fix page: one issue at a time. The resume is the main element, the place to fix is marked in it, and a card beside it holds the reason, the AI
// draft and an edit box. What the user types is shown in the resume before it is saved. Nothing here calls AI; the engine is applyIssue.js through fixPage.js.
// Design: docs/architecture/plans/DESIGN-fix-page-flow.md. The page keeps its own working copy of the data while it is open and tells the page that
// holds the data after every save (onChange).

const SEV = { critical: '#FF5A5A', high: '#FFB84D', medium: 'var(--lp-text3)', low: 'var(--lp-text3)' };
const label = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const A4 = 794;

const css = `
.atb-fixpage [data-fix-marked] { outline: 2px solid var(--lp-teal, #2dd4bf); outline-offset: 3px; background: rgba(45, 212, 191, .14); }
.atb-fixpage .atb-fix-tabs { display: none; }
@media (max-width: 768px) {
  .atb-fixpage .atb-fix-tabs { display: flex; }
  .atb-fixpage .atb-fix-grid { grid-template-columns: 1fr !important; }
  .atb-fixpage .atb-fix-pane[data-active="false"] { display: none; }
}`;

const btn = (primary) => ({
  padding: primary ? '9px 20px' : '7px 14px', fontSize: 12, fontWeight: 800, borderRadius: 8, cursor: 'pointer',
  border: primary ? 'none' : '1px solid var(--lp-bdr)', background: primary ? 'var(--lp-teal)' : 'transparent', color: primary ? '#000' : 'var(--lp-text2)',
});

export default function FixPage({ data, issues = [], startKey = null, records = {}, onChange, onBackToList, onOpenBuilder, template }) {
  const [work, setWork] = useState(data);
  const [recs, setRecs] = useState(records || {});

  // The issues this page can place: found in the summary or a bullet (or already applied). Fixed when the page opens, so an issue does not
  // leave the list because its text has just been replaced.
  const [list] = useState(() => issues
    .map((issue, i) => ({ issue, i, key: issueKey(issue, i) }))
    .filter(it => records?.[it.key] || ['one', 'many'].includes(fixTargets(data, it.issue).kind)));

  const statusesFor = (d, r) => list.map(it => issueStatus(d, it.issue, r[it.key]?.record ?? null));

  const startPos = () => {
    const statuses = statusesFor(data, records || {});
    const asked = startKey ? list.findIndex(it => it.key === startKey) : -1;
    if (asked >= 0 && statuses[asked] !== 'applied') return asked;
    return firstUnresolved(statuses);
  };

  // What the edit box starts with for an issue: the user's own text of that field.
  const textFor = (d, pos) => {
    if (pos === null) return { at: null, text: '' };
    const t = fixTargets(d, list[pos].issue);
    const at = t.kind === 'one' ? t.places[0].at : null;
    return { at, text: at ? fieldText(d, at) : '' };
  };

  const [pos, setPos] = useState(startPos);
  const [chosenAt, setChosenAt] = useState(() => textFor(data, startPos()).at);   // set at once for one place; chosen by the user for several
  const [text, setText] = useState(() => textFor(data, startPos()).text);
  const [msg, setMsg] = useState('');
  const [askReplace, setAskReplace] = useState(false);
  const [askLeave, setAskLeave] = useState(false);
  const [pane, setPane] = useState('fix');

  const go = (nextPos, d) => {
    const next = textFor(d, nextPos);
    setPos(nextPos); setChosenAt(next.at); setText(next.text);
    setMsg(''); setAskReplace(false); setAskLeave(false);
  };

  const current = pos === null ? null : list[pos];
  const targets = current ? fixTargets(work, current.issue) : null;
  const at = chosenAt;
  const place = at && targets ? targets.places.find(p => JSON.stringify(p.at) === JSON.stringify(at)) : null;
  const saved = at ? fieldText(work, at) : '';
  const dirty = !!at && text !== saved;
  const suggestion = at && current ? suggestionFor(work, current.issue, at) : null;
  const draft = suggestion && !suggestion.error ? suggestion : null;

  // The resume, with the typed text in the marked place, and the mark itself.
  const shown = at && dirty ? withFieldText(work, at, text) : work;
  const markKey = at ? (at.kind === 'summary' ? 'summary' : `b:${at.exp}:${at.bullet}`) : null;
  const previewRef = useRef(null);
  const lastScrolled = useRef(null);
  useEffect(() => {
    const root = previewRef.current;
    if (!root) return;
    root.querySelectorAll('[data-fix-marked]').forEach(e => e.removeAttribute('data-fix-marked'));
    if (!markKey) return;
    const el = root.querySelector(`[data-fix-at="${markKey}"]`);
    if (!el) return;
    el.setAttribute('data-fix-marked', 'true');
    if (lastScrolled.current !== markKey + ':' + pos) { lastScrolled.current = markKey + ':' + pos; if (el.scrollIntoView) el.scrollIntoView({ block: 'center' }); }
  });

  // Fit the A4 page into the width it has, as the Builder's own preview does.
  const boxRef = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!boxRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => { const w = e.contentRect.width - 32; setScale(w > 0 && w < A4 ? w / A4 : 1); });
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, []);

  const Template = template?.component;

  const save = () => {
    const r = saveFix(work, at, text);
    if (r.error === 'empty') { setMsg('Write the text first, or use Skip.'); return; }
    if (r.error) { setMsg('That place is not in your resume any more.'); return; }
    const entry = { record: r.record, placeholders: r.blanks > 0, warnings: [] };
    const nextRecs = { ...recs, [current.key]: entry };
    setWork(r.data); setRecs(nextRecs);
    onChange?.(r.data, current.key, entry);
    go(nextUnresolved(statusesFor(r.data, nextRecs), pos), r.data);
  };
  const skip = () => go(nextUnresolved(statusesFor(work, recs), pos), work);
  const back = () => { if (dirty) setAskLeave(true); else onBackToList?.(); };
  const useDraft = () => { if (dirty && text !== draft.text) setAskReplace(true); else setText(draft.text); };
  const choose = (p) => { setChosenAt(p.at); setText(fieldText(work, p.at)); setMsg(''); };

  const total = list.length;
  const statuses = statusesFor(work, recs);
  const counts = summaryCounts(statuses);
  const others = issues.length - total;

  const card = (
    <div className="atb-fix-pane" data-pane="fix" data-active={pane === 'fix' ? 'true' : 'false'} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
      {pos === null ? (
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--lp-text)', marginBottom: 10 }}>Review finished</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--lp-text2)', fontSize: 13, lineHeight: 1.8 }}>
            <li>{counts.applied} applied</li>
            <li>{counts.open} open</li>
            <li>{counts.changedByYou} changed by you</li>
          </ul>
          <div style={{ fontSize: 12, color: 'var(--lp-text3)', lineHeight: 1.6, marginTop: 10 }}>
            These counts come from the text of your resume as it is now. An applied issue can be undone from the Suggestions panel in the Builder.
            {others > 0 && <> {others} other issue{others > 1 ? 's' : ''} {others > 1 ? 'are' : 'is'} not covered here (no text that can be found in your resume); {others > 1 ? 'they are' : 'it is'} in the Suggestions panel of the Builder.</>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" style={btn(true)} onClick={() => onOpenBuilder?.()}>Open the Builder</button>
            <button type="button" style={btn(false)} onClick={() => onBackToList?.()}>Back to list</button>
          </div>
        </div>
      ) : (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: SEV[current.issue.severity] || 'var(--lp-text3)' }}>
            Issue {pos + 1} of {total} · {label(current.issue.severity) || 'Issue'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={btn(false)} onClick={skip}>Skip</button>
            <button type="button" style={btn(false)} onClick={back}>Back to list</button>
          </div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--lp-text)' }}>{current.issue.title}</div>
        {current.issue.description && <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--lp-text2)' }}>{current.issue.description}</div>}

        {askLeave && (
          <div role="alert" style={{ padding: '10px 12px', border: '1px solid var(--lp-bdr)', borderRadius: 8, fontSize: 12.5, color: 'var(--lp-text2)' }}>
            Leave without saving your change?
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" style={btn(false)} onClick={() => setAskLeave(false)}>Stay</button>
              <button type="button" style={btn(false)} onClick={() => onBackToList?.()}>Leave</button>
            </div>
          </div>
        )}

        {targets.kind === 'none' && (
          <div style={{ fontSize: 12.5, color: '#FFB84D', lineHeight: 1.6 }}>Could not find that text in your resume any more. Use Skip, or edit the field in the Builder.</div>
        )}

        {targets.kind === 'many' && !at && (
          <div style={{ fontSize: 12.5, color: 'var(--lp-text2)', lineHeight: 1.6 }}>
            That text is in {targets.places.length} places. Choose where to fix it:
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {targets.places.map(p => <button key={JSON.stringify(p.at)} type="button" style={btn(false)} onClick={() => choose(p)}>{p.label}</button>)}
            </div>
          </div>
        )}

        {at && (<>
          {place && place.drawn && <div style={{ fontSize: 11.5, color: 'var(--lp-text3)' }}>The marked passage in your resume is the text you are editing.</div>}
          {place && !place.drawn && <div style={{ fontSize: 12, color: '#FFB84D', lineHeight: 1.6 }}>This text is in a job with no company name, so the preview does not show it. You can still edit it here.</div>}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--lp-text3)' }}>Your text</span>
            <textarea aria-label="Your text" value={text} onChange={e => { setText(e.target.value); setMsg(''); }} rows={4}
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', color: 'var(--lp-text)', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--lp-ff)', resize: 'vertical' }} />
          </label>
          {dirty && <div style={{ fontSize: 11.5, color: 'var(--lp-text3)' }}>Preview of your change, not saved. Your original: {saved}</div>}
          {msg && <div role="status" style={{ fontSize: 12, color: '#FFB84D' }}>{msg}</div>}

          {draft && (<>
            <section aria-label="AI draft" style={{ padding: '10px 12px', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 8 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--lp-text3)', marginBottom: 4 }}>AI draft</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--lp-text2)' }}>{draft.text}</div>
              {draft.warnings.map((w, k) => <div key={k} style={{ marginTop: 6, fontSize: 12, color: '#FFB84D', lineHeight: 1.5 }}>{w}</div>)}
            </section>
            {draft.placeholders && draft.replaced?.length > 0 && (
              <div style={{ fontSize: 12, color: '#FFB84D', lineHeight: 1.5 }}>
                These figures are not in your resume: {draft.replaced.join(', ')}. The draft shows [X] in their place. Put your real figure, or remove it.
              </div>
            )}
            {askReplace ? (
              <div role="alert" style={{ padding: '10px 12px', border: '1px solid var(--lp-bdr)', borderRadius: 8, fontSize: 12.5, color: 'var(--lp-text2)' }}>
                Replace what you typed with the AI draft?
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" style={btn(false)} onClick={() => { setText(draft.text); setAskReplace(false); }}>Replace</button>
                  <button type="button" style={btn(false)} onClick={() => setAskReplace(false)}>Keep mine</button>
                </div>
              </div>
            ) : (
              <button type="button" style={{ ...btn(false), alignSelf: 'flex-start' }} onClick={useDraft}>
                {draft.warnings.length ? 'Use suggestion — I confirm this is true' : 'Use suggestion'}
              </button>
            )}
          </>)}

          <button type="button" style={{ ...btn(true), alignSelf: 'flex-start', marginTop: 4 }} onClick={save}>Save &amp; next</button>
        </>)}
      </>)}
    </div>
  );

  return (
    <div className="atb-fixpage" style={{ display: 'flex', flexDirection: 'column', minHeight: 640 }}>
      <style>{css}</style>
      <div role="tablist" aria-label="Fix page" className="atb-fix-tabs" style={{ gap: 6, padding: '8px 14px', borderBottom: '1px solid var(--lp-bdr)' }}>
        <button type="button" role="tab" aria-selected={pane === 'resume'} style={btn(pane === 'resume')} onClick={() => setPane('resume')}>Resume</button>
        <button type="button" role="tab" aria-selected={pane === 'fix'} style={btn(pane === 'fix')} onClick={() => setPane('fix')}>Fix</button>
      </div>
      <div className="atb-fix-grid" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', flex: 1 }}>
        <div className="atb-fix-pane" data-pane="resume" data-active={pane === 'resume' ? 'true' : 'false'} ref={boxRef} style={{ background: '#e0e0e0', padding: 16, overflow: 'auto' }}>
          <div style={{ fontSize: 9, color: '#777', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginBottom: 10 }}>
            Your resume · Template: {template?.label}
          </div>
          <div style={{ width: scale < 1 ? Math.round(A4 * scale) : A4, overflow: 'hidden', margin: '0 auto' }}>
            <div ref={previewRef} style={{ width: A4, transform: `scale(${scale})`, transformOrigin: 'top left', boxShadow: '0 4px 24px rgba(0,0,0,.2)' }}>
              {Template && <Template {...shown} />}
            </div>
          </div>
        </div>
        {card}
      </div>
    </div>
  );
}
