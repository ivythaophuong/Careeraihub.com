import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../HiringManagerSim/HiringManagerSim', () => ({ default: () => <div>STUB-LIVE-SESSION</div> }));
vi.mock('../STARBuilder/STARBuilder', () => ({ default: () => <div>STUB-STAR-BANK</div> }));
vi.mock('../WeaknessRadar/WeaknessRadar', () => ({ default: () => <div>STUB-RADAR</div> }));
vi.mock('../ReadinessScore/ReadinessScore', () => ({ default: () => <div /> }));
vi.mock('../MemoryDashboard/MemoryDashboard', () => ({ default: () => <div>STUB-MEMORY</div> }));
import InterviewCoach from './InterviewCoach';

afterEach(cleanup);
const show = (props = {}) => render(<InterviewCoach memory={{}} setActiveModule={vi.fn()} {...props} />);

describe('InterviewCoach with its parts in the sidebar', () => {
  it('shows the part the sidebar chose', () => {
    show({ subNav: 'sidebar', activeSub: 'starbank' });
    expect(screen.getByText('STUB-STAR-BANK')).toBeTruthy();
    cleanup();
    show({ subNav: 'sidebar', activeSub: 'session' });
    expect(screen.getByText('STUB-LIVE-SESSION')).toBeTruthy();
  });
  it('opens on the Overview when no part is given', () => {
    show({ subNav: 'sidebar' });
    expect(screen.getByText('Mock interviews completed')).toBeTruthy();
  });
  it('marks its horizontal tab strip as the small-screen one when the sidebar carries the parts, so it can be hidden on large screens', () => {
    show({ subNav: 'sidebar', activeSub: 'dashboard' });
    expect(document.querySelector('.ic-tabstrip-wrap--in-sidebar .scroll-tabs')).toBeTruthy();
  });
  it('keeps the tab strip as the only way around for a visitor without the sidebar', () => {
    show({});
    const strip = document.querySelector('.ic-tabstrip-wrap .scroll-tabs');
    expect(strip).toBeTruthy();
    expect(document.querySelector('.ic-tabstrip-wrap--in-sidebar')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'STAR Bank' }));
    expect(screen.getByText('STUB-STAR-BANK')).toBeTruthy();
  });
  it('asks the app to change the part (rather than changing it itself) when the sidebar owns it', () => {
    const onSubChange = vi.fn();
    show({ subNav: 'sidebar', activeSub: 'dashboard', onSubChange });
    fireEvent.click(screen.getByRole('button', { name: 'Live Session' })); // the small-screen strip
    expect(onSubChange).toHaveBeenCalledWith('session');
    expect(screen.queryByText('STUB-LIVE-SESSION')).toBeNull(); // the app decides what is shown
  });
  it('the Overview buttons also go through the app', () => {
    const onSubChange = vi.fn();
    show({ subNav: 'sidebar', activeSub: 'dashboard', onSubChange, memory: { resumeText: 'x'.repeat(60) } });
    fireEvent.click(screen.getByRole('button', { name: /Practise a mock interview/ }));
    expect(onSubChange).toHaveBeenCalledWith('session');
  });
  it('an unknown part falls back to the Overview', () => {
    show({ subNav: 'sidebar', activeSub: 'nope' });
    expect(screen.getByText('Mock interviews completed')).toBeTruthy();
  });
});
