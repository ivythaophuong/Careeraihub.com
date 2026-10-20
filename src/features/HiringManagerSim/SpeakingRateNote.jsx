import React from 'react';
import { C } from '../../styles/theme';

// Estimated speaking rate (user story D1). Information only: no verdict, no colour band, no target range, and it feeds no score.
export default function SpeakingRateNote({ result }) {
  if (result?.state !== 'ok') return null; // no usable transcript or length: show nothing rather than a made-up number
  return (
    <div data-testid="speaking-rate" style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', background: C.surface }}>
      <div style={{ color: C.muted, fontSize: 11, fontWeight: 700 }}>Estimated Speaking Rate</div>
      <div style={{ color: C.text, fontSize: 18, fontWeight: 800, marginTop: 2 }}>{result.wpm} WPM</div>
      <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.6, marginTop: 2 }}>
        Estimated from your transcript and total recording duration. Transcription errors and pauses may affect this result.
      </div>
    </div>
  );
}
