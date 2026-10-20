import React, { useState } from 'react';
import { C } from '../../styles/theme';

// Everything that is only background, behind one small control that stays folded until the person asks: how this practice works (the limit, AI estimates, where
// the progress is kept) and a few interview tips. Advice only: no figures and no claims about results.
const TIPS = [
  { title: 'Be specific and concrete', body: 'Use real examples, and numbers or outcomes where you have them. Focus on what you did, not just on what happened.' },
  { title: 'Say what you did', body: 'Use "I" for your own actions. "We" can hide your part, so make clear which part was yours.' },
  { title: 'Finish with the outcome', body: 'End with what changed because of what you did, even if it was small. If you have a figure, say it; if not, say what was different.' },
  { title: 'Answer the question that was asked', body: 'Start with the point, then give the example. If you notice you are drifting, bring it back to the question.' },
];

export default function AboutPractice({ challenge, mode = 'text', deviceKept }) {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(0);
  const t = TIPS[tip];
  const move = (d) => setTip(n => (n + d + TIPS.length) % TIPS.length);
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="about-practice"
        style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit' }}>
        About this practice <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      <div id="about-practice" data-testid="about-content" hidden={!open} style={{ marginTop: 8, display: open ? 'flex' : 'none', flexDirection: 'column', gap: 12, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', background: C.surface }}>
        <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6 }}>
          {mode === 'voice' ? 'Voice answers: ' : 'Typed answers: '}
          {challenge === 'timed' ? 'each question has a soft limit of 3 minutes. It never cuts your answer and never changes your score.' : 'there is no time limit.'} Scores are AI estimates for your own practice, not verified evidence of skill.
          {deviceKept && ' Your progress is kept on this device only; it is saved to your account when you finish.'}
        </div>
        <div>
          <div data-testid="tip" aria-live="polite" style={{ background: `${C.accent}14`, border: `1px solid ${C.accent}33`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ color: C.text, fontSize: 13, fontWeight: 800, marginBottom: 4 }}>{t.title}</div>
            <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6 }}>{t.body}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <button type="button" aria-label="Previous tip" onClick={() => move(-1)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 16, cursor: 'pointer' }}>‹</button>
            <div style={{ display: 'flex', gap: 6 }}>{TIPS.map((_, i) => <span key={i} data-testid="tip-dot" aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: i === tip ? C.accent : C.border }} />)}</div>
            <button type="button" aria-label="Next tip" onClick={() => move(1)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 16, cursor: 'pointer' }}>›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
