// In the light theme the Builder's own page colours must be light too: before, --atb-bg and --atb-text were one dark set on :root,
// so the page stayed dark while the title took the dark text of the light theme (unreadable).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.resolve(__dirname, 'atsBuilder.css'), 'utf8');
const lum = (hex) => { const h = hex.replace('#', ''); const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const light = (css.match(/\[data-theme="light"\] \.atb\s*\{([^}]*)\}/) || [])[1] || '';
const val = (name) => (light.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`)) || [])[1];

describe('Builder light theme', () => {
  it('sets its own page and text colours', () => {
    for (const n of ['--atb-bg', '--atb-bg2', '--atb-bg3', '--atb-bg4', '--atb-text']) expect(val(n), n).toBeTruthy();
    expect(light).toMatch(/--atb-bdr:/);
    expect(light).toMatch(/--atb-text2:/);
    expect(light).toMatch(/--atb-text3:/);
  });

  it('the page is light and the text is dark on it, 4.5 to 1 or more, on every surface', () => {
    expect(lum(val('--atb-bg'))).toBeGreaterThan(0.8);
    for (const n of ['--atb-bg', '--atb-bg2', '--atb-bg3', '--atb-bg4']) expect(ratio(val('--atb-text'), val(n)), n).toBeGreaterThanOrEqual(4.5);
  });

  it('the status colours used for text are 4.5 to 1 or more on the light page and cards', () => {
    for (const c of ['--atb-red', '--atb-amber', '--atb-violet', '--atb-teal', '--atb-green']) {
      expect(val(c), c).toBeTruthy();
      for (const n of ['--atb-bg', '--atb-bg2']) expect(ratio(val(c), val(n)), `${c} on ${n}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the dark theme keeps the original set (the :root values)', () => {
    expect(css).toMatch(/:root\s*\{[^}]*--atb-bg:\s*#0a0c12/);
  });
});
