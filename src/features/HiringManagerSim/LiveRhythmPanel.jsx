import React from 'react';
import { C } from '../../styles/theme';
import { RailCard, TimeHero, PauseRows, SignalFeed, label } from './DeliveryRail';

// The figures while the recording is still going, as the cards of the Delivery rail. Speaking time and pauses come from loudness and are re-measured as the answer goes on;
// the pace needs the words, which exist only after the recording is turned into text, so it says so instead of showing a number. The timeline itself sits in the recording stage. Information only.
const cap = { color: C.muted, fontSize: 11.5, lineHeight: 1.5 };

export default function LiveRhythmPanel({ rhythm }) {
  const ok = rhythm?.state === 'ok';
  const rows = ok ? rhythm.segments.filter(g => g.type === 'pause' && g.long).map(g => ({ at: g.startSec, sec: g.sec })) : [];
  return (
    <div data-testid="live-rhythm" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: C.text, fontSize: 13, fontWeight: 800 }}>Rhythm</span>
        <span style={{ color: C.red, fontSize: 10, fontWeight: 800, border: `1px solid ${C.red}`, borderRadius: 10, padding: '1px 8px' }}>Live</span>
      </div>
      <TimeHero rhythm={rhythm} sub={ok ? `${rhythm.speechSec.toFixed(1)} s of ${rhythm.totalSec.toFixed(1)} s so far` : undefined} />
      <RailCard>
        <span style={label}>Pace while speaking</span>
        <div style={{ color: C.text, fontSize: 34, fontWeight: 800 }}>—</div>
        <div style={cap}>Shown after you stop: pace needs your words, so it is worked out once the recording is turned into text.</div>
      </RailCard>
      <RailCard>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={label}>Pauses of 1 second or more</span><b style={{ color: C.text }}>{ok ? rhythm.longPauses : '—'}</b></div>
        {ok ? (rows.length === 0 ? <div style={cap}>None so far.</div> : <PauseRows rows={rows} />) : <div style={cap}>measuring…</div>}
      </RailCard>
      <SignalFeed rhythm={rhythm} live />
      <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.6 }}>Live estimate from how loud your voice is. It can change as you keep speaking.</div>
    </div>
  );
}
