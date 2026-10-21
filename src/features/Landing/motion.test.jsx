// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import NewLanding from './NewLanding';
import { setMotionForced } from './motion';

afterEach(() => { cleanup(); setMotionForced(false); vi.unstubAllGlobals(); });
const reduce = () => vi.stubGlobal('matchMedia', (q) => ({ matches: /reduce/.test(q), addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
const show = () => render(<NewLanding onStart={vi.fn()} onSignIn={vi.fn()} onModuleSelect={vi.fn()} />);

describe('a visitor whose device asks for reduced motion', () => {
  it('sees a still page and a Play motion button that says why', () => {
    reduce();
    const { container } = show();
    expect(container.querySelector('.nl').getAttribute('data-motion')).toBe('off');
    const btn = screen.getByRole('button', { name: /Play motion/i });
    expect(btn.getAttribute('aria-pressed')).toBe('true'); // motion is stopped, as after pressing Pause
    expect(container.querySelector('.nl-motion-note').textContent).toMatch(/Your device asks for reduced motion/);
  });
  it('can play the motion anyway, and stop it again', () => {
    reduce();
    const { container } = show();
    fireEvent.click(screen.getByRole('button', { name: /Play motion/i }));
    expect(container.querySelector('.nl').getAttribute('data-motion')).toBe('forced');
    expect(container.querySelector('.nl-orb-core svg animateMotion')).toBeTruthy(); // the logo's satellites move
    fireEvent.click(screen.getByRole('button', { name: /Pause motion/i }));
    expect(container.querySelector('.nl').getAttribute('data-motion')).toBe('off');
  });
  it('sees the final figures of the examples at once while the motion is off', () => {
    reduce();
    show();
    expect(screen.getByTestId('demo-score').textContent).toBe('83');
  });
});

describe('a visitor with no such setting', () => {
  it('sees the motion on, with Pause motion, and no note about reduced motion', () => {
    const { container } = show();
    expect(container.querySelector('.nl').getAttribute('data-motion')).toBe('on');
    expect(screen.getByRole('button', { name: /Pause motion/i })).toBeTruthy();
    expect(container.querySelector('.nl-motion-note')).toBeNull();
  });
});
