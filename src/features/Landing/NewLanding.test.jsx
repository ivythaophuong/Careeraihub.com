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
  it('has one h1 with the three-line promise', () => {
    show();
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toMatch(/Know what to improve\.\s+Practice what matters\.\s+Move forward with clarity\./);
    expect(document.body.textContent).toMatch(/Your career operating system/i);
  });

  it('Get Started starts sign-up and Log in opens sign-in', () => {
    const { onStart, onSignIn } = show();
    fireEvent.click(screen.getAllByRole('button', { name: /Get Started/i })[0]);
    expect(onStart).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByRole('button', { name: /Log in/i })[0]);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('the hero buttons lead to real places on the page', () => {
    show();
    expect(screen.getByRole('link', { name: /Explore Career Tools/i }).getAttribute('href')).toBe('#tools');
    expect(screen.getByRole('link', { name: /See How It Works/i }).getAttribute('href')).toBe('#system');
    for (const id of ['tools', 'system', 'approach', 'faq', 'story', 'partner']) expect(document.getElementById(id)).toBeTruthy();
  });

  it('each tool card opens a tool that exists', () => {
    const { onModuleSelect } = show();
    for (const [name, id] of [['Explore Resume Tools', 'ats'], ['Explore Interview Practice', 'simulate'], ['Explore Skills Gap', 'skillsgap'], ['Explore Career Roadmap', 'roadmap']]) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(onModuleSelect).toHaveBeenLastCalledWith(id);
    }
  });

  it('Privacy and Terms open those pages', () => {
    const { onModuleSelect } = show();
    const footer = screen.getByRole('contentinfo');
    fireEvent.click(within(footer).getByRole('button', { name: 'Privacy' }));
    fireEvent.click(within(footer).getByRole('button', { name: 'Terms' }));
    expect(onModuleSelect).toHaveBeenCalledWith('privacy');
    expect(onModuleSelect).toHaveBeenCalledWith('terms');
  });

  it('the footer shows the current year and no social icons that go nowhere', () => {
    show();
    const footer = screen.getByRole('contentinfo');
    expect(footer.textContent).toContain(String(new Date().getFullYear()));
    expect(within(footer).queryAllByRole('link').every(a => a.getAttribute('href') && a.getAttribute('href') !== '#')).toBe(true);
    expect(footer.textContent).not.toMatch(/linkedin|twitter|youtube|instagram/i);
  });
});

describe('the small-screen menu', () => {
  it('opens, lists the sections, and closes with the button, a link, or Escape', () => {
    show();
    const btn = () => screen.getByRole('button', { name: /(Open|Close) menu/i });
    expect(btn().getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn());
    expect(btn().getAttribute('aria-expanded')).toBe('true');
    const menu = document.getElementById('nl-menu');
    expect(within(menu).getAllByRole('link').map(a => a.textContent)).toEqual(['Tools', 'Our Approach', 'Our Story', 'Partnership']);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.getElementById('nl-menu')).toBeNull();
    fireEvent.click(btn());
    fireEvent.click(within(document.getElementById('nl-menu')).getByRole('link', { name: 'Tools' }));
    expect(document.getElementById('nl-menu')).toBeNull();
  });
});

describe('the situation chooser', () => {
  it('asks "Where are you right now?" with four situations and answers with what you get', () => {
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

  it('the interview situation shows the voice screen and the delivery feedback, and says voice is rolling out', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: /I have an interview coming/i }));
    const imgs = screen.getAllByRole('img').filter(i => /voice|spoken|delivered/i.test(i.getAttribute('alt') || ''));
    expect(imgs.length).toBe(2);
    expect(document.body.textContent).toMatch(/Voice practice is rolling out/);
  });

  it('every image has a description, and the page says what each screen is', () => {
    show();
    expect(document.body.textContent).toMatch(/Personal details are blurred/i);
    for (const b of screen.getByRole('group', { name: /Where are you right now/i }).querySelectorAll('button')) {
      fireEvent.click(b);
      for (const img of document.querySelectorAll('img')) expect((img.getAttribute('alt') || '').length).toBeGreaterThan(20);
      for (const fig of document.querySelectorAll('.nl-panel figure')) expect(fig.textContent).toMatch(/synthetic account and made-up data|personal details blurred/i);
    }
  });

  it('the large screen can be opened bigger', () => {
    show();
    const link = screen.getByRole('link', { name: /Open larger/i });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toMatch(/noopener/);
  });
});

describe('the questions and answers', () => {
  it('replace the list of what we do not do, as native, keyboard-friendly disclosures', () => {
    show();
    expect(screen.queryByRole('heading', { name: /What we do not do/i })).toBeNull();
    const items = document.querySelectorAll('details.nl-qa');
    expect(items.length).toBeGreaterThanOrEqual(6);
    for (const d of items) expect(d.querySelector('summary')?.textContent.trim().endsWith('?')).toBe(true);
  });

  it('answer honestly about price, the check, AI, prediction, data, voice and employers', () => {
    show();
    const text = document.getElementById('faq').textContent;
    expect(text).toMatch(/Is CareerAiHub free\?.*while we build.*no paid plan has been announced/i);
    expect(text).toMatch(/same CV gives the same result/i);
    expect(text).toMatch(/not the score any recruiting system gives you/i);
    expect(text).toMatch(/does not change the result of the check/i);
    expect(text).toMatch(/does not predict or guarantee a result/i);
    expect(text).toMatch(/we do not keep them/i);
    expect(text).toMatch(/not available to everyone yet/i);
    expect(text).toMatch(/Employer matching is planned and credential checks are in development/i);
  });
});

describe('the new landing page makes no claim the product cannot back', () => {
  const text = () => { const r = show(); const t = r.container.textContent; cleanup(); return t; };
  it('has no prices, ratings, user counts, partner logos, percentages or "verified" claims', () => {
    const t = text();
    for (const re of [/\$\s?\d/, /\bSGD\s?\d/, /free trial|cancel anytime|money-back|refund/i, /\d[\d,]*\+/, /★|stars?\b/i, /verified/i, /testimonial|trusted by|used by/i, /\b\d+%/, /blockchain|Singpass|OpenCerts|Credly/i]) {
      expect(t.match(re)?.[0] ?? null).toBeNull();
    }
  });
  it('uses only the numbers on an allow-list (the owner approves additions)', () => {
    const t = text();
    const found = [...new Set(t.match(/\d+/g) || [])];
    const ALLOWED = ['1', '2', '3', '5', String(new Date().getFullYear())]; // counts of steps and questions, the footer year
    expect(found.filter(n => !ALLOWED.includes(n))).toEqual([]);
  });
  it('does not show a founder photo or a founder name until the owner supplies them', () => {
    const r = show();
    expect(r.container.querySelector('.nl-founder')).toBeNull();
    expect(r.container.textContent).not.toMatch(/Ivy Nguyen|Founded by/);
  });
});
