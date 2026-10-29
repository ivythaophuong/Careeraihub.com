// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

afterEach(cleanup);

vi.mock('../Landing/LandingPage', () => ({ GetReadyTabStrip: () => null }));
vi.mock('../../components/OriginalFeatures', () => ({ GlowBar: ({ score }) => <div data-testid="bar">{score}</div> }));

import WeaknessRadar, { buildEvidence, MIN_EVIDENCE } from './WeaknessRadar';

const scan = { credibilityScore: 82, issues: [
  { severity: 'critical', type: 'Missing Metric', original: 'Led a team', fix: 'Led 5 engineers, cut release time 30%' },
  { severity: 'ok', type: 'Strong Claim', original: 'x', fix: 'y' },
] };

describe('buildEvidence', () => {
  it('has no scores without enough evidence', () => {
    const ev = buildEvidence({ memory: { mockSessions: [{ avgScore: 80 }], starBank: [{ score: 70 }] } });
    expect(ev.interview.score).toBeNull();
    expect(ev.star.score).toBeNull();
    expect(ev.resume.has).toBe(false);
  });

  it('averages only the latest five results once there is enough evidence', () => {
    const sessions = [90, 80, 70, 60, 50, 0, 0].map(avgScore => ({ avgScore }));
    expect(buildEvidence({ memory: { mockSessions: sessions } }).interview.score).toBe(70);
    expect(MIN_EVIDENCE).toBe(2);
  });

  it('accepts the local session shape that only has `score`', () => {
    const ev = buildEvidence({ memory: { mockSessions: [{ score: 60 }, { score: 40 }] } });
    expect(ev.interview.score).toBe(50);
  });

  it('keeps only critical issues and warnings from the latest scan', () => {
    expect(buildEvidence({ scanResult: scan, memory: {} }).resume.issues).toHaveLength(1);
  });
});

describe('WeaknessRadar', () => {
  it('invents nothing for a new user: no bars, no percentages, only next actions', () => {
    render(<WeaknessRadar memory={{}} setActiveModule={() => {}} />);
    expect(screen.getAllByText(/Not enough evidence yet/)).toHaveLength(3);
    expect(screen.queryByTestId('bar')).toBeNull();
    expect(document.body.textContent).not.toMatch(/\d+%/);
  });

  it('points to the action that creates the missing evidence', () => {
    const go = vi.fn();
    render(<WeaknessRadar memory={{}} setActiveModule={go} />);
    fireEvent.click(screen.getByText('Start a practice session'));
    expect(go).toHaveBeenCalledWith('simulate');
    fireEvent.click(screen.getByText('Build a STAR story'));
    expect(go).toHaveBeenCalledWith('star');
    fireEvent.click(screen.getByText('Scan my resume'));
    expect(go).toHaveBeenCalledWith('scan');
  });

  it('shows real measurements and specific resume issues when evidence exists', () => {
    render(<WeaknessRadar scanResult={scan} setActiveModule={() => {}}
      memory={{ mockSessions: [{ avgScore: 30 }, { avgScore: 50 }], starBank: [{ score: 80 }, { score: 90 }] }} />);
    expect(screen.getByText(/1 issue found in your latest scan/)).toBeTruthy();
    expect(screen.getByText(/Led 5 engineers/)).toBeTruthy();
    expect(screen.getByText('40%')).toBeTruthy();   // interview average
    expect(screen.getByText('85%')).toBeTruthy();   // STAR average
    expect(screen.queryByText(/Not enough evidence yet/)).toBeNull();
  });
});
