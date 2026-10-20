import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Waveform from './Waveform';

let ctx;
beforeEach(() => {
  ctx = { clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), fill: vi.fn(), roundRect: vi.fn(), rect: vi.fn(), arc: vi.fn(), set globalAlpha(v) {}, set fillStyle(v) {} };
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx);
});
afterEach(cleanup);

describe('Waveform (history of the recording)', () => {
  it('is a labelled image and draws the levels so far plus the empty time to come', () => {
    const levelsRef = { current: [0.1, 0.3, 0.5, 0.2, 0.4, 0.6, 0.2, 0.1, 0.3, 0.2] };
    render(<Waveform levelsRef={levelsRef} />);
    expect(screen.getByRole('img', { name: /live sound/i })).toBeTruthy();
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.fill.mock.calls.length + ctx.fillRect.mock.calls.length).toBeGreaterThan(10);
  });
  it('draws without a context (a browser without canvas) and without levels, never throwing', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
    expect(() => render(<Waveform levelsRef={{ current: [] }} />)).not.toThrow();
    cleanup();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx);
    expect(() => render(<Waveform levelsRef={{ current: [] }} />)).not.toThrow();
    expect(() => render(<Waveform />)).not.toThrow();
  });
});
