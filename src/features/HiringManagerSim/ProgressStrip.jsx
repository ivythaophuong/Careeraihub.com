import React from 'react';
import { C } from '../../styles/theme';

// Where you are in the session, in one slim line: the position and the real counts, and one step per question. Nothing here is invented: no remaining-token
// count, no budget, no estimate of how long it will take.
export default function ProgressStrip({ questions, idx, results }) {
  const answered = results.filter(r => !r.skipped).length;
  const skipped = results.filter(r => r.skipped).length;
  const toGo = Math.max(0, questions.length - idx - (results.length > idx ? 1 : 0));
  const stateOf = (i) => { const r = results[i]; return r ? (r.skipped ? 'not answered' : 'answered') : i === idx ? 'current' : 'not yet'; };
  return (
    <section aria-label="Session progress" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ color: C.muted, fontSize: 12 }}>
        <span style={{ color: C.text, fontWeight: 700 }}>Question {idx + 1} of {questions.length}</span>
        {` · ${answered} answered${skipped ? ` · ${skipped} not answered` : ''} · ${toGo} to go`}
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', alignItems: 'center', flex: '0 1 260px', minWidth: 160 }}>
        {questions.map((q, i) => {
          const st = stateOf(i);
          const done = st === 'answered'; const here = st === 'current';
          return (
            <li key={i} aria-label={`Question ${i + 1}: ${st}`} aria-current={here ? 'step' : undefined} style={{ display: 'flex', alignItems: 'center', flex: i < questions.length - 1 ? 1 : '0 0 auto' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800,
                background: done || here ? C.accent : 'transparent', color: done || here ? '#0b1020' : C.muted, border: `2px solid ${done || here || st === 'not answered' ? C.accent : C.border}`, opacity: st === 'not answered' ? 0.6 : 1 }}>{i + 1}</span>
              {i < questions.length - 1 && <span aria-hidden="true" style={{ flex: 1, height: 2, margin: '0 3px', background: i < idx ? C.accent : C.border, opacity: i < idx ? 0.7 : 1 }} />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
