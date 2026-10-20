import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import QuestionCard from './QuestionCard';

afterEach(cleanup);
const base = { q: { question: 'Tell me about a time you introduced a repeatable process.', focus: 'Product & Process', why: 'Your ability to build structure.' }, idx: 1, total: 5, color: '#ec4899',
  challenge: 'untimed', attempt: 1, current: null, secondsLeft: 180, showTimer: true, onToggleTimer: vi.fn(), questionMs: 0, sessionMs: 0, ready: true, onReady: vi.fn() };
const show = (over = {}) => render(<QuestionCard {...base} {...over} />);

describe('QuestionCard', () => {
  it('shows the position, the focus, and the question in large text', () => {
    show();
    const card = screen.getByTestId('question-card');
    expect(within(card).getByText('Question 2/5')).toBeTruthy();
    expect(within(card).getByText('Product & Process')).toBeTruthy();
    expect(within(card).getByRole('heading', { name: /Tell me about a time you introduced a repeatable process/ })).toBeTruthy();
  });
  it('says what the interviewer is assessing, and offers a structure as a hint, not a rule', () => {
    show();
    expect(screen.getByText('What the interviewer is assessing')).toBeTruthy();
    expect(screen.getByText('Your ability to build structure.')).toBeTruthy();
    expect(screen.getByText(/Situation → Action → Outcome/)).toBeTruthy();
    expect(screen.getByText(/often works/i)).toBeTruthy();
  });
  it('leaves the assessing panel out when there is no reason to show', () => {
    show({ q: { ...base.q, why: '' } });
    expect(screen.queryByText('What the interviewer is assessing')).toBeNull();
  });
  it('puts the timers before the question text, as before', () => {
    show();
    const card = within(screen.getByTestId('question-card'));
    const timer = card.getByRole('timer', { name: /Elapsed/ });
    const heading = card.getByRole('heading');
    expect(timer.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('shows the count-down only in the timed challenge, on the first attempt, with its urgency', () => {
    show({ challenge: 'timed', secondsLeft: 20 });
    const t = screen.getByRole('timer', { name: /Time left/ });
    expect(t.textContent).toMatch(/00:20/);
    expect(t.getAttribute('data-urgency')).toBe('soon');
    cleanup();
    show({ challenge: 'timed', attempt: 2 });
    expect(screen.queryByRole('timer', { name: /Time left/ })).toBeNull();
  });
  it('hides and shows the elapsed timer with its button', () => {
    const onToggleTimer = vi.fn();
    show({ onToggleTimer });
    fireEvent.click(screen.getByRole('button', { name: 'Hide timer' }));
    expect(onToggleTimer).toHaveBeenCalled();
    cleanup();
    show({ showTimer: false });
    expect(screen.queryByRole('timer', { name: /Elapsed/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Show timer' })).toBeTruthy();
  });
  it('waits for the person: the Ready button shows only before the clock has started, and calls back', () => {
    const onReady = vi.fn();
    show({ ready: false, onReady });
    expect(screen.getByText(/clock starts when you press/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /i'?m ready/i }));
    expect(onReady).toHaveBeenCalled();
    cleanup();
    show({ ready: true });
    expect(screen.queryByRole('button', { name: /i'?m ready/i })).toBeNull();
    cleanup();
    show({ ready: false, current: { score: 1 } });
    expect(screen.queryByRole('button', { name: /i'?m ready/i })).toBeNull();
  });
});
