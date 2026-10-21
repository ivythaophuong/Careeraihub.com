import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import DeliveryRail from './DeliveryRail';
import SpeakingInsights from './SpeakingInsights';

afterEach(cleanup);
const rate = { state: 'ok', wpm: 87, words: 36, durationSec: 25 };
const rhythm = { state: 'ok', totalSec: 25, speechSec: 16.7, pauseSec: 8.3, speechPercent: 67, longPauses: 2, longestPauseSec: 1.9, paceWhileSpeakingWpm: 154,
  segments: [{ type: 'speech', sec: 5.6, startSec: 0, tier: 'steady' }, { type: 'pause', sec: 1.9, startSec: 5.6, long: true }, { type: 'speech', sec: 6.7, startSec: 7.5, tier: 'loud' }, { type: 'pause', sec: 1.8, startSec: 14.2, long: true }, { type: 'speech', sec: 9, startSec: 16, tier: 'soft' }] };

describe('DeliveryRail', () => {
  it('has the Delivery heading, says it is information only, and promises the AI note after feedback', () => {
    render(<DeliveryRail><div>inside</div></DeliveryRail>);
    const rail = screen.getByTestId('delivery-rail');
    expect(within(rail).getByText('Delivery')).toBeTruthy();
    expect(within(rail).getAllByText('Information only')).toHaveLength(1);
    expect(rail.textContent).toMatch(/After you press Get AI Feedback, a short note on how you delivered it appears here/);
    expect(rail.textContent).toMatch(/It does not change your score/);
    expect(within(rail).getByText('inside')).toBeTruthy();
  });
});

describe('SpeakingInsights in the rail', () => {
  it('shows the share of speaking time as one big figure, then both paces, the long pauses and the signal feed', () => {
    render(<SpeakingInsights variant="rail" rate={rate} rhythm={rhythm} />);
    const time = within(screen.getByTestId('insight-time'));
    expect(time.getByText('67')).toBeTruthy();
    expect(screen.getByTestId('insight-time').textContent).toMatch(/16\.7 s of 25\.0 s/);
    expect(within(screen.getByTestId('insight-pace')).getByText('87')).toBeTruthy();
    expect(within(screen.getByTestId('insight-active')).getByText('154')).toBeTruthy();
    expect(screen.getByTestId('insight-pace').textContent).toMatch(/incl\. pauses/);
    expect(screen.getByTestId('insight-active').textContent).toMatch(/while speaking/);
    expect(screen.getByTestId('pace-scale').textContent).toMatch(/No target is set\. Pace is not a grade\./);
    expect(within(screen.getByTestId('pause-list')).getAllByTestId('pause-row').map(r => r.textContent)).toEqual(['00:05 1.9 s', '00:14 1.8 s']);
    const feed = screen.getByTestId('signal-feed');
    expect(feed.textContent).toMatch(/Signal feed/);
    expect(within(feed).getAllByTestId('feed-row')).toHaveLength(5);
    expect(feed.textContent).toMatch(/Speaking ended25\.0 s/);
  });
  it('keeps the wording about where the figures come from, without a Hide details switch or a second Information only', () => {
    render(<SpeakingInsights variant="rail" rate={rate} rhythm={rhythm} />);
    expect(screen.getByTestId('speaking-rate').textContent).toMatch(/Estimated from your transcript and total recording duration/);
    expect(screen.queryByRole('button', { name: /hide details/i })).toBeNull();
    expect(screen.queryByText('Information only')).toBeNull();
  });
  it('draws no timeline in the rail (it sits with the recording) and passes no verdict', () => {
    render(<SpeakingInsights variant="rail" rate={rate} rhythm={rhythm} />);
    expect(screen.queryByRole('img', { name: /timeline/i })).toBeNull();
    expect(screen.getByTestId('speaking-insights').textContent).not.toMatch(/good|bad|pass|fail|fluent|too fast|too slow|ideal|score|\/100/i);
  });
  it('shows dashes, never zeros, and no feed, before there is a measurement', () => {
    render(<SpeakingInsights variant="rail" rate={null} rhythm={null} />);
    for (const k of ['pace', 'active', 'time']) expect(within(screen.getByTestId(`insight-${k}`)).getByText('—')).toBeTruthy();
    expect(screen.queryByTestId('signal-feed')).toBeNull();
  });
});
