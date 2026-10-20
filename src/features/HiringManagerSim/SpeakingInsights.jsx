import React, { useState } from 'react';
import { C } from '../../styles/theme';
import RhythmTimeline from './RhythmTimeline';

// Speaking insights for a spoken answer: four figures, and details (the timeline and where the figures come from) that can be folded away.
// Information only: no verdict, no colour band, no target range, no score, nothing saved or sent anywhere. Without data a figure shows "—", never 0.
const tile = { flex: '1 1 150px', minWidth: 130, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px', background: 'rgba(255,255,255,.02)' };
const cap = { color: C.muted, fontSize: 11, lineHeight: 1.5 };
const big = { color: C.text, fontSize: 24, fontWeight: 800, lineHeight: 1.2 };
const unit = { color: C.muted, fontSize: 12, fontWeight: 700, marginLeft: 4 };

function Tile({ id, label, note, value, unitText, sub }) {
  return (
    <div data-testid={`insight-${id}`} style={tile}>
      <div style={cap}>{label}{note ? <span> ({note})</span> : null}</div>
      <div style={big}><span>{value}</span>{unitText && value !== '—' ? <> <span style={unit}>{unitText}</span></> : null}</div>
      {sub ? <div style={cap}>{sub}</div> : null}
    </div>
  );
}

export default function SpeakingInsights({ rate, rhythm }) {
  const hasRate = rate?.state === 'ok';
  const hasRhythm = rhythm?.state === 'ok';
  const [open, setOpen] = useState(true);
  const showDetails = (hasRate || hasRhythm) && open;
  return (
    <section data-testid="speaking-insights" aria-label="Speaking insights" style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px', background: C.surface, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ color: C.text, fontSize: 14, fontWeight: 800 }}>Speaking insights</div>
        {(hasRate || hasRhythm) && (
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{open ? 'Hide details' : 'Show details'}</button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Tile id="pace" label="Speaking pace" note="incl. pauses" value={hasRate ? String(rate.wpm) : '—'} unitText="WPM" />
        <Tile id="active" label="Active pace" note="excl. pauses" value={hasRhythm && typeof rhythm.paceWhileSpeakingWpm === 'number' ? String(rhythm.paceWhileSpeakingWpm) : '—'} unitText="WPM" />
        <Tile id="time" label="Speaking time" value={hasRhythm ? `${rhythm.speechSec.toFixed(1)} s` : '—'} sub={hasRhythm ? `of ${rhythm.totalSec.toFixed(1)} s · ${rhythm.speechPercent}%` : null} />
        <Tile id="pauses" label="Long pauses" value={hasRhythm ? String(rhythm.longPauses) : '—'} sub={hasRhythm ? (rhythm.longPauses > 0 ? `longest ${rhythm.longestPauseSec.toFixed(1)} s` : 'none of 1 second or more') : null} />
      </div>
      {showDetails && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {hasRate && (
            <div data-testid="speaking-rate" style={{ ...cap, color: C.text }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Estimated Speaking Rate: {rate.wpm} WPM</div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Estimated from your transcript and total recording duration. Transcription errors and pauses may affect this result.</div>
            </div>
          )}
          {hasRhythm && (
            <div data-testid="rhythm">
              <div style={{ color: C.text, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Rhythm</div>
              <RhythmTimeline segments={rhythm.segments} totalSec={rhythm.totalSec}
                label={`Timeline of your answer: ${rhythm.speechSec.toFixed(1)} seconds of speaking out of ${rhythm.totalSec.toFixed(1)}, and ${rhythm.longPauses === 1 ? '1 pause' : `${rhythm.longPauses} pauses`} of 1 second or more.`} />
              <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.6, marginTop: 6 }}>Measured on your device from how loud your voice was. Background noise can affect it.</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
