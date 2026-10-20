import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import RhythmNote from './RhythmNote';

afterEach(cleanup);
const ok = { state: 'ok', totalSec: 35.3, speechSec: 22, pauseSec: 13.3, speechPercent: 62, longPauses: 3, longestPauseSec: 2.7, paceWhileSpeakingWpm: 139,
  segments: [{ type: 'speech', sec: 10 }, { type: 'pause', sec: 2.7, long: true }, { type: 'speech', sec: 12 }, { type: 'pause', sec: 0.6, long: false }, { type: 'speech', sec: 10 }] };

describe('RhythmNote', () => {
  it('shows nothing for an unavailable result', () => {
    const { container } = render(<RhythmNote result={{ state: 'unavailable', reason: 'too_short' }} />);
    expect(container.firstChild).toBeNull();
    cleanup();
    expect(render(<RhythmNote result={null} />).container.firstChild).toBeNull();
  });
  it('draws one timeline piece per stretch and says in words what it shows', () => {
    render(<RhythmNote result={ok} />);
    const bar = screen.getByRole('img', { name: /timeline/i });
    expect(bar.getAttribute('aria-label')).toMatch(/22\.0 seconds of speaking/i);
    expect(bar.getAttribute('aria-label')).toMatch(/3 pauses of 1 second or more/i);
    expect(screen.getAllByTestId('rhythm-speech')).toHaveLength(3);
    expect(screen.getAllByTestId('rhythm-pause')).toHaveLength(1); // the short one; the long one has its own id
    expect(screen.getAllByTestId('rhythm-long-pause')).toHaveLength(1);
  });
  it('sizes each piece by its length', () => {
    render(<RhythmNote result={ok} />);
    const speech = screen.getAllByTestId('rhythm-speech');
    expect(speech[1].style.flexGrow).toBe('12');
    expect(screen.getByTestId('rhythm-long-pause').style.flexGrow).toBe('2.7');
  });
  it('shows the three figures as tiles with plain captions', () => {
    render(<RhythmNote result={ok} />);
    const t = screen.getByTestId('rhythm').textContent;
    expect(t).toMatch(/Speaking time/); expect(t).toMatch(/22\.0 s/); expect(t).toMatch(/of 35\.3 s/); expect(t).toMatch(/62%/);
    expect(t).toMatch(/Long pauses/); expect(t).toMatch(/3/); expect(t).toMatch(/longest 2\.7 s/);
    expect(t).toMatch(/Pace while speaking/); expect(t).toMatch(/139 WPM/);
  });
  it('leaves out the pace tile when there is no pace, and the longest-pause words when there are no long pauses', () => {
    const r = { ...ok, longPauses: 0, longestPauseSec: 0.6, paceWhileSpeakingWpm: undefined, segments: ok.segments.map(x => ({ ...x, long: false })) };
    render(<RhythmNote result={r} />);
    const t = screen.getByTestId('rhythm').textContent;
    expect(t).not.toMatch(/Pace while speaking/);
    expect(t).not.toMatch(/longest/);
    expect(screen.queryByTestId('rhythm-long-pause')).toBeNull();
  });
  it('still renders the figures when an older result has no segments', () => {
    const { segments, ...old } = ok;
    render(<RhythmNote result={old} />);
    expect(screen.getByTestId('rhythm').textContent).toMatch(/22\.0 s/);
    expect(screen.queryByRole('img', { name: /timeline/i })).toBeNull();
  });
  it('says where the figures come from, passes no verdict, shows no score', () => {
    render(<RhythmNote result={ok} />);
    const t = screen.getByTestId('rhythm').textContent;
    expect(t).toMatch(/Measured on your device from how loud your voice was\. Background noise can affect it\./);
    expect(t).not.toMatch(/good|bad|pass|fail|fluent|too fast|too slow|ideal|score|\/100/i);
  });
});
