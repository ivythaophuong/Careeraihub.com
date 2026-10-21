import React, { useEffect, useRef } from 'react';
import { C } from '../../styles/theme';
import { columnsOf, SILENT_PEAK } from '../../lib/audioMeter.js';
import { tierCutoffs, tierOf } from '../../lib/rhythm.js';
import { TIER_COLOR } from './RhythmTimeline';
import { MAX_RECORD_SECONDS } from '../../lib/voice.js';

// The recording so far, drawn left to right across the whole 3 minutes: the loudness of each stretch so far, faint dots for the time still to come and a line at
// the present moment. It reads loudness numbers from `levelsRef` (one per 100 ms) and keeps nothing. With reduced motion it redraws a few times a second.
const PER_COLUMN = 8; // 0.8 s per column
const COLUMNS = Math.ceil((MAX_RECORD_SECONDS * 10) / PER_COLUMN);
const reduced = () => { try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

const FIT_COLUMNS = 64; const FIT_MIN = 24;

// With `fit` the whole width shows the answer so far (the bars get narrower as the answer grows) instead of the whole 3 minutes with the time still to come.
export default function Waveform({ levelsRef, height = 56, fit = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext?.('2d');
    if (!g) return undefined;
    const slow = reduced();
    let raf = 0; let timer = 0; let stopped = false;
    const pill = (x, y, w, h) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, w / 2); else g.rect(x, y, w, h); g.fill(); };
    const draw = () => {
      if (stopped) return;
      const all = levelsRef?.current || [];
      const per = fit ? Math.max(1, Math.ceil(all.length / FIT_COLUMNS)) : PER_COLUMN;
      const cols = columnsOf(all, per, fit ? FIT_COLUMNS : COLUMNS);
      const total = fit ? Math.max(cols.length, FIT_MIN) : COLUMNS;
      const w = canvas.width; const h = canvas.height; const step = w / total; const bw = Math.max(1.5, step * 0.55);
      g.clearRect(0, 0, w, h);
      const cut = tierCutoffs(cols.filter(v => v >= SILENT_PEAK / 2)); // colour: softer, steady or louder than the rest of this recording
      for (let i = 0; i < total; i++) {
        const x = i * step + (step - bw) / 2;
        if (i < cols.length) {
          const bh = Math.max(3, Math.min(h, cols[i] * h * 3.2));
          g.fillStyle = cols[i] >= SILENT_PEAK / 2 ? TIER_COLOR[tierOf(cols[i], cut)] : C.muted; g.globalAlpha = 0.45 + Math.min(0.55, cols[i] * 2);
          pill(x, (h - bh) / 2, bw, bh);
        } else {
          g.fillStyle = C.muted; g.globalAlpha = 0.35;
          pill(x, (h - 3) / 2, bw, 3);
        }
      }
      g.globalAlpha = 1;
      g.fillStyle = C.text;
      g.fillRect(Math.min(w - 2, cols.length * step), 0, 2, h); // the present moment
      if (slow) timer = setTimeout(draw, 250); else raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { stopped = true; cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [levelsRef, fit]);
  return <canvas ref={ref} role="img" aria-label="Live sound from your microphone" width={900} height={height} style={{ width: '100%', height }} />;
}
