import React, { useState } from 'react';
import { C } from '../../styles/theme';
import { Card, Btn, Badge, Spinner } from '../../components/CommonUI';
import { callLLM, extractJSON } from '../../lib/ai.jsx';
import { pickResumeSource } from '../../lib/resumeSource';
import {
  PERSONAS, MIN_ANSWER_CHARS, MAX_ANSWER_CHARS, buildQuestionsPrompt, normalizeQuestions, buildEvaluationPrompt,
  normalizeEvaluation, findInventedInFeedback, summarize, buildSessionRecord, toSessionRow,
} from './interview';

const scoreColor = (s) => (s >= 75 ? C.green : s >= 60 ? C.gold : C.red);
const label = { color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 };
const ghostBtn = { background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" };

export default function HiringManagerSim({ resumeText, form, memory, updateMemory, setAuthModal, setActiveModule }) {
  const [phase, setPhase] = useState('select'); // select | interview | summary
  const [personaId, setPersonaId] = useState(null);
  const [role, setRole] = useState(form?.role || '');
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState([]);
  const [answer, setAnswer] = useState('');
  const [current, setCurrent] = useState(null); // feedback for the question on screen, once submitted
  const [warnings, setWarnings] = useState([]);
  const [busy, setBusy] = useState(null); // 'questions' | 'feedback' | null
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  const resume = pickResumeSource({ memory, resumeText });
  const persona = personaId ? PERSONAS[personaId] : null;
  const pColor = persona ? C[persona.color] : C.accent;
  const history = (memory?.mockSessions || []).slice(0, 5);
  const q = questions[idx];

  const fail = (e, guestMsg, fallback) => {
    if (e.status === 401 && setAuthModal) { setErr(guestMsg); setAuthModal('register'); }
    else setErr(e.message || fallback);
  };

  const reset = () => {
    setPhase('select'); setPersonaId(null); setQuestions([]); setIdx(0); setResults([]); setAnswer('');
    setCurrent(null); setWarnings([]); setErr(''); setSaved(false); setConfirmExit(false);
  };

  const start = async (id) => {
    if (busy) return;
    if (!role.trim() && resume.kind === 'none') { setErr('Enter the role you are interviewing for, or add your resume, so the questions fit you.'); return; }
    setBusy('questions'); setErr('');
    try {
      const raw = await callLLM([{ role: 'user', content: buildQuestionsPrompt({ personaId: id, role: role.trim(), resume }) }], 2500, resume.pdfBase64);
      setQuestions(normalizeQuestions(extractJSON(raw)));
      setPersonaId(id); setIdx(0); setResults([]); setAnswer(''); setCurrent(null); setWarnings([]); setSaved(false);
      setPhase('interview');
    } catch (e) {
      fail(e, 'Create a free account or sign in to start a mock interview.', 'Could not start the interview. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (busy || current) return;
    if (answer.trim().length < MIN_ANSWER_CHARS) { setErr(`Answer a bit more fully (at least ${MIN_ANSWER_CHARS} characters) so there is something to evaluate.`); return; }
    setBusy('feedback'); setErr('');
    try {
      const raw = await callLLM([{ role: 'user', content: buildEvaluationPrompt({ personaId, role: role.trim(), question: q.question, answer, resume }) }], 1800);
      const fb = normalizeEvaluation(extractJSON(raw));
      setCurrent(fb);
      setWarnings(findInventedInFeedback({ question: q.question, answer }, fb));
      setResults(r => [...r, { question: q.question, focus: q.focus, answer, ...fb }]);
    } catch (e) {
      // The typed answer stays in the box so the user can simply retry.
      fail(e, 'Create a free account or sign in to get feedback.', 'Could not evaluate your answer. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const finish = (finalResults) => {
    const summary = summarize(finalResults);
    if (summary.answered > 0) {
      const rec = buildSessionRecord({ personaId, role: role.trim(), results: finalResults, summary });
      // Second argument writes the mock_sessions row; the server-side trust-score trigger averages
      // avg_score from that table to compute interview_score, so it must be persisted, not only kept in memory.
      updateMemory?.(
        m => ({ mockSessions: [rec, ...(m.mockSessions || [])].slice(0, 20) }),
        { table: 'mock_sessions', data: toSessionRow(rec) }
      );
      setSaved(true);
    }
    setPhase('summary');
  };

  const advance = (finalResults) => {
    if (idx + 1 < questions.length) {
      setIdx(idx + 1); setAnswer(''); setCurrent(null); setWarnings([]); setErr('');
    } else {
      finish(finalResults);
    }
  };

  const skip = () => {
    if (busy) return;
    const next = [...results, { question: q.question, focus: q.focus, skipped: true }];
    setResults(next);
    advance(next);
  };

  // ── Select ──────────────────────────────────────────────────────────────────
  if (phase === 'select') return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ color: C.text, fontWeight: 900, fontSize: 24 }}>Hiring Manager Simulator</div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>A 5-question mock interview written for you, with honest feedback on every answer.</div>
        {resume.kind === 'none' && (
          <div role="note" style={{ color: C.gold, fontSize: 12, fontWeight: 700, marginTop: 8, padding: "8px 12px", background: C.gold + "11", borderRadius: 8, border: `1px solid ${C.gold}33` }}>
            ⚠️ Add your resume for questions about your own experience. Without it you'll get general questions for the role.
            {setActiveModule && <button onClick={() => setActiveModule('scan')} style={{ marginLeft: 8, background: "transparent", border: "none", color: C.accent, fontWeight: 700, cursor: "pointer", textDecoration: "underline", fontSize: 12 }}>Go to Resume Scan</button>}
          </div>
        )}
      </div>

      <Card>
        <div style={label}>Role You're Interviewing For</div>
        <input
          aria-label="Role"
          value={role}
          onChange={e => { setRole(e.target.value); setErr(''); }}
          placeholder="e.g. Senior Product Manager"
          style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 13, outline: "none", fontFamily: "inherit" }}
        />
      </Card>

      {err && <div role="alert" style={{ color: C.red, fontSize: 12 }}>⚠️ {err}</div>}
      {busy === 'questions' && <Card><Spinner label="Your interviewer is preparing questions..." /></Card>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {Object.entries(PERSONAS).map(([id, p]) => (
          <Card key={id} style={{ cursor: busy ? "wait" : "pointer", border: `1px solid ${C[p.color]}33`, background: C[p.color] + "05", opacity: busy ? 0.6 : 1 }} onClick={() => start(id)}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{p.icon}</div>
            <div style={{ color: C[p.color], fontWeight: 900, fontSize: 16, marginBottom: 4 }}>{p.label}</div>
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 12 }}>{p.desc}</div>
            <Badge label="Start Interview" color={C[p.color]} />
          </Card>
        ))}
      </div>

      {history.length > 0 && (
        <Card>
          <div style={{ color: C.text, fontWeight: 900, fontSize: 14, marginBottom: 10 }}>🕑 Recent Sessions</div>
          {history.map(s => (
            <div key={s.id ?? s.date} style={{ display: "flex", alignItems: "center", gap: 10, borderTop: `1px solid ${C.border}`, padding: "8px 0", fontSize: 12 }}>
              <span style={{ color: Number.isFinite(s.avgScore) ? scoreColor(s.avgScore) : C.muted, fontWeight: 900, minWidth: 34 }}>{Number.isFinite(s.avgScore) ? `${s.avgScore}%` : '–'}</span>
              <span style={{ color: C.text, flex: 1 }}>{s.personaLabel || 'Mock interview'}{s.role ? ` · ${s.role}` : ''}</span>
              <span style={{ color: C.muted }}>{s.questionsCount ?? 0} answered</span>
              <span style={{ color: C.muted, fontSize: 10 }}>{s.date ? new Date(s.date).toLocaleDateString() : ''}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );

  // ── Summary ─────────────────────────────────────────────────────────────────
  if (phase === 'summary') {
    const s = summarize(results);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ color: C.text, fontWeight: 900, fontSize: 24 }}>{persona.icon} Interview Results</div>
          <div style={{ color: C.muted, fontSize: 12 }}>{persona.label}{role.trim() ? ` · ${role.trim()}` : ''}</div>
        </div>

        {s.answered === 0 ? (
          <Card><div style={{ color: C.muted, fontSize: 13 }}>You skipped every question, so there is nothing to score and nothing was saved.</div></Card>
        ) : (
          <Card style={{ border: `1px solid ${scoreColor(s.avgScore)}44` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={label}>Average score</div>
                <div style={{ color: scoreColor(s.avgScore), fontWeight: 900, fontSize: 40 }} aria-label="Average score">{s.avgScore}%</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: scoreColor(s.avgScore), fontWeight: 900, fontSize: 20 }}>{s.verdict}</div>
                <div style={{ color: C.muted, fontSize: 12 }}>{s.answered} answered{s.skipped ? ` · ${s.skipped} skipped` : ''}</div>
              </div>
            </div>
            {saved && <div style={{ color: C.green, fontSize: 11, marginTop: 8 }}>✓ Saved to your history</div>}
          </Card>
        )}

        {s.priorities.length > 0 && (
          <Card style={{ border: `1px solid ${C.accent}44` }}>
            <div style={{ color: C.accent, fontWeight: 900, fontSize: 13, marginBottom: 10 }}>🎯 Practise These First</div>
            {s.priorities.map((t, i) => <div key={i} style={{ color: C.text, fontSize: 13, marginBottom: 6, lineHeight: 1.6 }}>{i + 1}. {t}</div>)}
          </Card>
        )}

        <Card>
          <div style={{ color: C.text, fontWeight: 900, fontSize: 13, marginBottom: 10 }}>Question by question</div>
          {results.map((r, i) => (
            <div key={i} style={{ borderTop: i ? `1px solid ${C.border}` : "none", padding: "10px 0" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: r.skipped ? C.muted : scoreColor(r.score), fontWeight: 900, minWidth: 40 }}>{r.skipped ? 'Skipped' : `${r.score}%`}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: C.text, fontSize: 12, lineHeight: 1.5 }}>{r.question}</div>
                  {!r.skipped && r.tip && <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Tip: {r.tip}</div>}
                </div>
              </div>
            </div>
          ))}
        </Card>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Btn onClick={() => start(personaId)} color={pColor} dark disabled={!!busy} style={{ flex: 1 }}>{busy ? 'Preparing…' : '🔁 New Interview, Same Persona'}</Btn>
          <Btn onClick={reset} color={C.border} style={{ padding: "11px 20px" }}>Change Persona</Btn>
        </div>
        {err && <div role="alert" style={{ color: C.red, fontSize: 12 }}>⚠️ {err}</div>}
      </div>
    );
  }

  // ── Interview ───────────────────────────────────────────────────────────────
  const answeredCount = results.filter(r => !r.skipped).length;
  const isLast = idx + 1 === questions.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: C.text, fontWeight: 900, fontSize: 24 }}>{persona.icon} {persona.label}</div>
          <div style={{ color: C.muted, fontSize: 12 }}>Mock interview in progress</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {answeredCount > 0 && !busy && <button onClick={() => finish(results)} style={ghostBtn}>Finish & see results</button>}
          {confirmExit ? (
            <>
              <button onClick={reset} style={{ ...ghostBtn, color: C.red, borderColor: C.red }}>Exit without saving</button>
              <button onClick={() => setConfirmExit(false)} style={ghostBtn}>Keep going</button>
            </>
          ) : (
            <button onClick={() => (answeredCount > 0 ? setConfirmExit(true) : reset())} style={ghostBtn}>← Exit</button>
          )}
        </div>
      </div>

      <Card style={{ border: `1px solid ${pColor}44`, background: pColor + "05" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <div style={label}>Question {idx + 1}/{questions.length}</div>
          <span style={{ color: pColor, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>Testing: {q.focus}</span>
        </div>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 15, lineHeight: 1.6 }}>"{q.question}"</div>
        {q.why && <div style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>The interviewer is looking for: {q.why}</div>}
      </Card>

      {!current && (
        <>
          <textarea
            aria-label="Your answer"
            value={answer}
            maxLength={MAX_ANSWER_CHARS}
            disabled={!!busy}
            onChange={e => { setAnswer(e.target.value); setErr(''); }}
            placeholder="Type your answer here. A STAR structure (Situation, Task, Action, Result) works well for behavioural questions..."
            style={{ width: "100%", minHeight: 140, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: 16, fontSize: 13, outline: "none", lineHeight: 1.7, fontFamily: "inherit", resize: "vertical" }}
          />
          {err && <div role="alert" style={{ color: C.red, fontSize: 12 }}>⚠️ {err}</div>}
          <div style={{ display: "flex", gap: 12 }}>
            <Btn onClick={submit} disabled={!!busy} color={pColor} dark style={{ flex: 1 }}>{busy === 'feedback' ? 'Evaluating…' : '🧠 Get AI Feedback'}</Btn>
            <Btn onClick={skip} disabled={!!busy} color={C.border} style={{ padding: "11px 20px" }}>Skip →</Btn>
          </div>
          {busy === 'feedback' && <Card><Spinner label={`Evaluating as ${persona.label}...`} /></Card>}
        </>
      )}

      {current && (
        <>
          <Card style={{ border: `1px solid ${scoreColor(current.score)}44` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ color: scoreColor(current.score), fontWeight: 900, fontSize: 20 }}>{current.verdict}</div>
              <div style={{ color: scoreColor(current.score), fontSize: 24, fontWeight: 900 }} aria-label="Answer score">{current.score}%</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {current.worked && <div><div style={{ color: C.green, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 4 }}>What Worked</div><div style={{ color: C.text, fontSize: 13, lineHeight: 1.6 }}>{current.worked}</div></div>}
              {current.missed && <div><div style={{ color: C.red, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 4 }}>What Missed</div><div style={{ color: C.text, fontSize: 13, lineHeight: 1.6 }}>{current.missed}</div></div>}
              {current.tip && <div style={{ background: C.surface, padding: 12, borderRadius: 8, borderLeft: `3px solid ${C.accent}` }}><div style={{ color: C.accent, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 4 }}>Professional Tip</div><div style={{ color: C.text, fontSize: 13, lineHeight: 1.6 }}>{current.tip}</div></div>}
              {current.betterAnswerOutline.length > 0 && (
                <div>
                  <div style={{ color: C.gold, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 4 }}>A Stronger Structure For Your Answer</div>
                  {current.betterAnswerOutline.map((b, i) => <div key={i} style={{ color: C.text, fontSize: 12, marginBottom: 4 }}>• {b}</div>)}
                </div>
              )}
            </div>
          </Card>
          {warnings.length > 0 && (
            <Card style={{ border: `1px solid ${C.gold}66`, background: C.gold + "0D" }}>
              <div role="alert" style={{ color: C.gold, fontWeight: 900, fontSize: 12, marginBottom: 6 }}>⚠️ Check these numbers</div>
              <div style={{ color: C.text, fontSize: 12, lineHeight: 1.6 }}>The suggestions mention figures you did not give: <strong>{warnings.join(', ')}</strong>. Only use numbers you can back up in a real interview.</div>
            </Card>
          )}
          <Btn onClick={() => advance(results)} color={pColor} dark style={{ width: "100%" }}>{isLast ? 'See Results →' : 'Next Question →'}</Btn>
        </>
      )}
    </div>
  );
}
