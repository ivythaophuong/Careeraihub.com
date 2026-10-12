import React, { useState, useRef, useEffect } from 'react';
import { fixTargets, suggestionFor, saveFix, issueStatus, nextUnresolved, firstUnresolved, summaryCounts, issueKey, fieldText, withFieldText } from '../fixPage.js';

// The Fix page: your resume on the left, with the sentences that can be improved highlighted; your new resume on the right, which follows what you type;
// and one editor below them. One issue at a time, and one thing at a time inside the editor: first two choices (improve it, or leave it), then the edit box,
// with the AI draft folded away until asked for. Choosing a template is another screen (the Templates tab).
// Nothing here calls AI; the engine is applyIssue.js through fixPage.js. The page keeps its own working copy while it is open and tells the page that
// holds the data after every save (onChange). Design: docs/architecture/plans/DESIGN-fix-page-flow.md.

const SEV = { critical: '#FF5A5A', high: '#FFB84D', medium: 'var(--lp-text3)', low: 'var(--lp-text3)' };
const label = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const A4 = 794;
const markKeyOf = (at) => (at.kind === 'summary' ? 'summary' : `b:${at.exp}:${at.bullet}`);

const css = `
.atb-fixpage [data-fix-marked] { outline: 2px solid var(--lp-teal, #2dd4bf); outline-offset: 3px; background: rgba(45, 212, 191, .14); }
.atb-fixpage [data-fix-open] { outline: 2px dashed #FFB84D; outline-offset: 3px; cursor: pointer; }
.atb-fixpage [data-fix-done] { outline: 2px solid #00E5A0; outline-offset: 3px; }
.atb-fixpage .atb-fix-tabs { display: none; }
@media (max-width: 768px) {
  .atb-fixpage .atb-fix-tabs { display: flex; }
  .atb-fixpage .atb-fix-panes { grid-template-columns: 1fr !important; }
  .atb-fixpage .atb-fix-pane[data-active="false"] { display: none; }
}`;

const btn = (primary) => ({
  padding: primary ? '10px 22px' : '7px 14px', fontSize: primary ? 13 : 12, fontWeight: 800, borderRadius: 8, cursor: 'pointer',
  border: primary ? 'none' : '1px solid var(--lp-bdr)', background: primary ? 'var(--lp-teal)' : 'transparent', color: primary ? '#000' : 'var(--lp-text2)',
});
const link = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--lp-text2)', fontSize: 12, fontWeight: 700, textDecoration: 'underline' };

// One resume, drawn in the template, scaled to its width. `marks` = [{ key, state: 'marked' | 'open' | 'done', label }], put on the elements the template
// tags with data-fix-at. When `onPick` is given, a marked sentence can be clicked or opened from the keyboard.
function ResumePane({ name, panel, hint, data, Template, templateId, marks, activeKey, onPick, active }) {
  const boxRef = useRef(null);
  const previewRef = useRef(null);
  const lastScrolled = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!boxRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => { const w = e.contentRect.width - 32; setScale(w > 0 && w < A4 ? w / A4 : 1); });
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const root = previewRef.current;
    if (!root) return;
    root.querySelectorAll('[data-fix-at]').forEach(el => {
      ['data-fix-marked', 'data-fix-open', 'data-fix-done', 'role', 'tabindex', 'aria-label'].forEach(a => el.removeAttribute(a));
    });
    for (const m of marks) {
      const el = root.querySelector(`[data-fix-at="${m.key}"]`);
      if (!el) continue;
      el.setAttribute(`data-fix-${m.state}`, 'true');
      if (onPick && m.state !== 'done') { el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('aria-label', m.label); }
    }
    if (activeKey && lastScrolled.current !== activeKey) {
      lastScrolled.current = activeKey;
      const el = root.querySelector(`[data-fix-at="${activeKey}"]`);
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
    }
    if (!activeKey) lastScrolled.current = null;
  });

  const pick = (e) => {
    const el = e.target.closest?.('[data-fix-at]');
    if (el && onPick) onPick(el.getAttribute('data-fix-at'));
  };
  const key = (e) => { if (e.key === 'Enter' || e.key === ' ') { const el = e.target.closest?.('[data-fix-at]'); if (el && onPick) { e.preventDefault(); onPick(el.getAttribute('data-fix-at')); } } };

  return (
    <section aria-label={name} className="atb-fix-pane" data-pane={panel} data-active={active ? 'true' : 'false'} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--lp-text3)', lineHeight: 1.5, padding: '0 4px 8px' }}>{hint}</div>
      <div ref={boxRef} style={{ background: '#e0e0e0', padding: 16, overflow: 'auto', maxHeight: '62vh', borderRadius: 10 }}>
        <div style={{ width: scale < 1 ? Math.round(A4 * scale) : A4, overflow: 'hidden', margin: '0 auto' }}>
          <div ref={previewRef} data-template={templateId} onClick={pick} onKeyDown={key}
            style={{ width: A4, transform: `scale(${scale})`, transformOrigin: 'top left', boxShadow: '0 4px 24px rgba(0,0,0,.2)' }}>
            {Template && <Template {...data} />}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function FixPage({ data, issues = [], startKey = null, records = {}, onChange, onBackToList, onOpenBuilder, onChooseTemplate, template }) {
  const [work, setWork] = useState(data);
  const [recs, setRecs] = useState(records || {});

  // The issues this page can place: found in the summary or a bullet (or already applied). Fixed when the page opens, so an issue does not
  // leave the list because its text has just been replaced.
  const [list] = useState(() => issues
    .map((issue, i) => ({ issue, i, key: issueKey(issue, i) }))
    .filter(it => records?.[it.key] || ['one', 'many'].includes(fixTargets(data, it.issue).kind)));

  // Where each issue's sentence is in the resume as it was when the page opened: this is what the left resume highlights.
  const [seed] = useState(() => {
    const out = [];
    list.forEach((it, itemPos) => fixTargets(data, it.issue).places.forEach(p => out.push({ key: markKeyOf(p.at), itemPos, at: p.at })));
    return out;
  });
  const [original] = useState(data);

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
  const [msg, setMsg] = useState('');
  const [askReplace, setAskReplace] = useState(false);
  const [askLeave, setAskLeave] = useState(false);
  const [pendingPick, setPendingPick] = useState(null);
  const [pane, setPane] = useState('original');

  const go = (nextPos, d, chosen) => {
    const a = chosen || placeFor(d, nextPos);
    setPos(nextPos); setChosenAt(a); setText(a ? fieldText(d, a) : '');
    setImproving(false); setShowWhy(false); setShowDraft(false);
    setMsg(''); setAskReplace(false); setAskLeave(false); setPendingPick(null);
  };

  const current = pos === null ? null : list[pos];
  const targets = current ? fixTargets(work, current.issue) : null;
  const at = chosenAt;
  const place = at && targets ? targets.places.find(p => JSON.stringify(p.at) === JSON.stringify(at)) : null;
  const saved = at ? fieldText(work, at) : '';
  const dirty = !!at && text !== saved;
  const suggestion = at && current ? suggestionFor(work, current.issue, at) : null;
  const draft = suggestion && !suggestion.error ? suggestion : null;

  const statuses = statusesFor(work, recs);
  const activeKey = at ? markKeyOf(at) : null;
  const shown = at && dirty ? withFieldText(work, at, text) : work;     // the new resume: what is saved, plus what is being typed

  // Marks on the left resume (as it was): the sentence being fixed, the other sentences that can be improved, and the ones already improved.
  const seen = new Set();
  const leftMarks = seed.filter(m => (seen.has(m.key) ? false : (seen.add(m.key), true))).map(m => {
    const title = list[m.itemPos].issue.title;
    if (m.key === activeKey) return { key: m.key, state: 'marked', label: `Fixing: ${title}` };
    const done = ['applied', 'applied_edited'].includes(statuses[m.itemPos]);
    return { key: m.key, state: done ? 'done' : 'open', label: `${done ? 'Improved' : 'Fix'}: ${title}` };
  });
  const rightMarks = activeKey ? [{ key: activeKey, state: 'marked', label: '' }] : [];

  const openItem = (itemPos, chosen) => go(itemPos, work, chosen);
  const pick = (key) => {
    const m = seed.find(x => x.key === key);
    if (!m || ['applied', 'applied_edited'].includes(statuses[m.itemPos])) return;
    const many = fixTargets(work, list[m.itemPos].issue).kind === 'many';
    if (m.itemPos === pos && (!many || key === activeKey)) return;
    if (dirty) { setPendingPick({ itemPos: m.itemPos, at: many ? m.at : undefined }); return; }
    openItem(m.itemPos, many ? m.at : undefined);
  };

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
  const leave = () => go(nextUnresolved(statuses, pos), work);
  const back = () => { if (dirty) setAskLeave(true); else onBackToList?.(); };
  const useDraft = () => { if (dirty && text !== draft.text) setAskReplace(true); else setText(draft.text); };
  const choose = (p) => { setChosenAt(p.at); setText(fieldText(work, p.at)); setMsg(''); };

  const total = list.length;
  const counts = summaryCounts(statuses);
  const others = issues.length - total;

  const prompt = (question, stay, go_, goLabel) => (
    <div role="alert" style={{ padding: '10px 12px', border: '1px solid var(--lp-bdr)', borderRadius: 8, fontSize: 12.5, color: 'var(--lp-text2)' }}>
      {question}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" style={btn(false)} onClick={stay}>Stay</button>
        <button type="button" style={btn(false)} onClick={go_}>{goLabel}</button>
      </div>
    </div>
  );

  if (pos === null) {
    return (
      <div className="atb-fixpage" style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px', minHeight: 360 }}>
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
        {onChooseTemplate && (
          <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--lp-bdr)' }}>
            <div style={{ fontSize: 13, color: 'var(--lp-text2)', marginBottom: 8 }}>Happy with the text? See your resume in other layouts.</div>
            <button type="button" style={btn(false)} onClick={() => onChooseTemplate()}>Choose a template that suits you</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="atb-fixpage" style={{ maxWidth: 1240, margin: '0 auto', padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{css}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: SEV[current.issue.severity] || 'var(--lp-text3)' }}>
          Issue {pos + 1} of {total} · {label(current.issue.severity) || 'Issue'}
        </div>
        <button type="button" style={link} onClick={back}>Back to list</button>
      </div>

      <div role="tablist" aria-label="Resumes" className="atb-fix-tabs" style={{ gap: 6 }}>
        <button type="button" role="tab" aria-selected={pane === 'original'} style={btn(pane === 'original')} onClick={() => setPane('original')}>Your resume</button>
        <button type="button" role="tab" aria-selected={pane === 'new'} style={btn(pane === 'new')} onClick={() => setPane('new')}>New resume</button>
      </div>

      <div className="atb-fix-panes" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ResumePane name="Your resume" panel="original" active={pane === 'original'} hint="Highlighted sentences can be improved. Click one to work on it."
          data={original} Template={Template} templateId={template?.id} marks={leftMarks} activeKey={activeKey} onPick={pick} />
        <ResumePane name="Your new resume" panel="new" active={pane === 'new'} hint="Your changes appear here as you type."
          data={shown} Template={Template} templateId={template?.id} marks={rightMarks} activeKey={activeKey} />
      </div>

      <div role="region" aria-label="Editor" style={{ position: 'sticky', bottom: 0, background: 'var(--lp-bg2)', border: '1px solid var(--lp-bdr)', borderRadius: '12px 12px 0 0', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 -6px 18px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--lp-text)' }}>{current.issue.title}</div>
          <button type="button" style={link} aria-expanded={showWhy} onClick={() => setShowWhy(v => !v)}>Why?</button>
        </div>
        {showWhy && current.issue.description && <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--lp-text2)' }}>{current.issue.description}</div>}

        {askLeave && prompt('Leave without saving your change?', () => setAskLeave(false), () => onBackToList?.(), 'Leave')}
        {pendingPick && prompt('Open another sentence without saving your change?', () => setPendingPick(null), () => openItem(pendingPick.itemPos, pendingPick.at), 'Switch')}

        {targets.kind === 'none' && (<>
          <div style={{ fontSize: 13, color: '#FFB84D', lineHeight: 1.6 }}>Could not find that text in your resume any more. You can leave it, or edit the field in the Builder.</div>
          <div><button type="button" style={btn(false)} onClick={leave}>Leave it for now</button></div>
        </>)}

        {targets.kind === 'many' && !at && (
          <div style={{ fontSize: 13, color: 'var(--lp-text2)', lineHeight: 1.6 }}>
            That text is in {targets.places.length} places, highlighted in your resume. Click one, or choose here:
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {targets.places.map(p => <button key={JSON.stringify(p.at)} type="button" style={btn(false)} onClick={() => choose(p)}>{p.label}</button>)}
            </div>
            <div style={{ marginTop: 12 }}><button type="button" style={btn(false)} onClick={leave}>Leave it for now</button></div>
          </div>
        )}

        {at && (<>
          {place && !place.drawn && <div style={{ fontSize: 12.5, color: '#FFB84D', lineHeight: 1.6 }}>This text is in a job with no company name, so the resume does not show it. You can still edit it here.</div>}

          {improving && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--lp-text3)' }}>Your text</span>
              <textarea aria-label="Your text" value={text} onChange={e => { setText(e.target.value); setMsg(''); }} rows={3}
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', color: 'var(--lp-text)', borderRadius: 8, padding: '8px 12px', fontSize: 14, lineHeight: 1.5, fontFamily: 'var(--lp-ff)', resize: 'vertical' }} />
            </label>
          )}
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
              {askReplace
                ? prompt('Replace what you typed with the AI draft?', () => setAskReplace(false), () => { setText(draft.text); setAskReplace(false); }, 'Replace')
                : (
                  <button type="button" style={{ ...btn(false), alignSelf: 'flex-start' }} onClick={useDraft}>
                    {draft.warnings.length ? 'Use suggestion — I confirm this is true' : 'Use suggestion'}
                  </button>
                )}
            </>)}
          </>)}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {improving
              ? <button type="button" style={btn(true)} onClick={save}>Save &amp; next</button>
              : <button type="button" style={btn(true)} onClick={() => setImproving(true)}>Improve this sentence</button>}
            <button type="button" style={btn(false)} onClick={leave}>Leave it for now</button>
          </div>
        </>)}
      </div>
    </div>
  );
}
