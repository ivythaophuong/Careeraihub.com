import React from 'react';
import { C } from '../../styles/theme';
import { signalFeed, mmss } from './signalFeed';

// The right-hand column of the voice answer screen ("Delivery"): only figures the product measures itself, as cards. Information only: no verdict, no target, no score.
// The same cards serve the live view (while recording) and the finished answer.
const MONO = 'var(--font-mono, ui-monospace, monospace)';
const card = { border: `1px solid ${C.border}`, borderRadius: 16, padding: '12px 16px', background: C.surface, display: 'flex', flexDirection: 'column', gap: 8 };
export const label = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted };
const cap = { color: C.muted, fontSize: 11.5, lineHeight: 1.5 };
const TICKS = 40;

export const RailCard = ({ children, style, ...rest }) => <div style={{ ...card, ...style }} {...rest}>{children}</div>;

export default function DeliveryRail({ children, slotRef }) {
  return (
    <aside data-testid="delivery-rail" aria-label="Delivery" style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ ...label, fontSize: 11, letterSpacing: '0.12em' }}>Delivery</span>
        <span style={{ fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 99, padding: '2px 10px', color: C.muted }}>Information only</span>
      </div>
      <div ref={slotRef} style={{ display: 'contents' }} />
      {children}
      <div style={{ border: `1px dashed ${C.border}`, borderRadius: 16, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: C.muted }}>
        <span style={label}>Delivery note</span>
        <span>After you press Get AI Feedback, a short note on how you delivered it appears here, written by AI from these figures. It does not change your score.</span>
      </div>
    </aside>
  );
}

// Speaking time as one big figure with a row of ticks. `pending` shows a dash while there is nothing to measure yet.
export function TimeHero({ rhythm, sub }) {
  const ok = rhythm?.state === 'ok';
  const on = ok ? Math.round(rhythm.speechPercent / 100 * TICKS) : 0;
  return (
    <div data-testid="insight-time" style={{ ...card, gap: 6, background: `linear-gradient(160deg, ${C.accent}1f, ${C.surface} 70%)` }}>
      <span style={label}>Speaking time</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ color: C.text, fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{ok ? String(rhythm.speechPercent) : '—'}{ok && <span style={{ fontSize: 22 }}>%</span>}</span>
        <span style={cap}>{ok ? (sub || `${rhythm.speechSec.toFixed(1)} s of ${rhythm.totalSec.toFixed(1)} s`) : 'measuring…'}</span>
      </div>
      {ok && (
        <div data-testid="time-ticks" aria-hidden="true" style={{ display: 'flex', gap: 3, height: 30 }}>
          {Array.from({ length: TICKS }, (_, i) => <span key={i} data-on={i < on ? 'true' : 'false'} style={{ flex: 1, minWidth: 0, borderRadius: 2, background: i < on ? C.accent : 'rgba(255,255,255,.08)' }} />)}
        </div>
      )}
    </div>
  );
}

// Rows for the pauses of a second or more: when it started, a bar scaled to the longest, how long.
export function PauseRows({ rows }) {
  const max = Math.max(...rows.map(r => r.sec));
  return rows.map((r, i) => (
    <div key={i} data-testid="pause-row" style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5, color: C.text }}>
      <span style={{ width: 44, color: C.muted, fontFamily: MONO }}>{mmss(r.at)}</span>
      <span aria-hidden="true" style={{ flex: 1, height: 6, borderRadius: 99, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${r.sec / max * 100}%`, background: C.gold }} /></span>{' '}
      <span style={{ width: 44, textAlign: 'right' }}>{r.sec.toFixed(1)} s</span>
    </div>
  ));
}

export function SignalFeed({ rhythm, live = false }) {
  const rows = signalFeed(rhythm, { live });
  if (rows.length === 0) return null;
  return (
    <RailCard data-testid="signal-feed" style={{ gap: 6 }}>
      <span style={label}>Signal feed</span>
      {rows.map((r, i) => (
        <div key={i} data-testid="feed-row" style={{ display: 'flex', alignItems: 'baseline', gap: 12, fontSize: 13, color: C.text }}>
          <span style={{ fontFamily: MONO, color: C.muted, width: 44 }}>{r.at}</span><span style={{ flex: 1 }}>{r.what}</span><span style={{ color: C.muted, fontSize: 12 }}>{r.note}</span>
        </div>
      ))}
    </RailCard>
  );
}
