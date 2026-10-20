import React from 'react';
import { C } from '../../styles/theme';
import RhythmTimeline from './RhythmTimeline';

// Speech rhythm figures (voice practice). A timeline of how the answer flowed (speaking stretches and pauses, pauses of one second or more picked out) and
// three plain figures. Information only: no verdict, no target range, no score, nothing saved or sent anywhere.
const tile = { flex: '1 1 150px', minWidth: 130, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', background: 'rgba(255,255,255,.02)' };
const big = { color: C.text, fontSize: 22, fontWeight: 800, lineHeight: 1.2 };
const cap = { color: C.muted, fontSize: 11, lineHeight: 1.5, marginTop: 2 };

const plural = (n) => (n === 1 ? '1 pause' : `${n} pauses`);

export default function RhythmNote({ result }) {
  if (result?.state !== 'ok') return null; // too short, or no sound: show nothing rather than made-up figures
  const segs = Array.isArray(result.segments) ? result.segments : [];
  const label = `Timeline of your answer: ${result.speechSec.toFixed(1)} seconds of speaking out of ${result.totalSec.toFixed(1)}, and ${plural(result.longPauses)} of 1 second or more.`;
  return (
    <div data-testid="rhythm" style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', background: C.surface, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ color: C.text, fontSize: 13, fontWeight: 800 }}>Rhythm</div>
        <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>How your answer flowed, from start to finish.</div>
      </div>

      <RhythmTimeline segments={segs} totalSec={result.totalSec} label={label} />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={tile}>
          <div style={cap}>Speaking time</div>
          <div style={big}>{result.speechSec.toFixed(1)} s</div>
          <div style={cap}>of {result.totalSec.toFixed(1)} s · {result.speechPercent}%</div>
        </div>
        <div style={tile}>
          <div style={cap}>Long pauses</div>
          <div style={big}>{result.longPauses}</div>
          <div style={cap}>{result.longPauses > 0 ? `longest ${result.longestPauseSec.toFixed(1)} s` : 'none of 1 second or more'}</div>
        </div>
        {typeof result.paceWhileSpeakingWpm === 'number' && (
          <div style={tile}>
            <div style={cap}>Pace while speaking</div>
            <div style={big}>{result.paceWhileSpeakingWpm} WPM</div>
            <div style={cap}>words per minute of speech</div>
          </div>
        )}
      </div>

      <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.6 }}>
        Measured on your device from how loud your voice was. Background noise can affect it.
      </div>
    </div>
  );
}
