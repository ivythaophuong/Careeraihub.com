import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('../HiringManagerSim/HiringManagerSim', () => ({ default: () => <div>STUB-LIVE-SESSION</div> }));
vi.mock('../STARBuilder/STARBuilder', () => ({ default: () => <div /> }));
vi.mock('../WeaknessRadar/WeaknessRadar', () => ({ default: () => <div /> }));
vi.mock('../ReadinessScore/ReadinessScore', () => ({ default: () => <div /> }));
vi.mock('../MemoryDashboard/MemoryDashboard', () => ({ default: () => <div /> }));
import InterviewCoach from './InterviewCoach';

afterEach(cleanup);
const show = (props) => render(<InterviewCoach memory={{}} setActiveModule={vi.fn()} subNav="sidebar" {...props} />);
const PAGE_PAD = '20px 24px'; // the padding the Overview already uses

describe('the Live Session and Study Modules screens have the same page padding as the Overview', () => {
  it('the Overview uses that padding (so the number below is the real reference)', () => {
    show({ activeSub: 'dashboard' });
    expect(screen.getByText('Mock interviews completed').closest('div[style*="gap: 16"]').style.padding).toBe(PAGE_PAD);
  });
  it.each(['session', 'study'])('%s content sits inside a padded container', (sub) => {
    show({ activeSub: sub });
    expect(screen.getByText('STUB-LIVE-SESSION').parentElement.style.padding).toBe(PAGE_PAD);
  });
});
