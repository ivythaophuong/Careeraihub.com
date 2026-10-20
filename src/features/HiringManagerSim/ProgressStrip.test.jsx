import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import ProgressStrip from './ProgressStrip';

afterEach(cleanup);
const questions = [1, 2, 3, 4, 5].map(n => ({ question: `Question text ${n}`, focus: `Focus ${n}` }));
const show = (props = {}) => render(<ProgressStrip questions={questions} idx={1} results={[{ skipped: false }]} {...props} />);

describe('ProgressStrip', () => {
  it('is one slim labelled region with one step per question and a mark where you are', () => {
    show();
    const strip = within(screen.getByRole('region', { name: 'Session progress' }));
    const items = strip.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[0].getAttribute('aria-label')).toMatch(/Question 1: answered/i);
    expect(items[1].getAttribute('aria-label')).toMatch(/Question 2: current/i);
    expect(items[2].getAttribute('aria-label')).toMatch(/Question 3: not yet/i);
    expect(items.filter(i => i.getAttribute('aria-current') === 'step')).toHaveLength(1);
  });
  it('says in one line where you are and what is true: answered and to go', () => {
    show();
    const t = screen.getByRole('region', { name: 'Session progress' }).textContent;
    expect(t).toMatch(/Question 2 of 5/);
    expect(t).toMatch(/1 answered · 4 to go/);
  });
  it('counts a skipped question as not answered, and the current one as still to go', () => {
    show({ results: [{ skipped: false }, { skipped: true }], idx: 2 });
    const t = screen.getByRole('region', { name: 'Session progress' }).textContent;
    expect(t).toMatch(/1 answered · 1 not answered · 3 to go/);
    expect(screen.getAllByRole('listitem')[1].getAttribute('aria-label')).toMatch(/not answered/i);
  });
  it('is slim: it does not repeat the question focus or a "current question" box (the question card has them)', () => {
    show();
    const t = screen.getByRole('region', { name: 'Session progress' }).textContent;
    expect(t).not.toMatch(/Focus 2/);
    expect(t).not.toMatch(/Current question/i);
  });
  it('invents no figures: no tokens, no budget, no minutes', () => {
    show();
    expect(screen.getByRole('region', { name: 'Session progress' }).textContent).not.toMatch(/token|budget|minutes left/i);
  });
});
