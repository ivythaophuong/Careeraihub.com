import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import LandingPage from './LandingPage';

beforeEach(() => {
  // jsdom lacks these browser APIs that the landing page uses
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn();
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline'))); // job feed unavailable → link-out fallback
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const mount = () => render(<LandingPage setAuthModal={vi.fn()} onModuleSelect={vi.fn()} />);
const text = () => document.body.textContent;

describe('Landing page — honest claims', () => {
  it('has no fake live counters or "live" market signals', () => {
    mount();
    for (const fake of ['right now in Singapore', 'open roles in Singapore', 'median salary', 'hiring velocity', 'SGD 8.2K']) {
      // the feature-panel previews are illustrations, so check the hero areas only
      expect(document.querySelector('.hero')?.textContent || '').not.toContain(fake);
    }
    expect(document.querySelector('.market-signals')).toBeNull();
    expect(document.querySelector('.hf-live')).toBeNull();
  });

  it('shows verifiable hero stats instead of unsourced ones', () => {
    mount();
    const hero = document.querySelector('.hero').textContent;
    expect(hero).not.toMatch(/38%.*91%|5×|faster job search/);
    expect(hero).toMatch(/interviewer styles/);
    expect(hero).not.toContain('Salary data');
  });

  it('labels the feature previews as illustrative examples', () => {
    mount();
    expect(text()).toMatch(/Illustrative example — sample data/);
  });

  it('autocomplete suggestions carry no invented salaries or open-role counts', () => {
    mount();
    fireEvent.change(document.querySelector('.ac-wrap input'), { target: { value: 'Product' } });
    expect(document.querySelector('.ac-dropdown').textContent).toContain('Product Manager');
    expect(document.querySelector('.ac-dropdown').textContent).not.toMatch(/SGD|open roles/);
  });
});

describe('Landing page — hero keyword check', () => {
  const setField = (selector, value) => fireEvent.change(document.querySelector(selector), { target: { value } });
  const scan = () => { fireEvent.click(screen.getByText('Check keywords →')); return document.querySelector('.ats-score-num').textContent; };

  it('is labelled as a quick keyword check, not an AI scan', () => {
    mount();
    expect(screen.getByText('ATS Keyword Check')).toBeTruthy();
    expect(screen.getByText('Quick check')).toBeTruthy();
    expect(text()).not.toMatch(/Scan with AI/);
  });

  it('gives the same score every time for the same input (no randomness)', () => {
    mount();
    setField('.ats-input:not(.ats-ta)', 'Product Manager');
    setField('.ats-ta', 'Owned the roadmap, ran user research and set the product strategy with stakeholders using metrics.');
    const scores = [scan(), scan(), scan(), scan(), scan()];
    expect(new Set(scores).size).toBe(1);
  });

  it('scores by keyword coverage: more matching keywords, higher score; none matched, 0%', () => {
    mount();
    setField('.ats-input:not(.ats-ta)', 'Product Manager');
    setField('.ats-ta', 'xyz nothing relevant here');
    expect(scan()).toBe('0%');
    expect(document.querySelectorAll('.mk-tag.m').length).toBe(0); // no fake "found" keywords
    setField('.ats-ta', 'roadmap roadmap user research stakeholder metrics strategy');
    const high = parseInt(scan(), 10);
    expect(high).toBeGreaterThan(0);
  });
});
