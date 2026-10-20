import React, { useState } from 'react';
import { C } from '../../styles/theme';
import { Card } from '../../components/CommonUI';

const head = { color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 };

// Advice only: no figures and no claims about results. Each is a habit to try.
const TIPS = [
  { title: 'Be specific and concrete', body: 'Use real examples, and numbers or outcomes where you have them. Focus on what you did, not just on what happened.' },
  { title: 'Say what you did', body: 'Use "I" for your own actions. "We" can hide your part, so make clear which part was yours.' },
  { title: 'Finish with the outcome', body: 'End with what changed because of what you did, even if it was small. If you have a figure, say it; if not, say what was different.' },
  { title: 'Answer the question that was asked', body: 'Start with the point, then give the example. If you notice you are drifting, bring it back to the question.' },
];

// Side panel of the active interview: where the user is, derived from the question list and the results held on screen.
// Nothing here is invented: no remaining-token count, no budget, no estimate of how long it will take.
export default function SessionPanel({ questions, idx, results, color, deviceKept, challenge, mode = 'text' }) {
  const [tip, setTip] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const answered = results.filter(r => !r.skipped).length;
  const skipped = results.filter(r => r.skipped).length;
  const toGo = Math.max(0, questions.length - idx - (results.length > idx ? 1 : 0));
  const stateOf = (i) => { const r = results[i]; return r ? (r.skipped ? 'not answered' : 'answered') : i === idx ? 'current' : 'not yet'; };
  const t = TIPS[tip];
  const move = (d) => setTip(n => (n + d + TIPS.length) % TIPS.length);
  return (
    <aside aria-label="Session progress" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <div style={head}>Session progress</div>
        <ol style={{ listStyle: 'none', margin: '4px 0 12px', padding: 0, display: 'flex', alignItems: 'center' }}>
          {questions.map((q, i) => {
            const st = stateOf(i);
            const done = st === 'answered'; const here = st === 'current';
            return (
              <li key={i} aria-label={`Question ${i + 1}: ${st}`} aria-current={here ? 'step' : undefined} style={{ display: 'flex', alignItems: 'center', flex: i < questions.length - 1 ? 1 : '0 0 auto' }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
                  background: done || here ? color : 'transparent', color: done || here ? '#0b1020' : C.muted, border: `2px solid ${done || here || st === 'not answered' ? color : C.border}`, opacity: st === 'not answered' ? 0.6 : 1 }}>{i + 1}</span>
                {i < questions.length - 1 && <span aria-hidden="true" style={{ flex: 1, height: 2, margin: '0 4px', background: i < idx ? color : C.border, opacity: i < idx ? 0.7 : 1 }} />}
              </li>
            );
          })}
        </ol>
        <div style={{ color: C.text, fontSize: 13 }}>
          {answered} answered{skipped ? ` · ${skipped} not answered` : ''} · {toGo} to go
        </div>
        <div style={{ marginTop: 12, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px' }}>
          <div style={{ color: C.muted, fontSize: 11 }}>Current question</div>
          <div style={{ color: C.text, fontSize: 18, fontWeight: 800 }}>{idx + 1} / {questions.length}</div>
          <div style={{ color: C.muted, fontSize: 12 }}>{questions[idx]?.focus || 'Question'}</div>
        </div>
      </Card>
      <div>
        <button type="button" onClick={() => setHelpOpen(o => !o)} aria-expanded={helpOpen} style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit' }}>
          {helpOpen ? 'Hide help & tips' : 'Help & tips'}
        </button>
      </div>
      {helpOpen && <Card>
        <div style={head}>Interview tips</div>
        <div data-testid="tip" aria-live="polite" style={{ background: `${color}14`, border: `1px solid ${color}33`, borderRadius: 10, padding: '12px 14px', minHeight: 96 }}>
          <div style={{ color: C.text, fontSize: 14, fontWeight: 800, marginBottom: 6 }}>{t.title}</div>
          <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6 }}>{t.body}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <button type="button" aria-label="Previous tip" onClick={() => move(-1)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 16, cursor: 'pointer' }}>‹</button>
          <div style={{ display: 'flex', gap: 6 }}>{TIPS.map((_, i) => <span key={i} data-testid="tip-dot" aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: i === tip ? color : C.border }} />)}</div>
          <button type="button" aria-label="Next tip" onClick={() => move(1)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 16, cursor: 'pointer' }}>›</button>
        </div>
      </Card>}
      <div>
        <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6 }}>
          {mode === 'voice' ? 'Voice answers: ' : 'Typed answers: '}
          {challenge === 'timed' ? 'each question has a soft limit of 3 minutes. It never cuts your answer and never changes your score.' : 'there is no time limit.'} Scores are AI estimates for your own practice, not verified evidence of skill.
          {deviceKept && ' Your progress is kept on this device only; it is saved to your account when you finish.'}
        </div>
      </div>
    </aside>
  );
}
