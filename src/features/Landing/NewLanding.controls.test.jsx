// @vitest-environment jsdom
// Every button and every link of the landing page does something: nothing is dead. Each control is pressed on a fresh page, and one of these must be true afterwards:
// a callback of the page was called, the page changed, a link points to a place that exists, or it is an e-mail link.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import NewLanding from './NewLanding';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const mount = async () => {
  const calls = { start: 0, signIn: 0, module: [] };
  const r = render(<NewLanding onStart={() => { calls.start++; }} onSignIn={() => { calls.signIn++; }} onModuleSelect={(id) => { calls.module.push(id); }} />);
  await act(async () => { vi.advanceTimersByTime(6000); }); // let the examples finish playing
  return { ...r, calls };
};
const label = (el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();

describe('no dead buttons or links on the landing page', () => {
  it('every button and link has a name a person can hear or read', async () => {
    const { container } = await mount();
    for (const el of container.querySelectorAll('button, a[href]')) expect(label(el), el.outerHTML.slice(0, 80)).not.toBe('');
  });

  it('every link points somewhere real: a place on the page that exists, or an e-mail address', async () => {
    const { container } = await mount();
    const links = [...container.querySelectorAll('a[href]')];
    expect(links.length).toBeGreaterThan(10);
    for (const a of links) {
      const href = a.getAttribute('href');
      if (href.startsWith('mailto:')) { expect(href).toMatch(/^mailto:[^@\s]+@[^@\s]+\.[a-z]+/i); continue; }
      expect(href.startsWith('#'), `${label(a)} -> ${href}`).toBe(true);
      expect(container.querySelector(href), `${label(a)} -> ${href}`).toBeTruthy();
    }
  });

  it('every button does something when it is pressed', async () => {
    const first = await mount();
    const total = first.container.querySelectorAll('button').length;
    cleanup();
    expect(total).toBeGreaterThan(20);
    const dead = [];
    for (let i = 0; i < total; i++) {
      const { container, calls } = await mount();
      const btn = container.querySelectorAll('button')[i];
      const name = label(btn);
      // The situation buttons are a radio-like group: the one that is selected is pressed already.
      if (btn.getAttribute('aria-pressed') === 'true' && btn.classList.contains('nl-moment')) { cleanup(); continue; }
      const before = container.innerHTML;
      fireEvent.click(btn);
      await act(async () => { vi.advanceTimersByTime(200); });
      const changed = container.innerHTML !== before;
      const called = calls.start + calls.signIn + calls.module.length > 0;
      if (!changed && !called) dead.push(`${i}: ${name}`);
      cleanup();
    }
    expect(dead).toEqual([]);
  });

  it('the buttons that call into the app call the right thing', async () => {
    const want = [
      [/^Get Started$/i, 'start'], [/^Log in$/i, 'signIn'], [/Explore Resume Tools/i, ['ats']], [/Explore Interview Practice/i, ['simulate']],
      [/Explore Skills Gap/i, ['skillsgap']], [/Explore Career Roadmap/i, ['roadmap']], [/Explore All Tools/i, 'start'], [/Open the AI Career Coach|Ask your career coach anything/i, ['aichat']],
      [/^Privacy$/i, ['privacy']], [/^Terms$/i, ['terms']], [/Read the privacy policy/i, ['privacy']],
    ];
    for (const [re, expected] of want) {
      const { container, calls } = await mount();
      const btn = [...container.querySelectorAll('button')].find(b => re.test(label(b)));
      expect(btn, String(re)).toBeTruthy();
      fireEvent.click(btn);
      if (expected === 'start') expect(calls.start, String(re)).toBeGreaterThan(0);
      else if (expected === 'signIn') expect(calls.signIn, String(re)).toBeGreaterThan(0);
      else expect(calls.module, String(re)).toEqual(expect.arrayContaining(expected));
      cleanup();
    }
  });
});
