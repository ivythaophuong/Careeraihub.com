// Secondary text in the Builder must be readable: WCAG AA asks for a contrast of at least 4.5 to 1 for ordinary text. The Builder sets its own secondary
// colour (--lp-text3) for the dark and the light theme, so the rest of the app keeps its own.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.resolve(__dirname, 'atsBuilder.css'), 'utf8');
const landing = fs.readFileSync(path.resolve(__dirname, '../Landing/landing.css'), 'utf8');
const theme = fs.readFileSync(path.resolve(__dirname, '../../styles/appTheme.css'), 'utf8');

const lum = (hex) => { const h = hex.replace('#', ''); const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const token = (src, name) => (src.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`)) || [])[1];
const override = (selector) => (css.match(new RegExp(`${selector}\\s*\\{[^}]*--lp-text3:\\s*(#[0-9A-Fa-f]{6})`)) || [])[1];

describe('secondary text in the Builder', () => {
  it('has its own colour in the dark theme and in the light theme', () => {
    expect(override('\\[data-theme="dark"\\] \\.atb')).toBeTruthy();
    expect(override('\\[data-theme="light"\\] \\.atb')).toBeTruthy();
  });

  it('is at least 4.5 to 1 on every background the Builder uses, dark theme', () => {
    const c = override('\\[data-theme="dark"\\] \\.atb');
    for (const n of ['--lp-bg', '--lp-bg2', '--lp-bg3', '--lp-bg4']) expect(ratio(c, token(landing, n)), `${c} on ${n}`).toBeGreaterThanOrEqual(4.5);
  });

  it('is at least 4.5 to 1 on every background the Builder uses, light theme', () => {
    const c = override('\\[data-theme="light"\\] \\.atb');
    for (const n of ['--lp-bg', '--lp-bg2', '--lp-bg3', '--lp-bg4', '--lp-bg5']) expect(ratio(c, token(theme, n)), `${c} on ${n}`).toBeGreaterThanOrEqual(4.5);
  });

  it('is still dimmer than the main secondary colour, so the hierarchy stays', () => {
    const c = override('\\[data-theme="dark"\\] \\.atb');
    expect(lum(c)).toBeLessThanOrEqual(lum(token(landing, '--lp-text2')));
  });
});
