import React, { useState, useEffect, useRef } from 'react';
import { C } from '../../styles/theme';
import { Card, Btn, Badge, Spinner } from '../../components/CommonUI';
import { extractJSON } from '../../lib/ai.jsx';
import { callLLMFor } from '../../lib/aiFeature.js';
import { pickResumeSource } from '../../lib/resumeSource';
import { serverScoringOn, evaluateAnswerOnServer, saveInterviewOnServer } from '../../lib/serverScoring';
import {
  PERSONAS, MIN_ANSWER_CHARS, MAX_ANSWER_CHARS, buildQuestionsPrompt, normalizeQuestions, buildEvaluationPrompt,
  normalizeEvaluation, sanitizeDelivery, findInventedInFeedback, summarize, buildSessionRecord, toSessionRow, verdictFor,
} from './interview';
import { splitFirstSentence } from './feedbackDetail';
import { SESSIONS_KEPT } from '../../lib/historyLimits';
import { saveDeviceSession, loadDeviceSession, clearDeviceSession } from './deviceSession';
import { formatElapsed, describeEvaluationFailure } from './sessionUi';
import ProgressStrip from './ProgressStrip';
import AboutPractice from './AboutPractice';
import NextStepCard from './NextStepCard';
import StructurePanel from './StructurePanel';
import VoiceRecorder from './VoiceRecorder';
import QuestionCard from './QuestionCard';
import SpeakingInsights from './SpeakingInsights';
import DeliveryRail from './DeliveryRail';
import './voiceLayout.css';
import AnswerTabs from './AnswerTabs';
import ActionBar from './ActionBar';
import { analyzeRhythm } from '../../lib/rhythm.js';
import { estimateWpm } from '../../lib/speakingRate.js';
import { voiceEnabled, PREVIEW_USER_IDS } from '../../lib/voice.js';
import { structurePanelEnabledFor, previewStructure } from './structurePreview';
import { TIMED_SECONDS, nextStep, loadTimedTried, markTimedTried, earnedVoice, loadVoiceUnlocked, markVoiceUnlocked } from './guidance';

const scoreColor = (s) => (s >= 75 ? C.green : s >= 60 ? C.gold : C.red);
const label = { color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 };
const ghostBtn = { background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" };

// One feedback point: the first sentence, and the rest behind a button, so the user thinks about it before reading more.
function Detail({ text }) {
  const { head, more } = splitFirstSentence(text);
  const [open, setOpen] = useState(false);
  return (
    <div style={{ color: C.text, fontSize: 13, lineHeight: 1.6 }}>
      {head}
      {more && !open && <> <button type="button" onClick={() => setOpen(true)} aria-expanded="false" style={{ ...ghostBtn, padding: '2px 8px', fontSize: 11, marginLeft: 4 }}>More detail</button></>}
      {more && open && <> {more}</>}
    </div>
  );
}

// The outline of a stronger answer is almost the answer itself, so it stays hidden until the user asks.
function Outline({ items }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div style={{ color: C.gold, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 4 }}>A Stronger Structure For Your Answer</div>
      {open
        ? items.map((b, i) => <div key={i} style={{ color: C.text, fontSize: 12, marginBottom: 4 }}>• {b}</div>)
        : <button type="button" onClick={() => setOpen(true)} aria-expanded="false" style={ghostBtn}>Show a stronger structure</button>}
    </div>
  );
}

export default function HiringManagerSim({ resumeText, form, memory, updateMemory, setAuthModal, setActiveModule, user, onFocusChange }) {
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
  const [practiceMode, setPracticeMode] = useState('text'); // 'text' | 'voice'
  const recorderRef = useRef(null);
  const [recStage, setRecStage] = useState('idle'); // the recorder's stage: idle | consent | recording | transcribing
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const [voiceUnlocked, setVoiceUnlocked] = useState(() => loadVoiceUnlocked(user?.id));
  const [liveSlot, setLiveSlot] = useState(null); // where the recorder puts its live figures: inside the Delivery rail
  const [voiceRate, setVoiceRate] = useState(null); // { key: 'idx:attempt', result } of the last recording; in memory only, never saved or scored
  useEffect(() => { setVoiceUnlocked(loadVoiceUnlocked(user?.id)); }, [user?.id]);
  const voiceAvailable = voiceEnabled(user?.id);
  const voiceOn = voiceAvailable && voiceUnlocked && practiceMode === 'voice';
  useEffect(() => { if (!voiceOn) setRecStage('idle'); }, [voiceOn]);
  const [attempt, setAttempt] = useState(1); // 1 = first try at this question; more = practice retries
  const [lastShown, setLastShown] = useState(null); // { fb, warnings } of the newest attempt, to go back to
  const [failureKind, setFailureKind] = useState(null); // 'known' | 'unknown' | 'limit' after a failed feedback request
  const [questionMs, setQuestionMs] = useState(0); // time on the question on screen, informational only: nothing is cut off or scored by it
  // The timer is on by default and easy to see; the person can hide it and the choice is remembered on this device. It only informs.
  const [showTimer, setShowTimer] = useState(() => { try { return localStorage.getItem('careerai_mock_timer_hidden') !== '1'; } catch { return true; } });
  const toggleTimer = () => setShowTimer(v => { try { localStorage.setItem('careerai_mock_timer_hidden', v ? '1' : '0'); } catch { /* storage blocked: the choice lasts for this visit only */ } return !v; });
  const [deviceKept, setDeviceKept] = useState(false); // true only after the browser confirmed it stored this session
  const [kept, setKept] = useState(() => loadDeviceSession(user?.id)); // an earlier session of this tab that can be continued
  const [challenge, setChallenge] = useState('untimed'); // 'untimed' | 'timed' (a soft limit per question: it never cuts an answer or changes a score)
  const [secondsLeft, setSecondsLeft] = useState(TIMED_SECONDS);
  const reviewRef = useRef(null);
  const headingRef = useRef(null);
  const questionRef = useRef(0);
  // The clock (countdown and the time shown for information) starts when the person is ready, not when the question appears: reading time is not counted.
  const [readyIdx, setReadyIdx] = useState(null); // the question index the person has started; any other index is still being read

  const resume = pickResumeSource({ memory, resumeText });
  const persona = personaId ? PERSONAS[personaId] : null;
  const pColor = persona ? C[persona.color] : C.accent;
  const history = (memory?.mockSessions || []).slice(0, 5);
  const q = questions[idx];

  const answeredNow = results.filter(r => !r.skipped).length;

  // While questions are on screen the page can be quiet: the parent hides what is not needed. It is asked again for the normal page when this ends.
  const inInterview = phase === 'interview';
  useEffect(() => { onFocusChange?.(inInterview); return () => { onFocusChange?.(false); }; }, [inInterview]); // eslint-disable-line react-hooks/exhaustive-deps

  // Informational time, counted per question first: it runs while the first attempt at a question is still open and stops when the answer is submitted
  // (or skipped), while feedback is being fetched, and during a practice retry. The session total is the sum of the questions.
  const ready = readyIdx === idx;
  const counting = phase === 'interview' && results.length <= idx && !busy && ready;
  useEffect(() => {
    if (!counting) return undefined;
    const t = setInterval(() => { questionRef.current += 1000; setQuestionMs(questionRef.current); }, 1000);
    return () => clearInterval(t);
  }, [counting, idx]);
  const sessionMs = results.reduce((n, r) => n + (r.ms || 0), 0) + (results.length > idx ? 0 : questionMs);

  // Timed challenge: a count-down for the first attempt at a question. At zero it only says so; the answer is kept and can still be sent.
  useEffect(() => { setSecondsLeft(TIMED_SECONDS); }, [idx, phase, challenge]);
  useEffect(() => {
    if (phase !== 'interview' || challenge !== 'timed' || current || attempt !== 1 || busy || !ready) return undefined;
    const t = setInterval(() => setSecondsLeft(sec => (sec > 0 ? sec - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [phase, challenge, current, attempt, busy, idx, ready]);

  // Keep the session on this device (not on the server) so a refresh or a visit to another module does not lose it.
  useEffect(() => {
    if (phase !== 'interview' || !questions.length) return;
    setDeviceKept(saveDeviceSession(user?.id, { personaId, role: role.trim(), questions, idx, results, answer, elapsedMs: sessionMs, questionMs: questionRef.current, challenge }));
  }, [phase, personaId, role, questions, idx, results, answer, challenge, user?.id]);

  // Closing or reloading the tab with work in progress asks first.
  useEffect(() => {
    if (phase !== 'interview' || (answeredNow === 0 && !answer.trim())) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase, answeredNow, answer]);

  // After feedback appears, move focus to it so keyboard and screen-reader users land on the result.
  useEffect(() => { if (current && headingRef.current) headingRef.current.focus(); }, [current]);

  const fail = (e, guestMsg, fallback) => {
    if (e.status === 401 && setAuthModal) { setErr(guestMsg); setAuthModal('register'); }
    else setErr(e.message || fallback);
  };

  const reset = () => {
    setPhase('select'); setPersonaId(null); setQuestions([]); setIdx(0); setReadyIdx(null); setResults([]); setAnswer('');
    setCurrent(null); setWarnings([]); setErr(''); setSaved(false); setConfirmExit(false); setAttempt(1); setLastShown(null);
    setFailureKind(null); setQuestionMs(0); questionRef.current = 0; setKept(null); setDeviceKept(false);
    clearDeviceSession(user?.id);
  };

  const continueKept = () => {
    // Read it again: the 2 hour window may have passed while this screen was open, and the card must not promise a session that is gone.
    const k = loadDeviceSession(user?.id);
    if (!k) { setKept(null); return; }
    const done = k.results.length > k.idx && !k.results[k.idx]?.skipped ? k.results[k.idx] : null;
    setChallenge(k.challenge === 'timed' ? 'timed' : 'untimed'); setPersonaId(k.personaId); setRole(k.role || ''); setQuestions(k.questions); setIdx(k.idx); setReadyIdx((Number.isFinite(k.questionMs) && k.questionMs > 0) || (typeof k.answer === 'string' && k.answer.trim()) ? k.idx : null); setResults(k.results);
    setAnswer(k.answer || ''); setCurrent(done); setWarnings([]); setErr(''); setSaved(false); setAttempt(1); setLastShown(done ? { fb: done, warnings: [] } : null);
    setFailureKind(null); questionRef.current = Number.isFinite(k.questionMs) ? k.questionMs : 0; setQuestionMs(questionRef.current); setKept(null);
    setPhase('interview');
  };

  const discardKept = () => { clearDeviceSession(user?.id); setKept(null); };

  const start = async (id, how) => {
    if (busy) return;
    const chosen = how === 'timed' || how === 'untimed' ? how : challenge;
    if (!role.trim() && resume.kind === 'none') { setErr('Enter the role you are interviewing for, or add your resume, so the questions fit you.'); return; }
    setBusy('questions'); setErr('');
    try {
      const raw = await callLLMFor('mock_questions', resume)([{ role: 'user', content: buildQuestionsPrompt({ personaId: id, role: role.trim(), resume }) }], 2500, resume.pdfBase64);
      setQuestions(normalizeQuestions(extractJSON(raw)));
      setChallenge(chosen); setPersonaId(id); setIdx(0); setReadyIdx(null); setResults([]); setAnswer(''); setCurrent(null); setWarnings([]); setSaved(false); setAttempt(1); setLastShown(null);
      setFailureKind(null); questionRef.current = 0; setQuestionMs(0); setKept(null);
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
    setBusy('feedback'); setErr(''); setFailureKind(null);
    // Rhythm figures of the recording for this attempt (numbers only), for a spoken answer. They never change the score.
    const r = voiceOn && voiceRate?.key === `${idx}:${attempt}` && voiceRate.rhythm?.state === 'ok' ? voiceRate.rhythm : null;
    const delivery = r ? { speechSec: r.speechSec, totalSec: r.totalSec, speechPercent: r.speechPercent, longPauses: r.longPauses, longestPauseSec: r.longestPauseSec, ...(typeof r.paceWhileSpeakingWpm === 'number' ? { paceWhileSpeakingWpm: r.paceWhileSpeakingWpm } : {}) } : null;
    try {
      let fb, receipt;
      if (serverScoringOn()) {
        // The server grades the answer; the receipt proves the score came from it and is needed to save the session.
        const reply = await evaluateAnswerOnServer({ personaId, role: role.trim(), question: q.question, answer, resumeText: resume.kind === 'none' || resume.kind === 'pdf' ? '' : resume.text, delivery });
        fb = reply.feedback; receipt = reply.receipt;
      } else {
        const raw = await callLLMFor('mock_evaluate_legacy', resume)([{ role: 'user', content: buildEvaluationPrompt({ personaId, role: role.trim(), question: q.question, answer, resume, delivery }) }], 1800);
        fb = normalizeEvaluation(extractJSON(raw), { delivery: sanitizeDelivery(delivery) });
      }
      const found = findInventedInFeedback({ question: q.question, answer }, fb);
      setCurrent(fb);
      setWarnings(found);
      setLastShown({ fb, warnings: found });
      if (attempt === 1) {
        setResults(r => [...r, { question: q.question, focus: q.focus, answer, ...fb, receipt, ms: questionRef.current }]);
      } else {
        // A retry is practice: it is kept next to the first attempt, which is the only one that is scored and saved.
        setResults(r => r.map((x, i) => (i === r.length - 1 ? { ...x, retries: [...(x.retries || []), { answer, score: fb.score }] } : x)));
      }
    } catch (e) {
      // The typed answer stays in the box so the user can simply retry.
      if (e.status === 401) fail(e, 'Create a free account or sign in to get feedback.', '');
      else { const f = describeEvaluationFailure(e); setFailureKind(f.kind); setErr(f.text); }
    } finally {
      setBusy(null);
    }
  };

  const finish = async (finalResults) => {
    if (busy) return;
    const summary = summarize(finalResults);
    let saveFailed = false;
    if (summary.answered > 0) {
      let saveErr = '';
      if (serverScoringOn()) {
        // The server computes the average from the graded answers and writes the mock_sessions row itself.
        setBusy('saving');
        try {
          const items = finalResults.filter(r => !r.skipped).map(r => ({ question: r.question, answer: r.answer, score: r.score, ts: r.receipt?.ts, sig: r.receipt?.sig }));
          const reply = await saveInterviewOnServer(personaId, role.trim(), items);
          summary.avgScore = reply.avgScore;
          summary.verdict = verdictFor(reply.avgScore);
          const rec = buildSessionRecord({ personaId, role: role.trim(), results: finalResults, summary });
          updateMemory?.(m => ({ mockSessions: [rec, ...(m.mockSessions || [])].slice(0, SESSIONS_KEPT) }));
          setSaved(true);
        } catch (e) {
          saveErr = e.message || 'Your session could not be saved.';
        } finally {
          setBusy(null);
        }
      } else {
        const rec = buildSessionRecord({ personaId, role: role.trim(), results: finalResults, summary });
        // Second argument writes the mock_sessions row; the server-side trust-score trigger averages
        // avg_score from that table to compute interview_score, so it must be persisted, not only kept in memory.
        updateMemory?.(
          m => ({ mockSessions: [rec, ...(m.mockSessions || [])].slice(0, SESSIONS_KEPT) }),
          { table: 'mock_sessions', data: toSessionRow(rec) }
        );
        setSaved(true);
      }
      if (challenge === 'timed') markTimedTried(user?.id);
      if (earnedVoice({ challenge, answered: summary.answered, total: finalResults.length })) { markVoiceUnlocked(user?.id); setVoiceUnlocked(true); }
      if (saveErr) { setErr(saveErr); saveFailed = true; }
    }
    // Only drop the copy kept on this device once the session is safely saved (or there was nothing to save).
    if (!saveFailed) { clearDeviceSession(user?.id); setDeviceKept(false); }
    setPhase('summary');
  };

  const advance = (finalResults) => {
    if (idx + 1 < questions.length) {
      questionRef.current = 0; setQuestionMs(0);
      setIdx(idx + 1); setAnswer(''); setCurrent(null); setWarnings([]); setErr(''); setAttempt(1); setLastShown(null);
    } else {
      finish(finalResults);
    }
  };

  const tryAgain = () => { if (busy) return; setAttempt(a => a + 1); setCurrent(null); setWarnings([]); setErr(''); };
  const backToFeedback = () => {
    if (busy || !lastShown) return;
    setAttempt(a => Math.max(1, a - 1)); setCurrent(lastShown.fb); setWarnings(lastShown.warnings); setErr('');
  };

  const skip = () => {
    if (busy) return;
    const next = [...results, { question: q.question, focus: q.focus, skipped: true, ms: questionRef.current }];
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

      {kept && (
        <Card style={{ border: `1px solid ${C.accent}44` }}>
          <div style={{ color: C.text, fontWeight: 900, fontSize: 14, marginBottom: 4 }}>Continue your practice</div>
          <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>
            {PERSONAS[kept.personaId].label}{kept.role ? ` · ${kept.role}` : ''} · question {kept.idx + 1} of {kept.questions.length} · {kept.results.filter(r => !r.skipped).length} answered.
            This is kept on this device only, not in your account, and is removed when you close this tab or finish.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn onClick={continueKept} color={C.accent} dark>Continue practice</Btn>
            <button type="button" onClick={discardKept} style={ghostBtn}>Discard it</button>
          </div>
        </Card>
      )}

      <Card>
        <div style={label}>Practice mode</div>
        <div role="group" aria-label="Practice mode" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setPracticeMode('text')} aria-pressed={!voiceOn} style={{ ...ghostBtn, padding: '8px 14px', ...(!voiceOn ? { color: C.text, borderColor: C.accent } : {}) }}>Text practice</button>
          {!voiceAvailable && <button type="button" disabled aria-disabled="true" aria-describedby="voice-note" style={{ ...ghostBtn, padding: '8px 14px', opacity: 0.55, cursor: 'not-allowed' }}>Voice practice</button>}
          {voiceAvailable && !voiceUnlocked && <button type="button" aria-disabled="true" aria-pressed="false" aria-describedby="voice-note" onClick={(e) => e.preventDefault()} style={{ ...ghostBtn, padding: '8px 14px', opacity: 0.55, cursor: 'not-allowed' }}><span aria-hidden="true">🔒 </span>Voice practice</button>}
          {voiceAvailable && voiceUnlocked && <button type="button" onClick={() => setPracticeMode('voice')} aria-pressed={voiceOn} aria-describedby="voice-note" style={{ ...ghostBtn, padding: '8px 14px', ...(voiceOn ? { color: C.text, borderColor: C.accent } : {}) }}>Voice practice</button>}
        </div>
        <div id="voice-note" style={{ color: C.muted, fontSize: 11, marginTop: 8, lineHeight: 1.6 }}>
          {!voiceAvailable
            ? 'Voice practice is not available yet. You type your answers; no microphone is used and nothing is recorded.'
            : !voiceUnlocked
              ? 'Voice practice unlocks after you finish one timed round and answer at least 4 of 5 questions. It is optional: you can always type your answers.'
              : voiceOn
                ? 'Voice practice (preview): on each question you can record your answer instead of typing it. It is turned into text that you check and correct before you send it for feedback. The recording is not kept. If it says voice is not available for your account, type your answer.'
                : 'Voice practice is unlocked (preview). Choose it above to record your answers instead of typing them. You can switch back to typing at any time.'}
        </div>
        {voiceAvailable && !voiceUnlocked && PREVIEW_USER_IDS.includes(user?.id) && (
          <button type="button" onClick={() => { markVoiceUnlocked(user?.id); setVoiceUnlocked(true); }} style={{ ...ghostBtn, marginTop: 8 }}>Unlock for testing</button>
        )}
      </Card>

      <Card>
        <div style={label}>Challenge</div>
        <div role="group" aria-label="Challenge" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setChallenge('untimed')} aria-pressed={challenge === 'untimed'} style={{ ...ghostBtn, padding: '8px 14px', ...(challenge === 'untimed' ? { color: C.text, borderColor: C.accent } : {}) }}>Untimed · at your own pace</button>
          <button type="button" onClick={() => setChallenge('timed')} aria-pressed={challenge === 'timed'} style={{ ...ghostBtn, padding: '8px 14px', ...(challenge === 'timed' ? { color: C.text, borderColor: C.accent } : {}) }}>Timed: 3 minutes per question</button>
        </div>
        <div style={{ color: C.muted, fontSize: 11, marginTop: 8, lineHeight: 1.6 }}>
          Timed practice is optional. When time is up your answer is kept and you can still send it; time never changes your score. You can switch back to your own pace at any time.
        </div>
      </Card>

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
    const step = nextStep({ challenge, answered: s.answered, skipped: s.skipped });
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
            <div style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>An AI estimate from this interview, not verified evidence of your skills.</div>
            {saved && <div style={{ color: C.green, fontSize: 11, marginTop: 8 }}>✓ Saved to your history</div>}
            {!saved && err && <div role="alert" style={{ color: C.red, fontSize: 11, marginTop: 8 }}>⚠️ Not saved to your history: {err}</div>}
          </Card>
        )}

        {results.some(r => r.retries?.length) && <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.6 }}>Only the first attempt counts toward your score and history. Practice attempts are AI estimates for your own learning; they are kept for this visit only and are not saved.</div>}

        {s.priorities.length > 0 && (
          <Card style={{ border: `1px solid ${C.accent}44` }}>
            <div style={{ color: C.accent, fontWeight: 900, fontSize: 13, marginBottom: 10 }}>🎯 Practise These First</div>
            {s.priorities.map((t, i) => <div key={i} style={{ color: C.text, fontSize: 13, marginBottom: 6, lineHeight: 1.6 }}>{i + 1}. {t}</div>)}
          </Card>
        )}

        <Card>
          <div ref={reviewRef} tabIndex={-1} style={{ color: C.text, fontWeight: 900, fontSize: 13, marginBottom: 10, outline: 'none' }}>Question by question</div>
          {results.map((r, i) => (
            <div key={i} style={{ borderTop: i ? `1px solid ${C.border}` : "none", padding: "10px 0" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: r.skipped ? C.muted : scoreColor(r.score), fontWeight: 900, minWidth: 40 }}>{r.skipped ? 'Skipped' : `${r.score}%`}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: C.text, fontSize: 12, lineHeight: 1.5 }}>{r.question}</div>
                  {!r.skipped && r.tip && <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Tip: {r.tip}</div>}
                  {!r.skipped && r.retries?.length > 0 && (() => { const last = r.retries[r.retries.length - 1].score; return <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Latest practice attempt: {last}% (first attempt: {r.score}%){last > r.score ? ' · scored higher' : ''}</div>; })()}
                </div>
              </div>
            </div>
          ))}
        </Card>

        <NextStepCard step={step} color={pColor} busy={busy}
          onPrimary={() => start(personaId, step.challenge)}
          onOwnPace={() => start(personaId, 'untimed')}
          onReview={() => { reviewRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); reviewRef.current?.focus?.(); }} />

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
  const firstScore = results[results.length - 1]?.score; // the first attempt of the question on screen
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: C.text, fontWeight: 900, fontSize: 24 }}>{persona.icon} {persona.label}</div>
          <div style={{ color: C.muted, fontSize: 12 }}>Mock interview in progress</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px' }}><ProgressStrip questions={questions} idx={idx} results={results} /></div>
        <AboutPractice challenge={challenge} mode={voiceOn ? 'voice' : 'text'} deviceKept={deviceKept} />
      </div>
      <QuestionCard q={q} idx={idx} total={questions.length} challenge={challenge} attempt={attempt} current={current} secondsLeft={secondsLeft}
        showTimer={showTimer} onToggleTimer={toggleTimer} questionMs={questionMs} sessionMs={sessionMs} ready={ready} onReady={() => setReadyIdx(idx)} />

      {!current && (
        <>
          <div className={voiceOn ? 'voice-layout' : undefined} data-testid={voiceOn ? 'voice-layout' : undefined}>
          <section aria-label="Answer area" style={{ border: `1px solid ${C.border}`, borderRadius: 16, background: C.surface, padding: '0 20px 20px' }}>
            <AnswerTabs mode={voiceOn ? 'voice' : 'text'} onChange={setPracticeMode} voiceAvailable={voiceAvailable} voiceUnlocked={voiceUnlocked} draftKept={!!(answer.trim() && deviceKept)} />
            {voiceOn && (
              <div style={{ padding: '18px 0 8px' }}>
                <VoiceRecorder ref={recorderRef} disabled={!!busy} onStage={setRecStage} liveTarget={liveSlot} recorded={voiceRate?.key === `${idx}:${attempt}` && voiceRate.rhythm?.state === 'ok' ? { durationSec: voiceRate.durationSec, rhythm: voiceRate.rhythm } : null} onStart={() => { if (attempt === 1) setReadyIdx(idx); }} onTranscript={(t, meta) => {
                  setAnswer(a => ((a.trim() ? a.trimEnd() + ' ' : '') + t).slice(0, MAX_ANSWER_CHARS)); setErr('');
                  try { setVoiceRate({ key: `${idx}:${attempt}`, durationSec: meta?.durationSec, result: estimateWpm({ text: t, durationSec: meta?.durationSec }), rhythm: analyzeRhythm({ levels: meta?.levels, stepMs: meta?.stepMs, text: t }) }); } catch { setVoiceRate(null); }
                }} />
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              {voiceOn && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>Transcript</div>
                    <div style={{ color: C.muted, fontSize: 11 }}>Your transcript appears here after recording. Check and correct it before you send it for feedback.</div>
                  </div>
                  <button type="button" onClick={() => setTranscriptOpen(o => !o)} aria-expanded={transcriptOpen} style={ghostBtn}>{transcriptOpen ? 'Hide' : 'Show'}</button>
                </div>
              )}
              <textarea
                aria-label="Your answer"
                value={answer}
                maxLength={MAX_ANSWER_CHARS}
                disabled={!!busy}
                onChange={e => { setAnswer(e.target.value); setErr(''); if (!ready && attempt === 1) setReadyIdx(idx); }}
                placeholder={attempt > 1 ? 'Improve your answer, then ask for feedback again.' : 'Type your answer here. A STAR structure (Situation, Task, Action, Result) works well for behavioural questions...'}
                style={{ display: voiceOn && !transcriptOpen ? 'none' : 'block', width: "100%", minHeight: voiceOn ? 110 : 160, background: C.bg || 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: 16, fontSize: 13, outline: "none", lineHeight: 1.7, fontFamily: "inherit", resize: "vertical", boxSizing: 'border-box' }}
              />
            </div>
            <div aria-live="polite" style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>
              {busy === 'feedback' ? 'Sending your answer for evaluation. It is not saved to your account yet.' : ''}
            </div>
            {challenge === 'timed' && attempt === 1 && secondsLeft === 0 && <div role="status" style={{ color: C.gold, fontSize: 12, lineHeight: 1.6, marginTop: 8 }}>Time is up. Your answer is kept, so you can finish your thought and get feedback. Time does not change your score.</div>}
            {err && <div role="alert" style={{ color: failureKind === 'unknown' ? C.gold : C.red, fontSize: 12, lineHeight: 1.6, marginTop: 8 }}>⚠️ {err}</div>}
          </section>
          {voiceOn && (
            <DeliveryRail slotRef={setLiveSlot}>
              {recStage !== 'recording' && voiceRate?.key === `${idx}:${attempt}` && (voiceRate.result?.state === 'ok' || voiceRate.rhythm?.state === 'ok') && (
                <SpeakingInsights variant="rail" rate={voiceRate.result} rhythm={voiceRate.rhythm} />
              )}
            </DeliveryRail>
          )}
          </div>
          {busy === 'feedback' && <Card><Spinner label={`Evaluating as ${persona.label}...`} /></Card>}
          {(() => {
            const hasAnswer = answer.trim().length > 0;
            let status = 'Ready when you are'; let detail = voiceOn ? 'Record your answer, or type it out.' : 'Type your answer, then ask for feedback.';
            let primary = { label: busy === 'feedback' ? 'Evaluating…' : '🧠 Get AI Feedback', onClick: submit, disabled: !!busy };
            if (voiceOn && recStage === 'recording') { status = 'Recording in progress'; detail = 'Your answer is being captured. Press Finish recording when you are done.'; primary = { label: 'Finish recording', onClick: () => recorderRef.current?.stop() }; }
            else if (voiceOn && recStage === 'transcribing') { status = 'Turning your voice into text'; detail = 'This takes a few seconds.'; primary = { label: 'Please wait…', onClick: () => {}, disabled: true }; }
            else if (voiceOn && !hasAnswer) { status = 'Ready to record'; detail = 'Record your answer or type it out.'; primary = { label: 'Start recording', onClick: () => recorderRef.current?.start(), disabled: !!busy }; }
            else if (hasAnswer) { status = busy === 'feedback' ? 'Evaluating your answer' : 'Ready for feedback'; detail = 'You can still edit your answer before you send it.'; }
            const secondary = attempt === 1
              ? { label: 'Skip →', onClick: skip, disabled: !!busy || recStage === 'recording' || recStage === 'transcribing' }
              : { label: 'Back to feedback', onClick: backToFeedback, disabled: !!busy };
            return <ActionBar status={status} detail={detail} primary={primary} secondary={secondary} />;
          })()}
        </>
      )}

      {current && (
        <>
          <Card style={{ border: `1px solid ${scoreColor(current.score)}44` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: attempt > 1 ? 8 : 20 }}>
              <div ref={headingRef} tabIndex={-1} style={{ color: scoreColor(current.score), fontWeight: 900, fontSize: 20, outline: 'none' }}>{current.verdict}{attempt > 1 && <span style={{ color: C.muted, fontSize: 12, fontWeight: 700, marginLeft: 8 }}>Practice attempt {attempt}</span>}</div>
              <div style={{ textAlign: "right" }}>
                {attempt > 1 && <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Practice score (not counted)</div>}
                <div style={{ color: scoreColor(current.score), fontSize: attempt > 1 ? 18 : 24, fontWeight: 900 }} aria-label="Answer score">{current.score}%</div>
                <div style={{ color: C.muted, fontSize: 10.5, marginTop: 2 }}>AI estimate, not verified evidence</div>
              </div>
            </div>
            {attempt > 1 && Number.isFinite(firstScore) && (
              <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>
                First attempt (the one that counts): {firstScore}%. {current.score > firstScore
                  ? 'This attempt scored higher than your first. That is one AI estimate, not proof that your skill changed.'
                  : 'This attempt did not score higher than your first.'}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {current.worked && <div><div style={{ color: C.green, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 4 }}>What Worked</div><Detail text={current.worked} /></div>}
              {current.missed && <div><div style={{ color: C.red, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 4 }}>What Missed</div><Detail text={current.missed} /></div>}
              {current.tip && <div style={{ background: C.surface, padding: 12, borderRadius: 8, borderLeft: `3px solid ${C.accent}` }}><div style={{ color: C.accent, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 4 }}>Professional Tip</div><Detail text={current.tip} /></div>}
              {current.delivery && (
                <div data-testid="delivery-feedback" style={{ background: C.surface, padding: 12, borderRadius: 8, borderLeft: `3px solid ${C.gold}` }}>
                  <div style={{ color: C.gold, fontSize: 10, fontWeight: 900, textTransform: 'uppercase', marginBottom: 4 }}>How you delivered it</div>
                  <div style={{ color: C.text, fontSize: 13, lineHeight: 1.7 }}>{current.delivery}</div>
                  <div style={{ color: C.muted, fontSize: 10.5, marginTop: 6, lineHeight: 1.5 }}>AI-generated from the figures in the Delivery column. It does not change your score.</div>
                </div>
              )}
              {current.betterAnswerOutline.length > 0 && <Outline items={current.betterAnswerOutline} />}
            </div>
          </Card>
          {structurePanelEnabledFor(user?.id) && <StructurePanel result={previewStructure({ question: q.question, answer })} />}
          {warnings.length > 0 && (
            <Card style={{ border: `1px solid ${C.gold}66`, background: C.gold + "0D" }}>
              <div role="alert" style={{ color: C.gold, fontWeight: 900, fontSize: 12, marginBottom: 6 }}>⚠️ Check these numbers</div>
              <div style={{ color: C.text, fontSize: 12, lineHeight: 1.6 }}>The suggestions mention figures you did not give: <strong>{warnings.join(', ')}</strong>. Only use numbers you can back up in a real interview.</div>
            </Card>
          )}
          {attempt === 1 && <div style={{ color: C.muted, fontSize: 11 }}>Retrying is practice: only your first attempt counts toward your score and history, and practice attempts are not saved.</div>}
          <ActionBar status="Feedback is ready" detail={isLast ? 'That was the last question.' : 'Read it, then move on, or practise this answer again.'}
            secondary={{ label: 'Try this answer again', onClick: tryAgain, disabled: !!busy }} primary={{ label: isLast ? 'See Results →' : 'Next Question →', onClick: () => advance(results) }} />
        </>
      )}
      </div>
    </div>
  );
}
