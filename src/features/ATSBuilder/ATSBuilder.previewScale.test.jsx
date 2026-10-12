// @vitest-environment jsdom
// The preview page (A4, 794 px wide) is scaled to the width of its column. It must be measured whenever the Builder is on screen, including when the
// Builder was first mounted behind the side-by-side page, and a width that is too small must never give a zero or negative scale (a blank preview).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';

vi.mock('../../lib/ai', () => ({ callLLM: vi.fn() }));
vi.mock('html2pdf.js', () => ({ default: vi.fn() }));
import ATSBuilder from './ATSBuilder';

const observers = [];
class FakeRO {
  constructor(cb) { this.cb = cb; this.el = null; this.live = true; observers.push(this); }
  observe(el) { this.el = el; }
  unobserve() {}
  disconnect() { this.live = false; }
}
const fireWidth = (width) => act(() => {
  for (const o of observers) if (o.live && o.el && /Live Preview/i.test(o.el.textContent)) o.cb([{ contentRect: { width } }]);
});
const scaleOf = () => {
  const el = document.querySelector('div[style*="transform: scale("]');
  return Number(/scale\(([-\d.e]+)\)/.exec(el.style.transform)[1]);
};

beforeEach(() => {
  localStorage.clear(); observers.length = 0;
  Object.defineProperty(window, 'innerWidth', { value: 1800, configurable: true, writable: true });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubGlobal('ResizeObserver', FakeRO);
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const GOOD = 'Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew revenue by 20%\n';
const issue = { severity: 'high', title: 'No metrics in bullets', description: 'Add numbers.', before: 'Handled monthly reporting', after: 'Cut time by 30%', builderStep: 2, module: null };
const profile = { name: 'Jane Example', email: 'jane@example.com', skills: ['SQL'], education: [], workExperience: [{ title: 'Analyst', company: 'Acme', period: '2021 - 2023', bullets: ['Handled monthly reporting for the sales team'] }], issues: [issue] };
const props = (p = profile) => ({ user: { id: 'u1', token: 't' }, memory: { parseProfile: p }, updateMemory: vi.fn(), form: {}, setActiveModule: vi.fn(), setResumeText: vi.fn(), resumeText: GOOD });
const openBuilder = () => fireEvent.click(screen.getByText(/Fix These Issues in Builder/));
const viaFixPage = () => {
  fireEvent.click(screen.getByText(/Fix in Builder/));
  fireEvent.click(screen.getByRole('button', { name: /Leave it for now/i }));
  fireEvent.click(screen.getByRole('button', { name: /Open the Builder/i }));
};

describe('the preview scale', () => {
  it('fits the page to the width of its column: (width - 32) / 794', () => {
    render(<ATSBuilder {...props()} />);
    openBuilder();
    fireWidth(500);
    expect(scaleOf()).toBeCloseTo((500 - 32) / 794, 3);
  });

  it('is 1 when the column is wider than the page', () => {
    render(<ATSBuilder {...props()} />);
    openBuilder();
    fireWidth(1200);
    expect(scaleOf()).toBe(1);
  });

  it('still follows the column after the Builder was opened from the side-by-side page', () => {
    render(<ATSBuilder {...props()} />);
    viaFixPage();
    fireWidth(500);
    expect(scaleOf()).toBeCloseTo((500 - 32) / 794, 3);
  });

  it.each([[0], [20], [32], [-5]])('never goes to zero or below when the measured width is %i', (w) => {
    render(<ATSBuilder {...props()} />);
    openBuilder();
    fireWidth(w);
    expect(scaleOf()).toBeGreaterThan(0.2);
  });

  it('does not keep watching a column that is no longer on screen', () => {
    render(<ATSBuilder {...props()} />);
    viaFixPage();
    const liveBefore = observers.filter(o => o.live).length;
    fireEvent.click(screen.getByRole('button', { name: /Fix issues side by side/i }));
    expect(observers.filter(o => o.live && o.el && /Live Preview/i.test(o.el.textContent)).length).toBe(0);
    expect(liveBefore).toBeGreaterThan(0);
  });
});
