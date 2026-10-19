// Spins the OrbitMark logo in the browser tab icon. Google results keep the static public/favicon.svg.
const SIZE = 64;
const FPS = 12;
const PERIOD_MS = 6000;
const RX = 42, RY = 18, TILT = 28;
const CORE = 14, SW = 4.5, SATS = [6, 5.5, 5];

function drawFrame(ctx, phase) {
  const k = SIZE / 100;
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.save();
  ctx.scale(k, k);

  const g = ctx.createLinearGradient(0, 0, 100, 100);
  g.addColorStop(0, '#6366F1');
  g.addColorStop(0.55, '#EC4899');
  g.addColorStop(1, '#F59E0B');

  ctx.beginPath();
  ctx.roundRect(0, 0, 100, 100, 22);
  ctx.fillStyle = '#0B0F1A';
  ctx.fill();

  const spin = phase * Math.PI * 2;
  const rad = (d) => (d * Math.PI) / 180;

  ctx.strokeStyle = g;
  ctx.lineWidth = SW;
  ctx.globalAlpha = 0.55;
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.ellipse(50, 50, RX, RY, rad(s * TILT) + s * spin, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(50, 50, CORE, 0, Math.PI * 2);
  ctx.fill();

  SATS.forEach((r, i) => {
    const s = i % 2 === 0 ? -1 : 1;
    const t = (i % 2 === 0 ? -0.35 : 0.78) + Math.floor(i / 2) * Math.PI + spin;
    const a = rad(s * TILT) + s * spin;
    const x0 = RX * Math.cos(t), y0 = RY * Math.sin(t);
    ctx.beginPath();
    ctx.arc(50 + x0 * Math.cos(a) - y0 * Math.sin(a), 50 + x0 * Math.sin(a) + y0 * Math.cos(a), r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

export function startAnimatedFavicon() {
  try {
    if (typeof document === 'undefined') return () => {};
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return () => {};
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx || !ctx.roundRect) return () => {};

    // Other icon links would compete with ours, so drop them while the animation runs.
    const removed = [...document.querySelectorAll('link[rel="icon"]')];
    removed.forEach((el) => el.remove());
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    document.head.appendChild(link);

    const tick = () => {
      drawFrame(ctx, (Date.now() % PERIOD_MS) / PERIOD_MS);
      link.href = canvas.toDataURL('image/png');
    };
    tick();
    const timer = setInterval(() => { if (!document.hidden) tick(); }, 1000 / FPS);
    return () => {
      clearInterval(timer);
      link.remove();
      removed.forEach((el) => document.head.appendChild(el));
    };
  } catch {
    return () => {};
  }
}
