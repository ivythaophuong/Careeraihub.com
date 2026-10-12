import React, { useState } from 'react';
import { locateBefore, applyIssue, undoApply } from '../applyIssue.js';

const SEV = { critical: '#FF5A5A', high: '#FFB84D', medium: 'var(--lp-text3)' };
const btn = { background: 'none', border: '1px solid var(--lp-teal)', color: 'var(--lp-teal)', borderRadius: 7, padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' };

// The AI's issues for this resume (a fixed list: nothing new is added while the user edits), each with a before/after.
// Apply puts the suggestion in the matching field only when the quoted text is found in exactly one place; figures the
// resume does not already contain become [X]. Everything is a proposal the user accepts, and can undo.
export default function BuilderIssuesPanel({ issues, data, onChange, onGoToStep }) {
  const [applied, setApplied] = useState({}); // index -> { record, placeholders }
  const [notes, setNotes] = useState({});     // index -> message
  if (!issues?.length) return null;

  const apply = (i) => {
    const r = applyIssue(data, issues[i]);
    if (r.error) { setNotes(n => ({ ...n, [i]: 'Could not find that text in your resume any more.' })); return; }
    onChange(r.data);
    setApplied(a => ({ ...a, [i]: { record: r.record, placeholders: r.placeholders } }));
    setNotes(n => ({ ...n, [i]: '' }));
  };
  const undo = (i) => {
    const back = undoApply(data, applied[i].record);
    if (!back) { setNotes(n => ({ ...n, [i]: 'You edited that text, so it cannot be undone automatically. Edit it by hand.' })); return; }
    onChange(back);
    setApplied(a => { const c = { ...a }; delete c[i]; return c; });
    setNotes(n => ({ ...n, [i]: '' }));
  };

  return (
    <section aria-label="Suggestions from the AI" style={{ margin: '0 14px 10px', padding: '10px 12px', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 10, fontSize: 12, color: 'var(--lp-text2)' }}>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--lp-text3)', marginBottom: 4 }}>Suggestions ({issues.length})</div>
      <div style={{ color: 'var(--lp-text3)', lineHeight: 1.5, marginBottom: 8 }}>
        These are AI drafts. Check that every figure and claim is true before you keep it.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {issues.map((issue, i) => {
          const canApply = !applied[i] && !!issue.after && !!locateBefore(data, issue.before);
          const canJump = !applied[i] && !canApply && Number.isInteger(issue.builderStep);
          return (
            <div key={i} data-issue={i} style={{ borderLeft: `3px solid ${SEV[issue.severity] || SEV.medium}`, paddingLeft: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontWeight: 700, color: 'var(--lp-text)' }}>{issue.title}</div>
              <div style={{ lineHeight: 1.5 }}>{issue.description}</div>
              {issue.before && <div><strong>Now:</strong> <span>{issue.before}</span></div>}
              {issue.after && <div><strong>Suggested:</strong> <span>{issue.after}</span></div>}
              {applied[i]?.placeholders && <div style={{ color: '#FFB84D' }}>Replace [X] with your real figure, or remove it.</div>}
              {notes[i] && <div style={{ color: '#FFB84D' }}>{notes[i]}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                {canApply && <button type="button" style={btn} onClick={() => apply(i)}>Apply</button>}
                {applied[i] && <><span style={{ color: '#00E5A0', fontWeight: 700 }}>Applied</span><button type="button" style={btn} onClick={() => undo(i)}>Undo</button></>}
                {canJump && <button type="button" style={btn} onClick={() => onGoToStep(issue.builderStep)}>Edit this step</button>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
