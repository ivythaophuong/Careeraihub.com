import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import AboutPractice from './AboutPractice';

afterEach(cleanup);
const show = (props = {}) => render(<AboutPractice challenge="untimed" mode="text" deviceKept={false} {...props} />);

describe('AboutPractice', () => {
  it('is folded by default: one small control, the content is there for screen readers only when open', () => {
    show();
    const toggle = screen.getByRole('button', { name: /about this practice/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByTestId('about-content').hidden).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('about-content').hidden).toBe(false);
  });
  it('keeps the plain words about the limit and AI estimates, and says how you are answering', () => {
    show({ challenge: 'timed', mode: 'voice' });
    const t = screen.getByTestId('about-content').textContent;
    expect(t).toMatch(/Voice answers/);
    expect(t).toMatch(/3 minutes.*never cuts/i);
    expect(t).toMatch(/AI estimates for your own practice, not verified evidence of skill/i);
    cleanup();
    show({ challenge: 'untimed', mode: 'text' });
    const u = screen.getByTestId('about-content').textContent;
    expect(u).toMatch(/Typed answers/);
    expect(u).toMatch(/no time limit/i);
  });
  it('says progress is kept on this device only when it is', () => {
    show({ deviceKept: true });
    expect(screen.getByTestId('about-content').textContent).toMatch(/kept on this device only/i);
    cleanup();
    show({ deviceKept: false });
    expect(screen.getByTestId('about-content').textContent).not.toMatch(/kept on this device/i);
  });
  it('holds the interview tips inside it, one at a time with previous and next', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: /about this practice/i }));
    const first = screen.getByTestId('tip').textContent;
    fireEvent.click(screen.getByRole('button', { name: /next tip/i }));
    expect(screen.getByTestId('tip').textContent).not.toBe(first);
    fireEvent.click(screen.getByRole('button', { name: /previous tip/i }));
    expect(screen.getByTestId('tip').textContent).toBe(first);
    expect(screen.getAllByTestId('tip-dot').length).toBeGreaterThan(1);
  });
  it('the tips are advice only: no figures, no claims about results', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: /about this practice/i }));
    for (let i = 0; i < 6; i++) { expect(screen.getByTestId('tip').textContent).not.toMatch(/\d+\s?%|percent|studies show|recruiters? (say|prefer)/i); fireEvent.click(screen.getByRole('button', { name: /next tip/i })); }
  });
  it('shows no tips button of its own: there is no separate "Help & tips" control', () => {
    show();
    expect(screen.queryByRole('button', { name: /help & tips/i })).toBeNull();
  });
});
