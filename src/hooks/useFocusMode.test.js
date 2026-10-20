import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { useFocusMode } from './useFocusMode.js';

// the app's own state for the sidebar, wrapped the way App.jsx holds it
const setup = (initialCollapsed = false) => renderHook(() => {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const focus = useFocusMode(collapsed, setCollapsed);
  return { collapsed, setCollapsed, ...focus };
});

describe('useFocusMode', () => {
  it('starts out of focus with the sidebar as it was', () => {
    const { result } = setup(false);
    expect(result.current.focus).toBe(false);
    expect(result.current.collapsed).toBe(false);
  });
  it('collapses the sidebar when focus starts, and puts it back when focus ends', () => {
    const { result } = setup(false);
    act(() => result.current.onFocusChange(true));
    expect(result.current.focus).toBe(true);
    expect(result.current.collapsed).toBe(true);
    act(() => result.current.onFocusChange(false));
    expect(result.current.focus).toBe(false);
    expect(result.current.collapsed).toBe(false);
  });
  it('leaves a sidebar that was already collapsed collapsed, before, during and after', () => {
    const { result } = setup(true);
    act(() => result.current.onFocusChange(true));
    expect(result.current.collapsed).toBe(true);
    act(() => result.current.onFocusChange(false));
    expect(result.current.collapsed).toBe(true);
  });
  it('respects the person: if they open the sidebar during focus it stays open afterwards', () => {
    const { result } = setup(false);
    act(() => result.current.onFocusChange(true));
    act(() => result.current.setCollapsed(false));
    act(() => result.current.onFocusChange(false));
    expect(result.current.collapsed).toBe(false);
  });
  it('asking for focus twice or ending it twice does no harm', () => {
    const { result } = setup(false);
    act(() => { result.current.onFocusChange(true); result.current.onFocusChange(true); });
    expect(result.current.collapsed).toBe(true);
    act(() => { result.current.onFocusChange(false); result.current.onFocusChange(false); });
    expect(result.current.collapsed).toBe(false);
  });
  it('keeps the same callback between renders', () => {
    const { result, rerender } = setup(false);
    const first = result.current.onFocusChange;
    rerender();
    expect(result.current.onFocusChange).toBe(first);
  });
});
