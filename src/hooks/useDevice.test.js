// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useDevice, BREAKPOINTS } from './useDevice';

const setWidth = (w) => { Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true }); };
afterEach(() => { cleanup(); delete document.documentElement.dataset.device; delete document.documentElement.dataset.touch; });

describe('useDevice', () => {
  it.each([
    [320, 'mobile'], [BREAKPOINTS.tablet - 1, 'mobile'],
    [BREAKPOINTS.tablet, 'tablet'], [BREAKPOINTS.desktop - 1, 'tablet'],
    [BREAKPOINTS.desktop, 'desktop'], [1920, 'desktop'],
  ])('%ipx is %s', (w, expected) => {
    setWidth(w);
    const { result } = renderHook(() => useDevice());
    expect(result.current.device).toBe(expected);
    expect(result.current.isMobile).toBe(expected === 'mobile');
    expect(result.current.isTablet).toBe(expected === 'tablet');
    expect(result.current.isDesktop).toBe(expected === 'desktop');
  });

  it('exposes the class on <html> so CSS can use [data-device]', () => {
    setWidth(500);
    renderHook(() => useDevice());
    expect(document.documentElement.dataset.device).toBe('mobile');
    expect(document.documentElement.dataset.touch).toMatch(/true|false/);
  });

  it('follows a resize or a rotation', () => {
    setWidth(1400);
    const { result } = renderHook(() => useDevice());
    expect(document.documentElement.dataset.device).toBe('desktop');
    act(() => { setWidth(600); window.dispatchEvent(new Event('resize')); });
    expect(result.current.device).toBe('mobile');
    expect(document.documentElement.dataset.device).toBe('mobile');
    act(() => { setWidth(900); window.dispatchEvent(new Event('orientationchange')); });
    expect(result.current.device).toBe('tablet');
  });
});
