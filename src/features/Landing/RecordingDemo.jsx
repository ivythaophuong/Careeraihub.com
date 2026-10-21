import React, { useState, useEffect, useRef } from 'react';

// An illustration of the voice screen while it records: bars that move like a live sound, coloured by how loud each moment is against the speaker's own voice
// (the same colours and words as the app), a clock that counts up, and a timeline that fills as the answer goes on. It is a drawing, not a measurement: it says so,
// and it shows no figure as text (the clock is drawn from an attribute), so nothing here can be read as a result.
const BARS = 56;
const LOOP = 28; // seconds the clock and the timeline take to go round
const tierOf = (i) => {
  if ((i >= 13 && i <= 17) || (i >= 38 && i <= 41)) return 'pause';
  const k = (i * 7 + 3) % 10;
  return k < 3 ? 'soft' : k < 7 ? 'steady' : 'loud';
};
const RANGE = { soft: [0.18, 0.45], steady: [0.28, 0.8], loud: [0.45, 1], pause: [0.1, 0.1] };
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const reducedMotion = () => { try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

const bars = Array.from({ length: BARS }, (_, i) => {
  const tier = tierOf(i); const [lo, hi] = RANGE[tier];
  return { i, tier, style: { '--lo': lo, '--hi': hi, '--dur': `${(0.7 + ((i * 37) % 9) / 10).toFixed(2)}s`, '--delay': `${(-((i * 53) % 13) / 10).toFixed(1)}s` } };
});
// The timeline: runs of the same tier become one block, as the app draws them.
const runs = bars.reduce((acc, b) => { const last = acc[acc.length - 1]; if (last && last.tier === b.tier) last.n += 1; else acc.push({ tier: b.tier, n: 1 }); return acc; }, []);

export default function RecordingDemo() {
  const reduced = useRef(reducedMotion()).current;
  const root = useRef(null);
  const [sec, setSec] = useState(reduced ? 16 : 0);

  useEffect(() => {
    if (reduced) return undefined;
    const iv = setInterval(() => {
      if (root.current?.closest?.('.nl')?.getAttribute('data-motion') === 'paused') return;
      setSec(s => (s + 1) % LOOP);
    }, 1000);
    return () => clearInterval(iv);
  }, [reduced]);

  return (
    <div className="nl-rec" ref={root} role="img" aria-label="Illustration of recording a spoken answer: the sound is drawn as it is heard, each moment coloured by how loud it is compared with your own voice, with a clock and a timeline of the answer so far">
      <div className="nl-rec-top" aria-hidden="true">
        <span className="nl-rec-dot" /><b>Recording</b><span className="nl-rec-time" data-t={fmt(sec)} />
        <span className="nl-rec-tag">Illustration</span>
        <span className="nl-rec-stop"><i /></span>
      </div>
      <div className="nl-rec-wave" aria-hidden="true">
        {bars.map(b => <i key={b.i} className={`nl-rec-bar is-${b.tier}`} style={b.style} />)}
      </div>
      <div className="nl-rec-strip" aria-hidden="true">
        {runs.map((r, i) => <i key={i} className={`is-${r.tier}`} style={{ flexGrow: r.n }} />)}
        <span className="nl-rec-mask" />
      </div>
      <div className="nl-rec-legend" aria-hidden="true">
        <span><i className="is-soft" />Softer</span><span><i className="is-steady" />Steady</span><span><i className="is-loud" />Louder</span><span><i className="is-pause" />Pause</span>
      </div>
    </div>
  );
}
