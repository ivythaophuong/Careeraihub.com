import React, { useState, useEffect } from 'react';
import { locateAll, applyIssue, undoApply } from '../applyIssue.js';

const SEV = { critical: '#FF5A5A', high: '#FFB84D', medium: 'var(--lp-text3)' };
const btn = { background: 'none', border: '1px solid var(--lp-teal)', color: 'var(--lp-teal)', borderRadius: 7, padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' };

const keyOf = (issue, i) => `${i}:${issue.title || ''}:${issue.before || ''}`;
const loadRecords = (storageKey) => {
  if (!storageKey) return {};
  try { return JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { return {}; }
};

// The AI's issues for this resume (a fixed list: nothing new is added while the user edits), each with a before/after.
// Apply puts the suggestion in the matching field only when the quoted text is found; when it is in several places the user
// chooses. Figures the resume does not already contain become [X]. Everything is a proposal the user accepts, and can undo.
// The status of each card comes from the current text: Applied, Open, or Changed by you. The panel never says "Resolved".
export default function BuilderIssuesPanel({ issues, data, onChange, onGoToStep, storageKey }) {
  const [applied, setApplied] = useState(() => loadRecords(storageKey)); // key -> { record, placeholders }
  const [notes, setNotes] = useState({});

  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(applied)); } catch { /* storage unavailable: the records live for this visit only */ }
  }, [applied, storageKey]);

  if (!issues?.length) return null;

  const remember = (k, v) => setApplied(a => ({ ...a, [k]: v }));
  const apply = (issue, k, chosen) => {
    const r = applyIssue(data, issue, chosen);
    if (r.error) { setNotes(n => ({ ...n, [k]: 'Could not find that text in your resume any more.' })); return; }
    onChange(r.data);
    remember(k, { record: r.record, placeholders: r.placeholders });
    setNotes(n => ({ ...n, [k]: '' }));
  };
  const undo = (k) => {
    const back = undoApply(data, applied[k].record);
    if (!back) { setNotes(n => ({ ...n, [k]: 'That text changed, so it cannot be undone automatically. Edit it by hand.' })); return; }
    onChange(back);
    setApplied(a => { const c = { ...a }; delete c[k]; return c; });
    setNotes(n => ({ ...n, [k]: '' }));
  };

  return (
    <section aria-label="Suggestions from the AI" style={{ margin: '0 14px 10px', padding: '10px 12px', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 10, fontSize: 12, color: 'var(--lp-text2)' }}>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--lp-text3)', marginBottom: 4 }}>Suggestions ({issues.length})</div>
      <div style={{ color: 'var(--lp-text3)', lineHeight: 1.5, marginBottom: 8 }}>
        These are AI drafts. Check that every figure and claim is true before you keep it.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {issues.map((issue, i) => {
          const k = keyOf(issue, i);
          const rec = applied[k];
          const canUndo = !!rec && undoApply(data, rec.record) !== null;
          const hits = rec || !issue.before || !issue.after ? [] : locateAll(data, issue.before);
          const quoteGone = !rec && !!issue.before && hits.length === 0;
          const status = rec ? (canUndo ? 'Applied' : 'Applied, then edited by you')
            : quoteGone ? 'Changed by you: check it still applies'
            : 'Open';
          const canJump = !rec && Number.isInteger(issue.builderStep) && hits.length !== 1;
          return (
            <div key={k} data-issue={i} style={{ borderLeft: `3px solid ${SEV[issue.severity] || SEV.medium}`, paddingLeft: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontWeight: 700, color: 'var(--lp-text)' }}>{issue.title}</div>
              <div style={{ color: rec ? '#00E5A0' : 'var(--lp-text3)', fontWeight: 700, fontSize: 11 }}>{status}</div>
              <div style={{ lineHeight: 1.5 }}>{issue.description}</div>
              {issue.before && <div><strong>Now:</strong> <span>{issue.before}</span></div>}
              {issue.after && <div><strong>Suggested:</strong> <span>{issue.after}</span></div>}
              {rec?.placeholders && <div style={{ color: '#FFB84D' }}>Replace [X] with your real figure, or remove it.</div>}
              {notes[k] && <div style={{ color: '#FFB84D' }}>{notes[k]}</div>}
              {hits.length > 1 && <div style={{ lineHeight: 1.5 }}>That text is in {hits.length} places. Choose where to apply it:</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {hits.length === 1 && <button type="button" style={btn} onClick={() => apply(issue, k)}>Apply</button>}
                {hits.length > 1 && hits.map(h => (
                  <button key={JSON.stringify(h.at)} type="button" style={btn} onClick={() => apply(issue, k, h.at)}>{h.label}</button>
                ))}
                {canUndo && <button type="button" style={btn} onClick={() => undo(k)}>Undo</button>}
                {canJump && <button type="button" style={btn} onClick={() => onGoToStep(issue.builderStep)}>Edit this step</button>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
