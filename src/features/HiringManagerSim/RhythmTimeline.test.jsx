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
