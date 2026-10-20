import React from 'react';
import { C } from '../../styles/theme';
import { Btn } from '../../components/CommonUI';
import { formatElapsed } from './sessionUi';

// The question being practised: where you are, what is being tested, the clocks, and the question itself in large text. The clocks start when the person is ready.
const ghostBtn = { background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' };
const panel = { flex: '1 1 260px', minWidth: 0, display: 'flex', gap: 12, alignItems: 'flex-start', border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', background: 'rgba(255,255,255,.02)' };
const pHead = { color: C.text, fontSize: 13, fontWeight: 700 };
const pBody = { color: C.muted, fontSize: 12, lineHeight: 1.6, marginTop: 2 };

export default function QuestionCard({ q, idx, total, color, challenge, attempt, current, secondsLeft, showTimer, onToggleTimer, questionMs, sessionMs, ready, onReady }) {
  const urgency = secondsLeft === 0 ? 'over' : secondsLeft <= 30 ? 'soon' : 'calm';
  return (
    <section data-testid="question-card" aria-label="Current question" style={{ border: `1px solid ${color}44`, background: `${color}08`, borderRadius: 16, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ color: C.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2 }}>Question {idx + 1}/{total}</span>
          {q.focus && <span style={{ color, background: `${color}1f`, border: `1px solid ${color}55`, borderRadius: 999, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{q.focus}</span>}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {challenge === 'timed' && attempt === 1 && !current && (
            <span role="timer" data-urgency={urgency} aria-label={`Time left for this question: ${formatElapsed(secondsLeft * 1000)}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: urgency === 'calm' ? C.surface : C.gold + '22', border: `1px solid ${urgency === 'calm' ? color + '66' : C.gold}`, color: urgency === 'calm' ? C.text : C.gold, borderRadius: 999, padding: '6px 14px', fontSize: 15, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
              <span aria-hidden="true">⏳</span>Time left {formatElapsed(secondsLeft * 1000)}</span>
          )}
          {showTimer && (
            <span role="timer" aria-label="Elapsed time, for your information only"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.surface, border: `1px solid ${color}66`, color: C.text, borderRadius: 999, padding: '6px 14px', fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
              <span aria-hidden="true">⏱</span>This question {formatElapsed(questionMs)}<span style={{ color: C.muted, fontWeight: 600 }}>·</span><span style={{ color: C.muted, fontWeight: 700 }}>Whole session {formatElapsed(sessionMs)}</span>
            </span>
          )}
          <button type="button" onClick={onToggleTimer} aria-pressed={showTimer} style={ghostBtn}>{showTimer ? 'Hide timer' : 'Show timer'}</button>
        </div>
      </div>

      {!ready && attempt === 1 && !current && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '0 0 14px' }}>
          <span style={{ color: C.muted, fontSize: 12, lineHeight: 1.6 }}>Take your time to read the question. The clock starts when you press "I'm ready", or when you start answering.</span>
          <Btn onClick={onReady} color={color} dark style={{ padding: '8px 18px' }}>I'm ready</Btn>
        </div>
      )}

      <h2 style={{ color: C.text, fontSize: 24, fontWeight: 800, lineHeight: 1.35, margin: '0 0 16px' }}>{q.question}</h2>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {q.why && (
          <div style={panel}>
            <span aria-hidden="true" style={{ fontSize: 20 }}>🎯</span>
            <div><div style={pHead}>What the interviewer is assessing</div><div style={pBody}>{q.why}</div></div>
          </div>
        )}
        <div style={panel}>
          <span aria-hidden="true" style={{ fontSize: 20 }}>💡</span>
          <div><div style={pHead}>Think about</div><div style={pBody}>A structure that often works for experience questions: Situation → Action → Outcome</div></div>
        </div>
      </div>
    </section>
  );
}
