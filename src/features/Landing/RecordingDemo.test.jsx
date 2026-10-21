// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import RecordingDemo from './RecordingDemo';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const tick = (ms) => act(async () => { vi.advanceTimersByTime(ms); });
const clock = (c) => c.querySelector('.nl-rec-time').getAttribute('data-t');

describe('the recording illustration', () => {
  it('says that it is an illustration, and draws the sound as bars coloured by loudness with the same legend as the app', () => {
    const { container } = render(<RecordingDemo />);
    const img = screen.getByRole('img', { name: /Illustration of recording a spoken answer/i });
    expect(img).toBeTruthy();
    expect(container.textContent).toMatch(/Illustration/);
    expect(container.textContent).toMatch(/Recording/);
    expect(container.querySelectorAll('.nl-rec-bar')).toHaveLength(56);
    for (const w of ['Softer', 'Steady', 'Louder', 'Pause']) expect(container.textContent).toContain(w);
    for (const tier of ['soft', 'steady', 'loud', 'pause']) expect(container.querySelector(`.nl-rec-bar.is-${tier}`), tier).toBeTruthy();
  });
  it('shows no figure as text: the clock is drawn from an attribute, so the page text keeps to its list of approved numbers', () => {
    const { container } = render(<RecordingDemo />);
    expect(container.textContent).not.toMatch(/\d/);
  });
  it('counts like a recording: the clock runs up once from 0:00 to 0:27 and stops there', async () => {
    const { container } = render(<RecordingDemo />);
    expect(clock(container)).toBe('0:00');
    await tick(3000);
    expect(clock(container)).toBe('0:03');
    await tick(60000);
    expect(clock(container)).toBe('0:27');
    expect(container.querySelector('.nl-rec').classList.contains('is-done')).toBe(true);
  });
  it('stands still with a fixed clock for a visitor who prefers reduced motion', async () => {
    vi.stubGlobal('matchMedia', (q) => ({ matches: /reduce/.test(q), addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    const { container } = render(<RecordingDemo />);
    const t = clock(container);
    await tick(5000);
    expect(clock(container)).toBe(t);
    expect(t).not.toBe('0:00');
  });
});
