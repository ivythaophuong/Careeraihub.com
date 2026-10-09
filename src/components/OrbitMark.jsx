import React, { useId } from 'react';

const G1 = '#6366F1', G3 = '#EC4899', G4 = '#F59E0B';

// Core animated orbit mark — direct port from motion-app.jsx design system
export function OrbitMark({ size = 32, satelliteCount = 3, animated = false, duration = 18, variant = 'gradient' }) {
  const id = useId().replace(/:/g, '');
  const fill = variant === 'mono-light' ? '#FFFFFF' : variant === 'mono-dark' ? '#0B0F1A' : `url(#${id}-g)`;
  const rx = 42, ry = 18, tilt = 28;

  const perOrbit = Math.ceil(satelliteCount / 2);
  const sats = Array.from({ length: satelliteCount }, (_, i) => {
    const orbit = i % 2 === 0 ? 'A' : 'B';
    const idx = Math.floor(i / 2);
    const sweep = (Math.PI * 2) / perOrbit;
    const phase = orbit === 'A' ? -0.35 : 0.78;
    const t = phase + idx * sweep;
    return { orbit, t, r: i === 0 ? 4.5 : i === 1 ? 4 : 3.5 };
  });

  const orbitPoint = (tiltDeg, t) => {
    const x0 = rx * Math.cos(t), y0 = ry * Math.sin(t);
    const r = (tiltDeg * Math.PI) / 180;
    return { x: 50 + x0 * Math.cos(r) - y0 * Math.sin(r), y: 50 + x0 * Math.sin(r) + y0 * Math.cos(r) };
  };

  const centeredPath = `M ${50 - rx} 50 a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0 Z`;

  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id={`${id}-g`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={G1} />
          <stop offset="55%" stopColor={G3} />
          <stop offset="100%" stopColor={G4} />
        </linearGradient>
        <path id={`${id}-p`} d={centeredPath} />
      </defs>

      <g style={animated ? { transformOrigin:'50px 50px', animation:`orbit-spin-cw ${duration}s linear infinite` } : {}}>
        <ellipse cx="50" cy="50" rx={rx} ry={ry} transform={`rotate(${-tilt} 50 50)`} stroke={fill} strokeWidth="2" opacity="0.32" />
      </g>
      <g style={animated ? { transformOrigin:'50px 50px', animation:`orbit-spin-ccw ${duration}s linear infinite` } : {}}>
        <ellipse cx="50" cy="50" rx={rx} ry={ry} transform={`rotate(${tilt} 50 50)`} stroke={fill} strokeWidth="2" opacity="0.32" />
      </g>

      <circle cx="50" cy="50" r="11" fill={fill} />

      {sats.map((s, i) => {
        if (!animated) {
          const p = orbitPoint(s.orbit === 'A' ? -tilt : tilt, s.t);
          return <circle key={i} cx={p.x} cy={p.y} r={s.r} fill={fill} />;
        }
        const begin = `${-((s.t / (Math.PI * 2)) * duration).toFixed(2)}s`;
        const tiltDeg = s.orbit === 'A' ? -tilt : tilt;
        return (
          <g key={i} transform={`rotate(${tiltDeg} 50 50)`}>
            <circle r={s.r} fill={fill}>
              <animateMotion dur={`${duration}s`} repeatCount="indefinite" begin={begin}>
                <mpath href={`#${id}-p`} />
              </animateMotion>
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

// Spinner preset — fast (6s), gradient, used for loading states
export function OrbitSpinner({ size = 32 }) {
  return <OrbitMark size={size} animated duration={6} />;
}

// Full-screen app loader — dark background, centered mark + label
export function AppLoader({ label = 'Loading…' }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0B0F1A',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 24, zIndex: 9999,
    }}>
      <OrbitMark size={72} animated duration={6} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.65)', letterSpacing: '.04em' }}>{label}</span>
        <div style={{ width: 160, height: 3, background: 'rgba(255,255,255,.08)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: '60%', height: '100%', background: `linear-gradient(90deg, ${G1}, ${G3})`, borderRadius: 2, animation: 'orbit-loader-bar 1.8s ease-in-out infinite' }} />
        </div>
      </div>
      <style>{`@keyframes orbit-loader-bar{0%{transform:translateX(-100%)}100%{transform:translateX(280%)}}`}</style>
    </div>
  );
}
