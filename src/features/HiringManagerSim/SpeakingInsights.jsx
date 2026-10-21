import React, { useState } from 'react';
import { C } from '../../styles/theme';
import RhythmTimeline from './RhythmTimeline';
import { RailCard, TimeHero, PauseRows, SignalFeed, label as railLabel } from './DeliveryRail';

// Speaking insights for a spoken answer: four figures, and details (the timeline and where the figures come from) that can be folded away.
// Information only: no verdict, no colour band, no target range, no score, nothing saved or sent anywhere. Without data a figure shows "—", never 0.
const tile = { flex: '1 1 150px', minWidth: 130, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px', background: 'rgba(255,255,255,.02)' };
const cap = { color: C.muted, fontSize: 11, lineHeight: 1.5 };
const big = { color: C.text, fontSize: 24, fontWeight: 800, lineHeight: 1.2 };
const unit = { color: C.muted, fontSize: 12, fontWeight: 700, marginLeft: 4 };

function Tile({ id, label, note, value, unitText, sub, children }) {
  return (
    <div data-testid={`insight-${id}`} style={tile}>
      <div style={cap}>{label}{note ? <span> ({note})</span> : null}</div>
      <div style={big}><span>{value}</span>{unitText && value !== '—' ? <> <span style={unit}>{unitText}</span></> : null}</div>
      {sub ? <div style={cap}>{sub}</div> : null}
      {children}
    </div>
  );
}

const TICKS = 40;
const PACE_MIN = 40; const PACE_MAX = 220; // a plain scale for the eye; no target, no band
const place = (wpm) => `${Math.max(0, Math.min(100, (wpm - PACE_MIN) / (PACE_MAX - PACE_MIN) * 100))}%`;
const mmss = (sec) => { const t = Math.max(0, Math.floor(sec)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
const longPauseRows = (segments) => { let t = 0; const rows = []; for (const g of segments || []) { const at = typeof g.startSec === 'number' ? g.startSec : t; if (g.type === 'pause' && g.long) rows.push({ at, sec: g.sec }); t = at + g.sec; } return rows; };

// The same figures as cards for the Delivery rail beside the answer: the timeline is not repeated here, it sits with the recording.
function RailInsights({ rate, rhythm }) {
  const hasRate = rate?.state === 'ok';
  const hasRhythm = rhythm?.state === 'ok';
  const active = hasRhythm && typeof rhythm.paceWhileSpeakingWpm === 'number' ? String(rhythm.paceWhileSpeakingWpm) : '—';
  const rows = hasRhythm ? longPauseRows(rhythm.segments) : [];
  const fig = { color: C.text, fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' };
  return (
    <div data-testid="speaking-insights" aria-label="Speaking insights" role="group" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TimeHero rhythm={rhythm} />
      <RailCard>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={railLabel}>Speaking pace</span><span style={{ ...cap, fontSize: 11 }}>Estimated</span></div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap' }}>
          <div data-testid="insight-pace"><span style={fig}>{hasRate ? String(rate.wpm) : '—'}</span>{hasRate && <span style={{ ...cap, fontSize: 13 }}> WPM</span>}<div style={cap}>incl. pauses</div></div>
          <div data-testid="insight-active"><span style={{ ...fig, color: C.accent }}>{active}</span>{active !== '—' && <span style={{ ...cap, fontSize: 13 }}> WPM</span>}<div style={cap}>while speaking</div></div>
        </div>
        {hasRhythm && (
          <div data-testid="pace-scale">
            <div style={{ position: 'relative', height: 22 }}>
              <span style={{ position: 'absolute', left: 0, right: 0, top: 9, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.08)' }} />
              {hasRate && <span data-marker="pace" title={`${rate.wpm} WPM incl. pauses`} style={{ position: 'absolute', top: 3, left: place(rate.wpm), width: 3, height: 16, borderRadius: 2, background: C.text }} />}
              {active !== '—' && <span data-marker="active" title={`${active} WPM while speaking`} style={{ position: 'absolute', top: 3, left: place(rhythm.paceWhileSpeakingWpm), width: 3, height: 16, borderRadius: 2, background: C.accent }} />}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: C.muted, fontSize: 11, gap: 8 }}><span>{PACE_MIN}</span><span>No target is set. Pace is not a grade.</span><span>{PACE_MAX}</span></div>
          </div>
        )}
        {hasRate && (
          <div data-testid="speaking-rate" style={{ ...cap, color: C.text }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Estimated Speaking Rate: {rate.wpm} WPM</div>
            <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Estimated from your transcript and total recording duration. Transcription errors and pauses may affect this result.</div>
          </div>
        )}
      </RailCard>
      {hasRhythm && (
        <RailCard data-testid="insight-pauses" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={railLabel}>Pauses of 1 second or more</span><b style={{ color: C.text }}>{rhythm.longPauses}</b></div>
          <div data-testid="pause-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.length === 0 ? <div style={cap}>None of 1 second or more.</div> : <PauseRows rows={rows} />}
          </div>
        </RailCard>
      )}
      <SignalFeed rhythm={rhythm} />
      {hasRhythm && <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.6 }}>Measured on your device from how loud your voice was. Background noise can affect it.</div>}
    </div>
  );
}

export default function SpeakingInsights({ rate, rhythm, variant }) {
  if (variant === 'rail') return <RailInsights rate={rate} rhythm={rhythm} />;
  const hasRate = rate?.state === 'ok';
  const hasRhythm = rhythm?.state === 'ok';
  const [open, setOpen] = useState(true);
  const showDetails = (hasRate || hasRhythm) && open;
  return (
    <section data-testid="speaking-insights" aria-label="Speaking insights" style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px', background: C.surface, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ color: C.text, fontSize: 14, fontWeight: 800 }}>Speaking insights</div>
          <span style={{ color: C.muted, fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 99, padding: '1px 10px' }}>Information only</span>
        </div>
        {(hasRate || hasRhythm) && (
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{open ? 'Hide details' : 'Show details'}</button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Tile id="pace" label="Speaking pace" note="incl. pauses" value={hasRate ? String(rate.wpm) : '—'} unitText="WPM" />
        <Tile id="active" label="Active pace" note="excl. pauses" value={hasRhythm && typeof rhythm.paceWhileSpeakingWpm === 'number' ? String(rhythm.paceWhileSpeakingWpm) : '—'} unitText="WPM" />
        <Tile id="time" label="Speaking time" value={hasRhythm ? `${rhythm.speechSec.toFixed(1)} s` : '—'} sub={hasRhythm ? `of ${rhythm.totalSec.toFixed(1)} s · ${rhythm.speechPercent}%` : null}>
          {hasRhythm && (
            <div data-testid="time-ticks" aria-hidden="true" style={{ display: 'flex', gap: 2, height: 16, marginTop: 8 }}>
              {Array.from({ length: TICKS }, (_, i) => <span key={i} data-on={i < Math.round(rhythm.speechPercent / 100 * TICKS) ? 'true' : 'false'} style={{ flex: 1, minWidth: 0, borderRadius: 2, background: i < Math.round(rhythm.speechPercent / 100 * TICKS) ? C.accent : 'rgba(255,255,255,.08)' }} />)}
            </div>
          )}
        </Tile>
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
          {hasRhythm && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
            <div data-testid="pace-scale">
              <div style={{ color: C.text, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Pace on one scale</div>
              <div style={{ position: 'relative', height: 22 }}>
                <span style={{ position: 'absolute', left: 0, right: 0, top: 9, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.08)' }} />
                {hasRate && <span data-marker="pace" title={`${rate.wpm} WPM incl. pauses`} style={{ position: 'absolute', top: 3, left: place(rate.wpm), width: 3, height: 16, borderRadius: 2, background: C.text }} />}
                {typeof rhythm.paceWhileSpeakingWpm === 'number' && <span data-marker="active" title={`${rhythm.paceWhileSpeakingWpm} WPM while speaking`} style={{ position: 'absolute', top: 3, left: place(rhythm.paceWhileSpeakingWpm), width: 3, height: 16, borderRadius: 2, background: C.accent }} />}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: C.muted, fontSize: 11, marginTop: 2, gap: 8 }}><span>{PACE_MIN}</span><span>No target is set. Pace is not a grade.</span><span>{PACE_MAX}</span></div>
            </div>
            <div data-testid="pause-list">
              <div style={{ color: C.text, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Pauses of 1 second or more</div>
              {longPauseRows(rhythm.segments).length === 0
                ? <div style={cap}>None of 1 second or more.</div>
                : longPauseRows(rhythm.segments).map((r, i, all) => (
                  <div key={i} data-testid="pause-row" style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: C.text, marginBottom: 4 }}>
                    <span style={{ width: 44, color: C.muted, fontFamily: 'var(--font-mono, monospace)' }}>{mmss(r.at)}</span>
                    <span aria-hidden="true" style={{ flex: 1, maxWidth: 200, height: 6, borderRadius: 99, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${r.sec / Math.max(...all.map(x => x.sec)) * 100}%`, background: C.gold }} /></span>{' '}
                    <span style={{ width: 44, textAlign: 'right' }}>{r.sec.toFixed(1)} s</span>
                  </div>
                ))}
            </div>
          </div>}
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
