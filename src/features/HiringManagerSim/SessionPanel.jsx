import React from 'react';
import { C } from '../../styles/theme';
import { Card } from '../../components/CommonUI';

const head = { color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 };

// Side panel of the active interview: where the user is, derived from the question list and the results held on screen.
// Nothing here is invented: no remaining-token count, no budget, no estimate of how long it will take.
export default function SessionPanel({ questions, idx, results, color, deviceKept, challenge }) {
  const answered = results.filter(r => !r.skipped).length;
  const skipped = results.filter(r => r.skipped).length;
  return (
    <aside aria-label="Session progress" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <div style={head}>Progress</div>
        <div style={{ color: C.text, fontSize: 13, marginBottom: 8 }}>
          {answered} answered{skipped ? ` · ${skipped} not answered` : ''} · {Math.max(0, questions.length - idx - (results.length > idx ? 1 : 0))} to go
        </div>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {questions.map((q, i) => {
            const r = results[i];
            const state = r ? (r.skipped ? 'Not answered' : 'Answered') : i === idx ? 'Current' : 'Not yet';
            return (
              <li key={i} aria-current={i === idx ? 'step' : undefined} style={{ display: 'flex', gap: 8, fontSize: 12, color: i === idx ? C.text : C.muted }}>
                <span style={{ minWidth: 18, fontWeight: 900, color: i === idx ? color : C.muted }}>{i + 1}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.focus || 'Question'}</span>
                <span>{state}</span>
              </li>
            );
          })}
        </ol>
      </Card>
      <Card>
        <div style={head}>About this practice</div>
        <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6 }}>
          {challenge === 'timed' ? 'Each question has a soft limit of 3 minutes. It never cuts your answer and never changes your score.' : 'There is no time limit.'} Scores are AI estimates for your own practice, not verified evidence of skill.
          {deviceKept && ' Your progress is kept on this device only; it is saved to your account when you finish.'}
        </div>
      </Card>
    </aside>
  );
}
