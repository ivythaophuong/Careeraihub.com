import React, { useEffect, useRef } from 'react';
import { C } from '../../styles/theme';
import { barsOf } from '../../lib/audioMeter.js';

// Live sound from the microphone, drawn as bars. It reads levels from the analyser and keeps nothing. With reduced motion it redraws a few times a second.
const BARS = 36;
const reduced = () => { try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export default function Waveform({ analyser, height = 44 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext?.('2d');
    if (!analyser || !g) return undefined;
    const buf = new Uint8Array(analyser.fftSize || 1024);
    const smooth = new Array(BARS).fill(0);
    const slow = reduced();
    let raf = 0; let timer = 0; let stopped = false;
    const draw = () => {
      if (stopped) return;
      analyser.getByteTimeDomainData(buf);
      const bars = barsOf(buf, BARS);
      const w = canvas.width; const h = canvas.height; const step = w / BARS; const bw = Math.max(2, step * 0.55);
      g.clearRect(0, 0, w, h);
      g.fillStyle = C.accent;
      for (let i = 0; i < BARS; i++) {
        smooth[i] = Math.max(bars[i], smooth[i] * 0.82); // quick up, gentle down
        const bh = Math.max(3, Math.min(h, smooth[i] * h * 3.2));
        const x = i * step + (step - bw) / 2;
        g.globalAlpha = 0.45 + Math.min(0.55, smooth[i] * 2);
        g.beginPath();
        if (g.roundRect) g.roundRect(x, (h - bh) / 2, bw, bh, bw / 2); else g.rect(x, (h - bh) / 2, bw, bh);
        g.fill();
      }
      g.globalAlpha = 1;
      if (slow) timer = setTimeout(draw, 250); else raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { stopped = true; cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [analyser]);
  return <canvas ref={ref} role="img" aria-label="Live sound from your microphone" width={360} height={height} style={{ width: '100%', maxWidth: 360, height }} />;
}
