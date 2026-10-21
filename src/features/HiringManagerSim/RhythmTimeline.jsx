import React from 'react';
import { C } from '../../styles/theme';

// The speaking and pausing stretches of an answer as one bar, pauses of one second or more picked out. Used for the live view and for the finished answer.
// Colour of a speaking stretch by loudness against the speaker's own voice (softer, steady, louder). It says how loud, never how good.
export const TIER_COLOR = { soft: '#7DD3FC', steady: C.accent, loud: '#A78BFA' };
const TIER_LABEL = { soft: 'Softer', steady: 'Steady', loud: 'Louder' };
const swatch = (bg, extra) => ({ display: 'inline-block', width: 14, height: 8, borderRadius: 4, background: bg, marginRight: 6, verticalAlign: 'middle', ...extra });

export default function RhythmTimeline({ segments, totalSec, label }) {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const tiers = ['soft', 'steady', 'loud'].filter(k => segments.some(g => g.type === 'speech' && g.tier === k));
  return (
    <div>
      <div role="img" aria-label={label} style={{ display: 'flex', alignItems: 'center', height: 16, gap: 2, background: 'rgba(255,255,255,.05)', borderRadius: 8, padding: '0 2px' }}>
        {segments.map((g, i) => g.type === 'speech'
          ? <div key={i} data-testid="rhythm-speech" title={`Speaking, ${g.sec.toFixed(1)} s`} style={{ flexGrow: g.sec, flexBasis: 0, height: 10, borderRadius: 5, background: TIER_COLOR[g.tier] || C.accent }} />
          : <div key={i} data-testid={g.long ? 'rhythm-long-pause' : 'rhythm-pause'} title={`Pause, ${g.sec.toFixed(1)} s`} style={{ flexGrow: g.sec, flexBasis: 0, height: g.long ? 16 : 10, borderRadius: 5, background: g.long ? `${C.gold}55` : 'transparent', border: g.long ? `1px solid ${C.gold}` : 'none', boxSizing: 'border-box' }} />)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: C.muted, fontSize: 10, marginTop: 4 }}>
        <span>0 s</span><span>{Number(totalSec).toFixed(1)} s</span>
      </div>
      <div style={{ color: C.muted, fontSize: 11, marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {tiers.length === 0
          ? <span><span aria-hidden="true" style={swatch(C.accent)} />Speaking</span>
          : tiers.map(k => <span key={k}><span aria-hidden="true" style={swatch(TIER_COLOR[k])} />{TIER_LABEL[k]}</span>)}
        <span><span aria-hidden="true" style={swatch('transparent', { border: `1px dashed ${C.muted}` })} />Short pause</span>
        <span><span aria-hidden="true" style={swatch(`${C.gold}55`, { border: `1px solid ${C.gold}` })} />Pause of 1 second or more</span>
      </div>
      {tiers.length > 0 && <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Colour shows loudness compared with your own voice. It is not a grade.</div>}
    </div>
  );
}
