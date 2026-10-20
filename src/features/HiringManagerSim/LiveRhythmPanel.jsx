import React from 'react';
import { C } from '../../styles/theme';
import RhythmTimeline from './RhythmTimeline';

// Rhythm while the recording is still going. Speaking time and pauses come from loudness and are re-measured as the answer goes on; the pace needs the words,
// which exist only after the recording is turned into text, so it says so instead of showing a number. Information only.
const tile = { flex: '1 1 140px', minWidth: 120, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', background: 'rgba(255,255,255,.02)' };
const cap = { color: C.muted, fontSize: 11, lineHeight: 1.5 };
const big = { color: C.text, fontSize: 20, fontWeight: 800, lineHeight: 1.2 };

export default function LiveRhythmPanel({ rhythm }) {
  const ok = rhythm?.state === 'ok';
  return (
    <div data-testid="live-rhythm" style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', background: C.surface, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: C.text, fontSize: 13, fontWeight: 800 }}>Rhythm</span>
        <span style={{ color: C.red, fontSize: 10, fontWeight: 800, border: `1px solid ${C.red}`, borderRadius: 10, padding: '1px 8px' }}>Live</span>
      </div>
      {ok && <RhythmTimeline segments={rhythm.segments} totalSec={rhythm.totalSec} label="Live timeline of your answer so far" />}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={tile}><div style={cap}>Speaking time</div><div style={big}>{ok ? `${rhythm.speechSec.toFixed(1)} s` : '—'}</div><div style={cap}>{ok ? `of ${rhythm.totalSec.toFixed(1)} s so far` : 'measuring…'}</div></div>
        <div style={tile}><div style={cap}>Long pauses</div><div style={big}>{ok ? rhythm.longPauses : '—'}</div><div style={cap}>{ok ? (rhythm.longPauses > 0 ? `longest ${rhythm.longestPauseSec.toFixed(1)} s` : 'none so far') : 'measuring…'}</div></div>
        <div style={tile}><div style={cap}>Pace while speaking</div><div style={big}>—</div><div style={cap}>shown after you stop</div></div>
      </div>
      <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.6 }}>Live estimate from how loud your voice is. It can change as you keep speaking.</div>
    </div>
  );
}
