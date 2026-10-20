import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../HiringManagerSim/HiringManagerSim', () => ({ default: ({ onFocusChange }) => (
  <div><button type="button" onClick={() => onFocusChange?.(true)}>start practising</button><button type="button" onClick={() => onFocusChange?.(false)}>stop practising</button></div>) }));
vi.mock('../STARBuilder/STARBuilder', () => ({ default: () => <div /> }));
vi.mock('../WeaknessRadar/WeaknessRadar', () => ({ default: () => <div /> }));
vi.mock('../ReadinessScore/ReadinessScore', () => ({ default: () => <div /> }));
vi.mock('../MemoryDashboard/MemoryDashboard', () => ({ default: () => <div /> }));
import InterviewCoach from './InterviewCoach';

afterEach(cleanup);
const show = (props = {}) => render(<InterviewCoach memory={{}} setActiveModule={vi.fn()} {...props} />);

describe('InterviewCoach in focus', () => {
  it('shows its tabs, and hides them while a session is being practised', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Live Session' }));
    expect(screen.getByRole('button', { name: 'Weakness Radar' })).toBeTruthy();
    fireEvent.click(screen.getByText('start practising'));
    expect(screen.queryByRole('button', { name: 'Weakness Radar' })).toBeNull();
    fireEvent.click(screen.getByText('stop practising'));
    expect(screen.getByRole('button', { name: 'Weakness Radar' })).toBeTruthy();
  });
  it('tells the app, so it can quieten the rest of the screen, and when focus ends', () => {
    const onFocusChange = vi.fn();
    show({ onFocusChange });
    fireEvent.click(screen.getByRole('button', { name: 'Live Session' }));
    fireEvent.click(screen.getByText('start practising'));
    expect(onFocusChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByText('stop practising'));
    expect(onFocusChange).toHaveBeenLastCalledWith(false);
  });
  it('ends focus when it is left, so the app is never left quiet', () => {
    const onFocusChange = vi.fn();
    const { unmount } = show({ onFocusChange });
    fireEvent.click(screen.getByRole('button', { name: 'Live Session' }));
    fireEvent.click(screen.getByText('start practising'));
    unmount();
    expect(onFocusChange).toHaveBeenLastCalledWith(false);
  });
});
