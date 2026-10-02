import { AXES, AXIS_LABELS } from './questions';

// Draws a 1200x630 image of the result for sharing on LinkedIn or Facebook.
export function downloadShareCard(personaName, scores) {
  const W = 1200, H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#090C12';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W - 200, 120, 40, W - 200, 120, 520);
  glow.addColorStop(0, 'rgba(236,72,153,0.28)');
  glow.addColorStop(1, 'rgba(236,72,153,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const font = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.fillStyle = '#EC4899';
  ctx.font = `700 26px ${font}`;
  ctx.fillText('MY WORK CULTURE PERSONA', 80, 100);

  ctx.fillStyle = '#E8F0FE';
  ctx.font = `800 76px ${font}`;
  ctx.fillText(personaName, 80, 190);

  AXES.forEach((axis, i) => {
    const y = 270 + i * 58;
    ctx.fillStyle = '#9AA9C4';
    ctx.font = `600 26px ${font}`;
    ctx.fillText(AXIS_LABELS[axis], 80, y + 24);
    ctx.fillStyle = '#1E2D45';
    ctx.fillRect(330, y, 560, 26);
    ctx.fillStyle = '#EC4899';
    ctx.fillRect(330, y, (560 * scores[axis]) / 100, 26);
    ctx.fillStyle = '#E8F0FE';
    ctx.font = `700 26px ${font}`;
    ctx.fillText(String(scores[axis]), 910, y + 24);
  });

  ctx.fillStyle = '#9AA9C4';
  ctx.font = `500 26px ${font}`;
  ctx.fillText('Find yours free at careeraihub.com/culture-quiz', 80, 580);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-work-culture-persona.png';
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
