import React, { useEffect, useState } from 'react';
import { scoreBuilderData } from '../builderText.js';
import { codeFindings } from '../codeFindings.js';

const LABELS = { completeness: 'Sections', measurable_impact: 'Numbers in bullets', chronology_health: 'Dates' };
const colorFor = (n) => (n >= 80 ? '#00E5A0' : n >= 60 ? '#FFB84D' : '#FF5A5A');

// The ATS Readiness score of the draft being edited. Computed by code on every change (after a short pause), never by AI.
export default function BuilderScorePanel({ data, debounceMs = 300, onGoToStep }) {
  const [score, setScore] = useState(() => scoreBuilderData(data));
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setScore(scoreBuilderData(data)), debounceMs);
    return () => clearTimeout(id);
  }, [data, debounceMs]);

  const n = Number.isFinite(score?.score) ? score.score : null;
  const findings = codeFindings(score);

  return (
    <section aria-label="ATS readiness of this draft" style={{ margin: '0 14px 10px', padding: '10px 12px', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 10, fontSize: 12, color: 'var(--lp-text2)' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', fontFamily: 'inherit' }}>
        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--lp-text3)' }}>ATS Readiness</span>
        {n !== null && <span data-testid="builder-score" style={{ fontSize: 20, fontWeight: 900, color: colorFor(n) }}>{n}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 11 }}>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {n === null ? (
            <div>Add your details and the score will appear here.</div>
          ) : (
            <>
              {score.parts.map(p => (
                <div key={p.id}>
                  <strong style={{ color: 'var(--lp-text)' }}>{LABELS[p.id] || p.id}: {p.score}</strong>
                  {p.evidence?.map((e, i) => <div key={i} style={{ lineHeight: 1.5 }}>{e}</div>)}
                </div>
              ))}
              {findings.length > 0 && (
                <div>
                  <strong style={{ color: 'var(--lp-text)' }}>Found by the code checks:</strong>
                  {findings.map(f => (
                    <div key={f.id} style={{ marginTop: 4, lineHeight: 1.5 }}>
                      <div style={{ fontWeight: 700, color: 'var(--lp-text)' }}>{f.title}</div>
                      <div>{f.description}</div>
                      {onGoToStep && <button type="button" onClick={() => onGoToStep(f.builderStep)} style={{ marginTop: 3, background: 'none', border: '1px solid var(--lp-teal)', color: 'var(--lp-teal)', borderRadius: 7, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Edit this step</button>}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ color: 'var(--lp-text3)', lineHeight: 1.5 }}>
                Computed by code from the text you are editing; no AI. It reflects only these three checks, so a suggestion from the AI may improve your resume without changing the number. It is not a prediction of what a particular ATS will do, and the same content in an uploaded file can score a few points differently because of how that file is laid out.
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
