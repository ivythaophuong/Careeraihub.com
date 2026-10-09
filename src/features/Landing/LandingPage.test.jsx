// @vitest-environment jsdom
// Adapted from main's landing test. Main's version looked for `.hero`, the search card and the hero
// keyword check, none of which are rendered by this landing page, so those cases would have passed
// without checking anything. These check the page that is actually shown on first render (the
// feature sections further down only render on interaction; tests/security/noFakeData.test.js scans
// all of their source).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import LandingPage from './LandingPage';

beforeEach(() => {
  // jsdom lacks these browser APIs that the landing page uses
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn();
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const mount = () => render(<LandingPage setAuthModal={vi.fn()} onModuleSelect={vi.fn()} />);
const text = () => document.body.textContent;

describe('Landing page — honest claims', () => {
  it('renders the page', () => {
    mount();
    expect(text().length).toBeGreaterThan(2000);
    expect(document.querySelector('.v36-page')).not.toBeNull();
  });

  it('has no fake live counters or live market signals anywhere on the page', () => {
    mount();
    for (const fake of ['job seekers active', 'open roles in Singapore', 'hiring velocity', 'SGD 8.2K', '2,400+', 'Real-time salary', 'live Singapore', 'live salary', '3.2×', '$18K', '38% → 91%', '$155,000']) {
      expect(text()).not.toContain(fake);
    }
    expect(document.querySelector('.market-signals')).toBeNull();
    expect(document.querySelector('.sc-live-bar')).toBeNull();
  });

  it('names the regional guide as a guide, not as market intelligence', () => {
    mount();
    expect(text()).not.toMatch(/Market Intel/i);
  });

  it('labels the sample profile in the hero as an example (it is not a real person)', () => {
    mount();
    expect(text()).toMatch(/ExampleSarah Tan/);
    expect(text()).not.toMatch(/\bLive\b/);
  });

  it('does not use randomness to produce what it shows (two renders give the same text)', () => {
    mount();
    const first = text();
    cleanup();
    mount();
    expect(text()).toBe(first);
  });
});
