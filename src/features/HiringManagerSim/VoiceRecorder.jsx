import React, { useState, useRef, useEffect } from 'react';
import { C } from '../../styles/theme';
import { Btn } from '../../components/CommonUI';
import { transcribeAudio, MAX_RECORD_SECONDS } from '../../lib/voice.js';

// Voice practice spike: record one answer, turn it into text on the server, hand the text back to the answer box so the user can correct it
// before anything is graded. The audio lives in memory only until the transcript returns; it is never stored (decision V3).
const CONSENT_KEY = 'voice-practice-consent';
const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
const ghostBtn = { background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' };

const readConsent = () => { try { return sessionStorage.getItem(CONSENT_KEY) === '1'; } catch { return false; } };
const writeConsent = () => { try { sessionStorage.setItem(CONSENT_KEY, '1'); } catch { /* the dialog just shows again */ } };
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function VoiceRecorder({ onTranscript, disabled = false }) {
  const [stage, setStage] = useState('idle'); // idle | consent | recording | transcribing
  const [elapsed, setElapsed] = useState(0);
  const [err, setErr] = useState('');
  const [fresh, setFresh] = useState(false); // a transcript was just handed back
  const rec = useRef(null);
  const stream = useRef(null);
  const timer = useRef(null);
  const chunks = useRef([]);
  const secs = useRef(0);
  const gone = useRef(false);

  const release = () => {
    clearInterval(timer.current); timer.current = null;
    stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
  };
  useEffect(() => () => {
    gone.current = true;
    if (rec.current) { rec.current.onstop = null; rec.current.ondataavailable = null; try { if (rec.current.state === 'recording') rec.current.stop(); } catch { /* already stopped */ } }
    chunks.current = [];
    release();
  }, []);

  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices) {
    return <div style={{ color: C.muted, fontSize: 11 }}>This browser cannot record audio. Please type your answer.</div>;
  }

  const begin = async () => {
    setErr(''); setFresh(false);
    let s;
    try { s = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) {
      setStage('idle');
      setErr(e?.name === 'NotAllowedError' || e?.name === 'SecurityError'
        ? 'The microphone is blocked for this site. Allow it in your browser, or type your answer instead.'
        : 'No microphone could be used. Please type your answer instead.');
      return;
    }
    if (gone.current) { s.getTracks().forEach(t => t.stop()); return; }
    stream.current = s;
    const mimeType = TYPES.find(t => MediaRecorder.isTypeSupported?.(t));
    const r = new MediaRecorder(s, mimeType ? { mimeType } : undefined);
    rec.current = r; chunks.current = []; secs.current = 0; setElapsed(0);
    r.ondataavailable = (e) => { if (e.data?.size) chunks.current.push(e.data); };
    r.onstop = async () => {
      const blob = new Blob(chunks.current, { type: r.mimeType || mimeType || 'audio/webm' });
      chunks.current = []; release(); rec.current = null;
      if (gone.current) return;
      setStage('transcribing');
      try {
        const text = await transcribeAudio(blob, secs.current);
        if (gone.current) return;
        setStage('idle'); setFresh(true); onTranscript(text);
      } catch (e) {
        if (gone.current) return;
        setStage('idle'); setErr(e?.message || 'Transcription failed. Please try again, or type your answer.');
      }
    };
    r.start();
    setStage('recording');
    timer.current = setInterval(() => {
      secs.current += 1; setElapsed(secs.current);
      if (secs.current >= MAX_RECORD_SECONDS) stop();
    }, 1000);
  };

  const stop = () => { clearInterval(timer.current); timer.current = null; try { if (rec.current?.state === 'recording') rec.current.stop(); } catch { /* ignore */ } };
  const click = () => { if (readConsent()) begin(); else setStage('consent'); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {stage === 'consent' && (
        <div role="dialog" aria-label="Voice recording consent" style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, background: C.surface }}>
          <div style={{ color: C.text, fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>
            Your voice recording is sent to our speech provider to be turned into text. We do not keep it. You can type instead at any time.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => { writeConsent(); begin(); }} color={C.accent} dark>Continue</Btn>
            <button type="button" onClick={() => setStage('idle')} style={ghostBtn}>Cancel</button>
          </div>
        </div>
      )}
      {stage !== 'consent' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {stage === 'recording'
            ? <button type="button" onClick={stop} style={{ ...ghostBtn, color: C.text, borderColor: C.red }}>Stop recording</button>
            : <button type="button" onClick={click} disabled={disabled || stage === 'transcribing'} style={{ ...ghostBtn, opacity: disabled || stage === 'transcribing' ? 0.55 : 1 }}>Record your answer</button>}
          {stage === 'recording' && <span role="timer" style={{ color: C.muted, fontSize: 12 }}>Recording… {clock(elapsed)} of {clock(MAX_RECORD_SECONDS)}</span>}
          {stage === 'transcribing' && <span role="status" style={{ color: C.muted, fontSize: 12 }}>Turning your voice into text…</span>}
        </div>
      )}
      {fresh && stage === 'idle' && <div role="status" style={{ color: C.muted, fontSize: 11, lineHeight: 1.6 }}>Transcribed from your voice. Please check and correct it before you send it for feedback.</div>}
      {err && <div role="alert" style={{ color: C.red, fontSize: 12, lineHeight: 1.6 }}>{err}</div>}
    </div>
  );
}
