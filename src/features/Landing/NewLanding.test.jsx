// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import NewLanding from './NewLanding';

afterEach(cleanup);
const show = (props = {}) => {
  const p = { onStart: vi.fn(), onSignIn: vi.fn(), onModuleSelect: vi.fn(), ...props };
  const r = render(<NewLanding {...p} />);
  return { ...r, ...p };
};

describe('the new landing page', () => {
  it('has one h1, and it names the product the way the owner positions it', () => {
    show();
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe('Your career operating system.');
  });

  it('every "Start free" button starts sign-up', () => {
    const { onStart } = show();
    const buttons = screen.getAllByRole('button', { name: /Start free/i });
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(buttons[0]);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('Log in opens sign-in and Privacy and Terms open those pages', () => {
    const { onSignIn, onModuleSelect } = show();
    fireEvent.click(screen.getByRole('button', { name: /Log in/i }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    const footer = screen.getByRole('contentinfo');
    fireEvent.click(within(footer).getByRole('button', { name: 'Privacy' }));
    fireEvent.click(within(footer).getByRole('button', { name: 'Terms' }));
    expect(onModuleSelect).toHaveBeenCalledWith('privacy');
    expect(onModuleSelect).toHaveBeenCalledWith('terms');
  });

  it('asks "Where are you right now?" with four moments and answers with what you get', () => {
    show();
    const group = screen.getByRole('group', { name: /Where are you right now/i });
    const moments = within(group).getAllByRole('button');
    expect(moments).toHaveLength(4);
    expect(moments[0].getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { level: 3, name: /applications you have checked/i })).toBeTruthy();
    fireEvent.click(moments[2]);
    expect(moments[2].getAttribute('aria-pressed')).toBe('true');
    expect(moments[0].getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('heading', { level: 3, name: /what you will say before you sit down/i })).toBeTruthy();
  });

  it('the interview moment shows the voice screen and the delivery feedback, and says voice is rolling out', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: /I have an interview coming/i }));
    const imgs = screen.getAllByRole('img').filter(i => /voice|spoken|delivered/i.test(i.getAttribute('alt') || ''));
    expect(imgs.length).toBe(2);
    expect(document.body.textContent).toMatch(/Voice practice is rolling out/);
  });

  it('every image has a description, and the page says what the screens are (synthetic data or a real screen with details blurred)', () => {
    show();
    expect(document.body.textContent).toMatch(/Personal details are blurred/i);
    for (const b of screen.getByRole('group', { name: /Where are you right now/i }).querySelectorAll('button')) {
      fireEvent.click(b);
      for (const img of document.querySelectorAll('img')) expect((img.getAttribute('alt') || '').length).toBeGreaterThan(20);
      expect(document.body.textContent).toMatch(/synthetic account and made-up data|personal details blurred/i);
    }
  });
  it('the large screen can be opened bigger', () => {
    show();
    const link = screen.getByRole('link', { name: /Open larger/i });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toMatch(/noopener/);
  });

  it('has a theme switch that sets data-theme on the page root', () => {
    const { container } = show();
    const root = container.querySelector('.nl');
    const before = root.getAttribute('data-theme');
    fireEvent.click(screen.getByRole('button', { name: /Switch to (dark|light) theme/i }));
    expect(root.getAttribute('data-theme')).not.toBe(before);
  });
});

describe('the new landing page makes no claim the product cannot back', () => {
  const text = () => { const r = show(); const t = r.container.textContent; cleanup(); return t; };
  it('has no prices, ratings, user counts, partner logos or "verified" claims', () => {
    const t = text();
    for (const re of [/\$\s?\d/, /\bSGD\s?\d/, /free trial|cancel anytime|money-back|refund/i, /\d[\d,]*\+/, /★|stars?\b/i, /verified/i, /testimonial|trusted by|used by/i, /\b\d+%/, /blockchain|Singpass|OpenCerts|Credly/i]) {
      expect(t.match(re)?.[0] ?? null).toBeNull();
    }
  });
  it('uses only the numbers on an allow-list (the owner approves additions)', () => {
    const t = text();
    const found = [...new Set(t.match(/\d+/g) || [])];
    const ALLOWED = ['1', '2', '3', '5']; // 'Step 1' to 'Step 3'; 5 templates; 3 minutes per question
    expect(found.filter(n => !ALLOWED.includes(n))).toEqual([]);
  });
  it('does not offer voice, employer matching or credential checks as available features', () => {
    const t = text();
    expect(t).toMatch(/Voice practice is not available to everyone yet/);
    expect(t).toMatch(/Employer matching is not available yet/);
    expect(t).toMatch(/Credential checks are in development/);
  });
});
