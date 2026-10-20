import React from 'react';
import { C } from '../../styles/theme';

// Speech rhythm figures (voice practice). Information only: no verdict, no colour band, no target range, no score, nothing saved or sent anywhere.
export default function RhythmNote({ result }) {
  if (result?.state !== 'ok') return null; // too short, or no sound: show nothing rather than made-up figures
  const row = { color: C.text, fontSize: 13, lineHeight: 1.7 };
  return (
    <div data-testid="rhythm" style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', background: C.surface }}>
      <div style={{ color: C.muted, fontSize: 11, fontWeight: 700 }}>Rhythm</div>
      <div style={row}>Speaking time: {result.speechSec.toFixed(1)} s of {result.totalSec.toFixed(1)} s ({result.speechPercent}%)</div>
      <div style={row}>Pauses of 1 second or more: {result.longPauses}{result.longPauses > 0 ? ` (longest ${result.longestPauseSec.toFixed(1)} s)` : ''}</div>
      {typeof result.paceWhileSpeakingWpm === 'number' && <div style={row}>Pace while speaking: {result.paceWhileSpeakingWpm} WPM</div>}
      <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.6, marginTop: 4 }}>
        Measured on your device from how loud your voice was. Background noise can affect it.
      </div>
    </div>
  );
}
