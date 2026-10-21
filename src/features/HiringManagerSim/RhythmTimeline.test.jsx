import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import RhythmTimeline from './RhythmTimeline';

afterEach(cleanup);
const segs = [{ type: 'speech', sec: 10 }, { type: 'pause', sec: 2.7, long: true }, { type: 'speech', sec: 12 }, { type: 'pause', sec: 0.6, long: false }];

describe('RhythmTimeline', () => {
  it('draws one piece per stretch, sized by length, with the long pause picked out', () => {
    render(<RhythmTimeline segments={segs} totalSec={25.3} label="Timeline of your answer" />);
    expect(screen.getByRole('img', { name: 'Timeline of your answer' })).toBeTruthy();
    expect(screen.getAllByTestId('rhythm-speech')).toHaveLength(2);
    expect(screen.getAllByTestId('rhythm-pause')).toHaveLength(1);
    expect(screen.getAllByTestId('rhythm-long-pause')).toHaveLength(1);
    expect(screen.getAllByTestId('rhythm-speech')[1].style.flexGrow).toBe('12');
  });
  it('shows the end time and a legend', () => {
    render(<RhythmTimeline segments={segs} totalSec={25.3} label="x" />);
    expect(screen.getByText('25.3 s')).toBeTruthy();
    expect(screen.getByText('Speaking')).toBeTruthy();
    expect(screen.getByText('Short pause')).toBeTruthy();
    expect(screen.getByText(/Pause of 1 second or more/)).toBeTruthy();
  });
  it('renders nothing without segments', () => {
    expect(render(<RhythmTimeline segments={[]} totalSec={0} label="x" />).container.firstChild).toBeNull();
    cleanup();
    expect(render(<RhythmTimeline segments={undefined} totalSec={0} label="x" />).container.firstChild).toBeNull();
  });
});

describe('RhythmTimeline colours (loudness against the speaker\'s own voice)', () => {
  const tiered = [{ type: 'speech', sec: 3, tier: 'soft' }, { type: 'pause', sec: 2, long: true }, { type: 'speech', sec: 3, tier: 'loud' }, { type: 'speech', sec: 2, tier: 'steady' }];
  const color = (el) => el.style.background;
  it('draws softer, steady and louder stretches in three different colours', () => {
    render(<RhythmTimeline segments={tiered} totalSec={10} label="x" />);
    const [a, b, c] = screen.getAllByTestId('rhythm-speech').map(color);
    expect(new Set([a, b, c]).size).toBe(3);
  });
  it('names the three tiers in the legend and says colour is not a grade', () => {
    render(<RhythmTimeline segments={tiered} totalSec={10} label="x" />);
    expect(screen.getByText('Softer')).toBeTruthy();
    expect(screen.getByText('Steady')).toBeTruthy();
    expect(screen.getByText('Louder')).toBeTruthy();
    expect(document.body.textContent).toMatch(/Colour shows loudness compared with your own voice\. It is not a grade\./);
  });
  it('shows only the tiers that are in the recording, plus the pauses', () => {
    render(<RhythmTimeline segments={[{ type: 'speech', sec: 4 }, { type: 'pause', sec: 1.5, long: true }, { type: 'speech', sec: 4 }]} totalSec={9.5} label="x" />);
    expect(screen.getByText('Speaking')).toBeTruthy();
    expect(screen.queryByText('Softer')).toBeNull();
    expect(screen.queryByText(/Colour shows loudness/)).toBeNull();
  });
});
