// @vitest-environment jsdom
// A row of tabs that is wider than the screen: the chosen tab is brought into view (only the row moves, never the page), and the row says it can be
// scrolled (data-more) so a fade can show at the edge. jsdom has no layout, so the sizes come from attributes through stubs.
import React from 'react';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { useScrollTabs } from './useScrollTabs.js';

const protoRect = HTMLElement.prototype.getBoundingClientRect;
const desc = (n) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, n);
const saved = { clientWidth: desc('clientWidth'), scrollWidth: desc('scrollWidth') };
beforeEach(() => {
  HTMLElement.prototype.getBoundingClientRect = function () { const [left, width] = (this.getAttribute('data-rect') || '0,0').split(',').map(Number); return { left, width, right: left + width, top: 0, bottom: 0, height: 0, x: left, y: 0 }; };
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return Number(this.getAttribute('data-client') || 0); } });
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get() { return Number(this.getAttribute('data-scroll') || 0); } });
});
afterEach(() => {
  cleanup();
  HTMLElement.prototype.getBoundingClientRect = protoRect;
  for (const [k, d] of Object.entries(saved)) { if (d) Object.defineProperty(HTMLElement.prototype, k, d); else delete HTMLElement.prototype[k]; }
});

// A row 300 px wide that holds 600 px of tabs: tab a at 0..100, b at 100..200, c at 500..600 (positions are relative to the page; the row starts at 0).
const Row = ({ active, client = 300, scroll = 600 }) => {
  const ref = useScrollTabs(active);
  const tabs = { a: '0,100', b: '100,100', c: '500,100' };
  return (
    <div ref={ref} data-testid="row" data-rect="0,300" data-client={client} data-scroll={scroll}>
      {Object.entries(tabs).map(([k, r]) => <button key={k} data-rect={r} aria-current={active === k ? 'page' : undefined}>{k}</button>)}
    </div>
  );
};

describe('useScrollTabs', () => {
  it('a chosen tab that is out of view is brought into the middle of the row, by moving only the row', () => {
    const { getByTestId } = render(<Row active="c" />);
    expect(getByTestId('row').scrollLeft).toBe(500 - (300 - 100) / 2);   // 400
  });

  it('a chosen tab that is already in view does not move the row', () => {
    const { getByTestId } = render(<Row active="b" />);
    expect(getByTestId('row').scrollLeft).toBe(0);
  });

  it('follows the chosen tab when it changes', () => {
    const { getByTestId, rerender } = render(<Row active="a" />);
    expect(getByTestId('row').scrollLeft).toBe(0);
    rerender(<Row active="c" />);
    expect(getByTestId('row').scrollLeft).toBe(400);
  });

  it('says there is more to scroll to when the tabs are wider than the row, and not when they fit', () => {
    const { getByTestId, rerender } = render(<Row active="a" />);
    expect(getByTestId('row').getAttribute('data-more')).toBe('true');
    cleanup();
    const { getByTestId: g2 } = render(<Row active="a" client={600} scroll={600} />);
    expect(g2('row').getAttribute('data-more')).toBe('false');
  });

  it('updates data-more as the row is scrolled: false once its end is reached', () => {
    const { getByTestId } = render(<Row active="a" />);
    const row = getByTestId('row');
    row.scrollLeft = 300;                         // 600 wide, 300 shown, scrolled to the end
    fireEvent.scroll(row);
    expect(row.getAttribute('data-more')).toBe('false');
    row.scrollLeft = 100;
    fireEvent.scroll(row);
    expect(row.getAttribute('data-more')).toBe('true');
  });

  it('does nothing and does not throw when no tab is marked', () => {
    const { getByTestId } = render(<Row active="none" />);
    expect(getByTestId('row').scrollLeft).toBe(0);
  });
});
