import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { C } from '../../styles/theme';
import { Btn } from '../../components/CommonUI';
import { transcribeAudio, MAX_RECORD_SECONDS } from '../../lib/voice.js';
import { createAudioMeter, isSilent, SILENT_PEAK } from '../../lib/audioMeter.js';
import { analyzeRhythm, tierCutoffs, tierOf } from '../../lib/rhythm.js';
import Waveform from './Waveform';
import LiveRhythmPanel from './LiveRhythmPanel';
import RhythmTimeline from './RhythmTimeline';

// Voice practice spike: record one answer, turn it into text on the server, hand the text back to the answer box so the user can correct it
// before anything is graded. The audio lives in memory only until the transcript returns; it is never stored (decision V3).
const CONSENT_KEY = 'voice-practice-consent';
const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
const ghostBtn = { background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' };

const readConsent = () => { try { return sessionStorage.getItem(CONSENT_KEY) === '1'; } catch { return false; } };
const writeConsent = () => { try { sessionStorage.setItem(CONSENT_KEY, '1'); } catch { /* the dialog just shows again */ } };
const RING = 2 * Math.PI * 30;
const MicIcon = () => (<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>);
const StopIcon = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5" /></svg>);
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const TIER_WORD = { soft: 'Softer', steady: 'Steady', loud: 'Louder' };
const micOf = (levels) => { // how loud the last moment was, in words, against this speaker's own range so far; a measurement, never a grade
  const v = levels.length ? levels[levels.length - 1] : 0;
  if (v < SILENT_PEAK / 2) return { v, word: 'No sound' };
  return { v, word: TIER_WORD[tierOf(v, tierCutoffs(levels.filter(x => x >= SILENT_PEAK / 2)))] };
};
const stageCard = { position: 'relative', border: `1px solid ${C.accent}80`, borderRadius: 20, padding: '16px 22px 14px', display: 'flex', flexDirection: 'column', gap: 12,
  background: `radial-gradient(55% 80% at 50% 42%, ${C.accent}1f, transparent 72%), ${C.surface}`, boxShadow: `0 0 60px ${C.accent}29` };

const VoiceRecorder = forwardRef(function VoiceRecorder({ onTranscript, onStart, onStage, disabled = false, liveTarget = null, recorded = null }, ref) {
  const [stage, setStage] = useState('idle'); // idle | consent | recording | transcribing
  const [elapsed, setElapsed] = useState(0);
  const [err, setErr] = useState('');
  const [fresh, setFresh] = useState(false); // a transcript was just handed back
  const rec = useRef(null);
  const stream = useRef(null);
  const timer = useRef(null);
  const chunks = useRef([]);
  const secs = useRef(0);
  const startedAt = useRef(0);
  const meter = useRef(null);
  const sampler = useRef(null);
  const quietMs = useRef(0);
  const levels = useRef([]);
  const liveTimer = useRef(null);
  const [liveRhythm, setLiveRhythm] = useState(null);
  const [meterNode, setMeterNode] = useState(null);
  const [quiet, setQuiet] = useState(false);
  const [mic, setMic] = useState(null);
  const gone = useRef(false);

  const release = () => {
    clearInterval(timer.current); timer.current = null;
    clearInterval(sampler.current); sampler.current = null;
    clearInterval(liveTimer.current); liveTimer.current = null; setLiveRhythm(null);
    meter.current?.close(); meter.current = null; setMeterNode(null); setQuiet(false); setMic(null);
    stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
  };
  useEffect(() => () => {
    gone.current = true;
    if (rec.current) { rec.current.onstop = null; rec.current.ondataavailable = null; try { if (rec.current.state === 'recording') rec.current.stop(); } catch { /* already stopped */ } }
    chunks.current = [];
    release();
  }, []);

  // The action bar of the page reads the stage and can start and stop the recording; the buttons in this panel keep working as well.
  useEffect(() => { onStage?.(stage); }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps
  const api = useRef({});
  useImperativeHandle(ref, () => ({ start: () => api.current.start?.(), stop: () => api.current.stop?.() }), []);

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
    meter.current = createAudioMeter(s); quietMs.current = 0; levels.current = []; setMeterNode(meter.current?.analyser || null);
    r.ondataavailable = (e) => { if (e.data?.size) chunks.current.push(e.data); };
    r.onstop = async () => {
      const durationSec = (Date.now() - startedAt.current) / 1000; // the whole recording, silence included
      const levelList = levels.current; levels.current = [];
      const blob = new Blob(chunks.current, { type: r.mimeType || mimeType || 'audio/webm' });
      const silent = meter.current ? isSilent(meter.current.peak()) : false; // read before the meter is closed
      chunks.current = []; release(); rec.current = null;
      if (gone.current) return;
      if (silent) { setStage('idle'); setErr('We could not hear any sound from your microphone. Check that it is on and not muted, then try again, or type your answer.'); return; }
      setStage('transcribing');
      try {
        const text = await transcribeAudio(blob, durationSec);
        if (gone.current) return;
        setStage('idle'); setFresh(true); onTranscript(text, { durationSec, levels: levelList, stepMs: 100 });
      } catch (e) {
        if (gone.current) return;
        setStage('idle'); setErr(e?.message || 'Transcription failed. Please try again, or type your answer.');
      }
    };
    startedAt.current = Date.now();
    r.start();
    try { onStart?.(); } catch { /* the parent's clock is not our concern */ }
    setStage('recording');
    if (meter.current) {
      sampler.current = setInterval(() => {
        let level = 1;
        try { level = meter.current ? meter.current.sample() : 1; } catch { /* a failing meter just shows no hint */ }
        if (levels.current.length < 3000) levels.current.push(level); // loudness numbers only, 5 minutes at most; kept in memory until the transcript returns
        if (level >= SILENT_PEAK) { quietMs.current = 0; setQuiet(q => (q ? false : q)); }
        else { quietMs.current += 100; if (quietMs.current >= 3000) setQuiet(true); }
      }, 100);
      // Re-measure the rhythm of what has been said so far twice a second (loudness numbers only).
      liveTimer.current = setInterval(() => { try { setMic(micOf(levels.current)); setLiveRhythm(analyzeRhythm({ levels: levels.current, stepMs: 100 })); } catch { /* the panel just keeps its last figures */ } }, 500);
    }
    timer.current = setInterval(() => {
      secs.current += 1; setElapsed(secs.current);
      if (secs.current >= MAX_RECORD_SECONDS) stop();
    }, 1000);
  };

  const stop = () => { clearInterval(timer.current); timer.current = null; try { if (rec.current?.state === 'recording') rec.current.stop(); } catch { /* ignore */ } };
  const click = () => { if (readConsent()) begin(); else setStage('consent'); };
  api.current = { start: () => { if (!disabled && stage === 'idle') click(); }, stop: () => { if (stage === 'recording') stop(); } };

  const recording = stage === 'recording';
  const showRecorded = !recording && stage !== 'consent' && recorded?.rhythm?.state === 'ok' && Number.isFinite(Number(recorded.durationSec));
  const busyText = stage === 'transcribing';
  const status = recording ? `Recording… ${clock(elapsed)} of ${clock(MAX_RECORD_SECONDS)}` : busyText ? 'Turning your voice into text…' : 'Ready when you are';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {stage === 'consent' && (
        <div role="dialog" aria-label="Voice recording consent" style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, background: C.surface }}>
          <div style={{ color: C.text, fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>
            Your voice recording is sent to our speech provider to be turned into text. We do not keep it. You can type instead at any time.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => { writeConsent(); begin(); }} color={C.accent} dark>Continue</Btn>
            <button type="button" onClick={() => setStage('idle')} style={ghostBtn}>Cancel</button>
          </div>
        </div>
      )}
      {recording && (
        <div data-testid="recording-stage" style={stageCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div role="timer" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: C.text }}>
              <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 99, background: C.red, display: 'inline-block' }} /><b>Recording</b><span style={{ color: C.muted }}>{clock(elapsed)} of {clock(MAX_RECORD_SECONDS)}</span>
            </div>
            {meterNode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: C.muted, marginLeft: 'auto' }}>
                <span>Mic level</span>
                <span role="meter" aria-label="Mic level" aria-valuemin={0} aria-valuemax={1} aria-valuenow={mic ? Math.min(1, mic.v * 3) : 0} aria-valuetext={mic ? mic.word : 'No sound'} style={{ width: 90, height: 6, borderRadius: 99, background: 'rgba(255,255,255,.08)', display: 'block', overflow: 'hidden' }}>
                  <span style={{ display: 'block', width: `${Math.round(Math.min(1, (mic?.v || 0) * 3) * 100)}%`, height: '100%', background: C.accent }} />
                </span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{mic ? mic.word : 'No sound'}</span>
              </div>
            )}
            <div role="progressbar" aria-label="Recording time" aria-valuemin={0} aria-valuemax={MAX_RECORD_SECONDS} aria-valuenow={elapsed} style={{ position: 'relative', width: 56, height: 56, flex: '0 0 56px' }}>
              <svg width="56" height="56" viewBox="0 0 72 72" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }} aria-hidden="true">
                <circle cx="36" cy="36" r="30" fill="none" stroke={C.border} strokeWidth="3" />
                <circle cx="36" cy="36" r="30" fill="none" stroke={C.red} strokeWidth="3" strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={RING * (1 - Math.min(1, elapsed / MAX_RECORD_SECONDS))} />
              </svg>
              <button type="button" onClick={stop} aria-label="Stop recording" style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: 'none', background: C.red, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><StopIcon /></button>
            </div>
          </div>
          {meterNode && <Waveform fit levelsRef={levels} height={118} />}
          {meterNode && (liveRhythm?.state === 'ok'
            ? <RhythmTimeline tall segments={liveRhythm.segments} totalSec={liveRhythm.totalSec} label="Timeline of your answer so far" />
            : <div style={{ color: C.muted, fontSize: 11 }}>The timeline of your answer appears after a few seconds of speaking.</div>)}
          {quiet && <div role="status" style={{ color: C.gold, fontSize: 12 }}>We can barely hear you. Move closer to the microphone or check that it is not muted.</div>}
        </div>
      )}
      {stage !== 'consent' && !recording && (
        <div data-testid={showRecorded ? 'recorded-card' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 12, border: `1px solid ${C.border}`, borderRadius: 16, padding: '12px 16px', background: C.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button type="button" onClick={click} disabled={disabled || busyText} aria-label="Record your answer" style={{ width: 52, height: 52, flex: '0 0 52px', borderRadius: '50%', border: 'none', background: C.accent, color: '#0b1020', cursor: disabled || busyText ? 'not-allowed' : 'pointer', opacity: disabled || busyText ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MicIcon /></button>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <div role="status" style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{showRecorded && !busyText ? `Recorded, ${Number(recorded.durationSec).toFixed(1)} s` : status}</div>
              {busyText ? null : showRecorded
                ? <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Tap the microphone to record this answer again</div>
                : <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Tap the microphone and answer out loud, up to 3 minutes.</div>}
            </div>
          </div>
          {showRecorded && !busyText && <RhythmTimeline tall segments={recorded.rhythm.segments} totalSec={recorded.rhythm.totalSec} label={`Timeline of your answer: ${recorded.rhythm.speechSec.toFixed(1)} seconds of speaking out of ${recorded.rhythm.totalSec.toFixed(1)}.`} />}
        </div>
      )}
      {recording && meterNode && (liveTarget ? createPortal(<LiveRhythmPanel rhythm={liveRhythm} />, liveTarget) : <LiveRhythmPanel rhythm={liveRhythm} />)}
      {fresh && stage === 'idle' && <div role="status" style={{ color: C.muted, fontSize: 11, lineHeight: 1.6 }}>Transcribed from your voice. Please check and correct it before you send it for feedback.</div>}
      {err && <div role="alert" style={{ color: C.red, fontSize: 12, lineHeight: 1.6 }}>{err}</div>}
    </div>
  );
});

export default VoiceRecorder;
