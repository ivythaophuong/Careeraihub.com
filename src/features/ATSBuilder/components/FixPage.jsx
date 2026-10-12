import React, { useState, useRef, useEffect } from 'react';
import { fixTargets, suggestionFor, saveFix, issueStatus, nextUnresolved, firstUnresolved, summaryCounts, issueKey, fieldText, withFieldText, excerptFor } from '../fixPage.js';

// The Fix page: one issue at a time, and one thing at a time inside it.
//   First screen of an issue: the job and the few lines around the sentence, the sentence marked, and two choices (improve it, or leave it).
//   After "Improve this sentence": the edit box takes the place of the sentence; the AI draft is folded away until asked for.
//   "View full resume" shows the whole resume in the user's template, with the sentence marked and the typed text in it.
// Nothing here calls AI; the engine is applyIssue.js through fixPage.js. The page keeps its own working copy while it is open and tells the page that
// holds the data after every save (onChange). Design: docs/architecture/plans/DESIGN-fix-page-flow.md.

const SEV = { critical: '#FF5A5A', high: '#FFB84D', medium: 'var(--lp-text3)', low: 'var(--lp-text3)' };
const label = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const A4 = 794;

const css = `
.atb-fixpage [data-fix-marked] { outline: 2px solid var(--lp-teal, #2dd4bf); outline-offset: 3px; background: rgba(45, 212, 191, .14); }`;

const btn = (primary) => ({
  padding: primary ? '10px 22px' : '7px 14px', fontSize: primary ? 13 : 12, fontWeight: 800, borderRadius: 8, cursor: 'pointer',
  border: primary ? 'none' : '1px solid var(--lp-bdr)', background: primary ? 'var(--lp-teal)' : 'transparent', color: primary ? '#000' : 'var(--lp-text2)',
});
const link = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--lp-text2)', fontSize: 12, fontWeight: 700, textDecoration: 'underline' };

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

  // The place an issue points to when it is in exactly one place; for several places the user chooses.
  const placeFor = (d, pos) => {
    if (pos === null) return null;
    const t = fixTargets(d, list[pos].issue);
    return t.kind === 'one' ? t.places[0].at : null;
  };

  const [pos, setPos] = useState(startPos);
  const [chosenAt, setChosenAt] = useState(() => placeFor(data, startPos()));
  const [text, setText] = useState(() => { const a = placeFor(data, startPos()); return a ? fieldText(data, a) : ''; });
  const [improving, setImproving] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [askReplace, setAskReplace] = useState(false);
  const [askLeave, setAskLeave] = useState(false);

  const go = (nextPos, d) => {
    const a = placeFor(d, nextPos);
    setPos(nextPos); setChosenAt(a); setText(a ? fieldText(d, a) : '');
    setImproving(false); setShowWhy(false); setShowDraft(false); setFullOpen(false);
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
  const excerpt = at ? excerptFor(work, at) : null;

  // The whole resume, with the typed text in the marked place, and the mark itself.
  const shown = at && dirty ? withFieldText(work, at, text) : work;
  const markKey = at ? (at.kind === 'summary' ? 'summary' : `b:${at.exp}:${at.bullet}`) : null;
  const previewRef = useRef(null);
  const lastScrolled = useRef(null);
  useEffect(() => {
    const root = previewRef.current;
    if (!fullOpen || !root) { lastScrolled.current = null; return; }
    root.querySelectorAll('[data-fix-marked]').forEach(e => e.removeAttribute('data-fix-marked'));
    if (!markKey) return;
    const el = root.querySelector(`[data-fix-at="${markKey}"]`);
    if (!el) return;
    el.setAttribute('data-fix-marked', 'true');
    if (lastScrolled.current !== markKey && el.scrollIntoView) { lastScrolled.current = markKey; el.scrollIntoView({ block: 'center' }); }
  });

  // Fit the A4 page into the width it has.
  const boxRef = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!fullOpen || !boxRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => { const w = e.contentRect.width - 32; setScale(w > 0 && w < A4 ? w / A4 : 1); });
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [fullOpen]);

  const Template = template?.component;

  const save = () => {
    const r = saveFix(work, at, text);
    if (r.error === 'empty') { setMsg('Write the text first, or leave this one for now.'); return; }
    if (r.error) { setMsg('That place is not in your resume any more.'); return; }
    const entry = { record: r.record, placeholders: r.blanks > 0, warnings: [] };
    const nextRecs = { ...recs, [current.key]: entry };
    setWork(r.data); setRecs(nextRecs);
    onChange?.(r.data, current.key, entry);
    go(nextUnresolved(statusesFor(r.data, nextRecs), pos), r.data);
  };
  const leave = () => go(nextUnresolved(statusesFor(work, recs), pos), work);
  const back = () => { if (dirty) setAskLeave(true); else onBackToList?.(); };
  const useDraft = () => { if (dirty && text !== draft.text) setAskReplace(true); else setText(draft.text); };
  const choose = (p) => { setChosenAt(p.at); setText(fieldText(work, p.at)); setMsg(''); };

  const total = list.length;
  const counts = summaryCounts(statusesFor(work, recs));
  const others = issues.length - total;

  const lineStyle = { fontSize: 13.5, lineHeight: 1.6, color: 'var(--lp-text3)', padding: '4px 0' };

  return (
    <div className="atb-fixpage" style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 520 }}>
      <style>{css}</style>

      {pos === null ? (
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--lp-text)', marginBottom: 10 }}>Review finished</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--lp-text2)', fontSize: 14, lineHeight: 1.9 }}>
            <li>{counts.applied} applied</li>
            <li>{counts.open} open</li>
            <li>{counts.changedByYou} changed by you</li>
          </ul>
          <div style={{ fontSize: 12.5, color: 'var(--lp-text3)', lineHeight: 1.6, marginTop: 10 }}>
            These counts come from the text of your resume as it is now. An applied issue can be undone from the Suggestions panel in the Builder.
            {others > 0 && <> {others} other issue{others > 1 ? 's' : ''} {others > 1 ? 'are' : 'is'} not covered here (no text that can be found in your resume); {others > 1 ? 'they are' : 'it is'} in the Suggestions panel of the Builder.</>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button type="button" style={btn(true)} onClick={() => onOpenBuilder?.()}>Open the Builder</button>
            <button type="button" style={btn(false)} onClick={() => onBackToList?.()}>Back to list</button>
          </div>
        </div>
      ) : (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: SEV[current.issue.severity] || 'var(--lp-text3)' }}>
            Issue {pos + 1} of {total} · {label(current.issue.severity) || 'Issue'}
          </div>
          <button type="button" style={link} onClick={back}>Back to list</button>
        </div>

        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--lp-text)' }}>{current.issue.title}</div>
        <div>
          <button type="button" style={link} aria-expanded={showWhy} onClick={() => setShowWhy(v => !v)}>Why?</button>
          {showWhy && current.issue.description && <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--lp-text2)', marginTop: 6 }}>{current.issue.description}</div>}
        </div>

        {askLeave && (
          <div role="alert" style={{ padding: '10px 12px', border: '1px solid var(--lp-bdr)', borderRadius: 8, fontSize: 12.5, color: 'var(--lp-text2)' }}>
            Leave without saving your change?
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" style={btn(false)} onClick={() => setAskLeave(false)}>Stay</button>
              <button type="button" style={btn(false)} onClick={() => onBackToList?.()}>Leave</button>
            </div>
          </div>
        )}

        {targets.kind === 'none' && (<>
          <div style={{ fontSize: 13, color: '#FFB84D', lineHeight: 1.6 }}>Could not find that text in your resume any more. You can leave it, or edit the field in the Builder.</div>
          <div><button type="button" style={btn(false)} onClick={leave}>Leave it for now</button></div>
        </>)}

        {targets.kind === 'many' && !at && (
          <div style={{ fontSize: 13, color: 'var(--lp-text2)', lineHeight: 1.6 }}>
            That text is in {targets.places.length} places. Choose where to fix it:
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {targets.places.map(p => <button key={JSON.stringify(p.at)} type="button" style={btn(false)} onClick={() => choose(p)}>{p.label}</button>)}
            </div>
            <div style={{ marginTop: 12 }}><button type="button" style={btn(false)} onClick={leave}>Leave it for now</button></div>
          </div>
        )}

        {at && excerpt && (<>
          {place && !place.drawn && <div style={{ fontSize: 12.5, color: '#FFB84D', lineHeight: 1.6 }}>This text is in a job with no company name, so the full resume does not show it. You can still edit it here.</div>}

          <div data-excerpt style={{ background: 'var(--lp-bg2)', border: '1px solid var(--lp-bdr)', borderRadius: 12, padding: '14px 18px' }}>
            {excerpt.header && <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--lp-text2)', marginBottom: 6 }}>{excerpt.header}</div>}
            {excerpt.lines.map((l) => l.target ? (
              <div key={JSON.stringify(l.at)} data-fix-target style={{ margin: '6px -8px', padding: '8px 8px', borderLeft: '3px solid var(--lp-teal)', background: 'rgba(45,212,191,.08)', borderRadius: 6 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--lp-teal)', marginBottom: 4 }}>Fix this sentence</div>
                {improving ? (
                  <textarea aria-label="Your text" value={text} onChange={e => { setText(e.target.value); setMsg(''); }} rows={3}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', color: 'var(--lp-text)', borderRadius: 8, padding: '8px 12px', fontSize: 14, lineHeight: 1.5, fontFamily: 'var(--lp-ff)', resize: 'vertical' }} />
                ) : (
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--lp-text)' }}>{l.text}</div>
                )}
              </div>
            ) : (
              <div key={JSON.stringify(l.at)} style={lineStyle}>{l.text}</div>
            ))}
          </div>

          {improving && dirty && <div style={{ fontSize: 12, color: 'var(--lp-text3)' }}>Not saved yet. Your original: {saved}</div>}
          {msg && <div role="status" style={{ fontSize: 12.5, color: '#FFB84D' }}>{msg}</div>}

          {improving && draft && (<>
            <button type="button" style={{ ...link, alignSelf: 'flex-start' }} aria-expanded={showDraft} onClick={() => setShowDraft(v => !v)}>
              {showDraft ? 'Hide AI draft' : 'Show AI draft'}{!showDraft && draft.placeholders ? ' ⚠ includes figures not in your resume' : ''}
            </button>
            {showDraft && (<>
              <section aria-label="AI draft" style={{ padding: '10px 12px', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 8 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--lp-text3)', marginBottom: 4 }}>AI draft</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--lp-text2)' }}>{draft.text}</div>
                {draft.warnings.map((w, k) => <div key={k} style={{ marginTop: 6, fontSize: 12, color: '#FFB84D', lineHeight: 1.5 }}>{w}</div>)}
              </section>
              {draft.placeholders && draft.replaced?.length > 0 && (
                <div style={{ fontSize: 12.5, color: '#FFB84D', lineHeight: 1.5 }}>
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
          </>)}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
            {improving
              ? <button type="button" style={btn(true)} onClick={save}>Save &amp; next</button>
              : <button type="button" style={btn(true)} onClick={() => setImproving(true)}>Improve this sentence</button>}
            <button type="button" style={btn(false)} onClick={leave}>Leave it for now</button>
            <button type="button" style={link} onClick={() => setFullOpen(true)}>View full resume</button>
          </div>
        </>)}
      </>)}

      {fullOpen && (
        <div role="dialog" aria-modal="true" aria-label="Your resume" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--lp-bg2)', borderRadius: 12, width: 'min(900px, 100%)', maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--lp-bdr)' }}>
              <div style={{ fontSize: 12, color: 'var(--lp-text2)' }}>Your resume · Template: {template?.label}{dirty ? ' · your change is shown, not saved' : ''}</div>
              <button type="button" style={btn(false)} onClick={() => setFullOpen(false)}>Close</button>
            </div>
            <div ref={boxRef} style={{ background: '#e0e0e0', padding: 16, overflow: 'auto' }}>
              <div style={{ width: scale < 1 ? Math.round(A4 * scale) : A4, overflow: 'hidden', margin: '0 auto' }}>
                <div ref={previewRef} style={{ width: A4, transform: `scale(${scale})`, transformOrigin: 'top left', boxShadow: '0 4px 24px rgba(0,0,0,.2)' }}>
                  {Template && <Template {...shown} />}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
