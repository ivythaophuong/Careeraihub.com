import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import SessionPanel from './SessionPanel';

afterEach(cleanup);
const questions = [1, 2, 3, 4, 5].map(n => ({ question: `Question text ${n}`, focus: `Focus ${n}` }));
const show = (props = {}) => render(<SessionPanel questions={questions} idx={1} results={[{ skipped: false }]} color="#ec4899" deviceKept={false} challenge="untimed" mode="text" {...props} />);

describe('SessionPanel', () => {
  it('draws one step per question and marks where you are, with no list other than that one', () => {
    show();
    const panel = within(screen.getByRole('complementary', { name: 'Session progress' }));
    const items = panel.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[0].getAttribute('aria-label')).toMatch(/Question 1: answered/i);
    expect(items[1].getAttribute('aria-label')).toMatch(/Question 2: current/i);
    expect(items[1].getAttribute('aria-current')).toBe('step');
    expect(items[2].getAttribute('aria-label')).toMatch(/Question 3: not yet/i);
    expect(items.filter(i => i.getAttribute('aria-current') === 'step')).toHaveLength(1);
  });
  it('says a skipped question was not answered', () => {
    show({ results: [{ skipped: true }] });
    expect(screen.getAllByRole('listitem')[0].getAttribute('aria-label')).toMatch(/not answered/i);
  });
  it('counts what is true: answered, not answered and to go', () => {
    show({ results: [{ skipped: false }, { skipped: true }], idx: 2 });
    expect(screen.getByText(/1 answered · 1 not answered · 3 to go/)).toBeTruthy(); // the current question is still to go
  });
  it('names the current question by its focus and its place', () => {
    show();
    expect(screen.getByText('Focus 2')).toBeTruthy();
    expect(screen.getByText(/2 \/ 5/)).toBeTruthy();
  });
  it('keeps the tips and the notes folded away until Help is opened', () => {
    show();
    const toggle = screen.getByRole('button', { name: /help & tips/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: /next tip/i })).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /next tip/i })).toBeTruthy();
  });
  it('shows interview tips one at a time, with previous, next and dots', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: /help & tips/i }));
    const first = screen.getByTestId('tip').textContent;
    fireEvent.click(screen.getByRole('button', { name: /next tip/i }));
    expect(screen.getByTestId('tip').textContent).not.toBe(first);
    fireEvent.click(screen.getByRole('button', { name: /previous tip/i }));
    expect(screen.getByTestId('tip').textContent).toBe(first);
    fireEvent.click(screen.getByRole('button', { name: /previous tip/i }));
    expect(screen.getByTestId('tip').textContent).not.toBe(first); // wraps round
    expect(screen.getAllByTestId('tip-dot').length).toBeGreaterThan(1);
  });
  it('the tips are advice only: no figures, no claims about results', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: /help & tips/i }));
    for (let i = 0; i < 6; i++) { expect(screen.getByTestId('tip').textContent).not.toMatch(/\d+\s?%|percent|studies show|recruiters? (say|prefer)/i); fireEvent.click(screen.getByRole('button', { name: /next tip/i })); }
  });
  it('keeps the plain words about the limit and the scores, and says which way you answer', () => {
    show({ challenge: 'timed', mode: 'voice' });
    const t = screen.getByRole('complementary', { name: 'Session progress' }).textContent;
    expect(t).toMatch(/3 minutes.*never cuts/i);
    expect(t).toMatch(/AI estimates/i);
    expect(t).toMatch(/Voice answers/);
    cleanup();
    show({ challenge: 'untimed', mode: 'text' });
    const u = screen.getByRole('complementary', { name: 'Session progress' }).textContent;
    expect(u).toMatch(/no time limit/i);
    expect(u).toMatch(/Typed answers/);
    expect(u).not.toMatch(/token|budget|minutes left/i);
  });
});
