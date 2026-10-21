import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import SpeakingInsights from './SpeakingInsights';

afterEach(cleanup);
const rate = { state: 'ok', wpm: 81, words: 82, durationSec: 61 };
const rhythm = { state: 'ok', totalSec: 35.3, speechSec: 22, pauseSec: 13.3, speechPercent: 62, longPauses: 3, longestPauseSec: 2.7, paceWhileSpeakingWpm: 139,
  segments: [{ type: 'speech', sec: 10 }, { type: 'pause', sec: 2.7, long: true }, { type: 'speech', sec: 12 }] };
const tile = (name) => within(screen.getByTestId(`insight-${name}`));

describe('SpeakingInsights', () => {
  it('shows the four figures with plain captions', () => {
    render(<SpeakingInsights rate={rate} rhythm={rhythm} />);
    expect(tile('pace').getByText('81')).toBeTruthy();
    expect(tile('pace').getByText(/incl\. pauses/)).toBeTruthy();
    expect(tile('active').getByText('139')).toBeTruthy();
    expect(tile('active').getByText(/excl\. pauses/)).toBeTruthy();
    expect(tile('time').getByText('22.0 s')).toBeTruthy();
    expect(tile('time').getByText(/of 35\.3 s/)).toBeTruthy();
    expect(tile('pauses').getByText('3')).toBeTruthy();
    expect(tile('pauses').getByText(/longest 2\.7 s/)).toBeTruthy();
  });
  it('shows dashes, never zeros, before there is a recording', () => {
    render(<SpeakingInsights rate={null} rhythm={null} />);
    for (const k of ['pace', 'active', 'time', 'pauses']) expect(tile(k).getByText('—')).toBeTruthy();
    expect(screen.queryByTestId('speaking-rate')).toBeNull();
    expect(screen.queryByTestId('rhythm')).toBeNull();
  });
  it('keeps the speaking rate when the recording was too short for rhythm, and dashes for the rest', () => {
    render(<SpeakingInsights rate={rate} rhythm={{ state: 'unavailable', reason: 'too_short' }} />);
    expect(tile('pace').getByText('81')).toBeTruthy();
    expect(tile('active').getByText('—')).toBeTruthy();
    expect(tile('time').getByText('—')).toBeTruthy();
    expect(screen.getByTestId('speaking-rate').textContent).toMatch(/81 WPM/);
    expect(screen.queryByTestId('rhythm')).toBeNull();
  });
  it('the details open with the timeline and the wording about where the figures come from, and can be closed', () => {
    render(<SpeakingInsights rate={rate} rhythm={rhythm} />);
    const toggle = screen.getByRole('button', { name: /hide details/i });
    expect(screen.getByTestId('speaking-rate').textContent).toMatch(/Estimated Speaking Rate/);
    expect(screen.getByTestId('speaking-rate').textContent).toMatch(/Estimated from your transcript and total recording duration\. Transcription errors and pauses may affect this result\./);
    expect(screen.getByTestId('rhythm').textContent).toMatch(/Measured on your device from how loud your voice was\. Background noise can affect it\./);
    expect(screen.getByRole('img', { name: /timeline/i })).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByTestId('rhythm')).toBeNull();
    expect(screen.getByRole('button', { name: /show details/i }).getAttribute('aria-expanded')).toBe('false');
  });
  it('passes no verdict and shows no score', () => {
    render(<SpeakingInsights rate={rate} rhythm={rhythm} />);
    const t = screen.getByTestId('speaking-insights').textContent;
    expect(t).not.toMatch(/good|bad|pass|fail|fluent|too fast|too slow|ideal|score|\/100/i);
  });
  it('leaves out the active pace when there is none', () => {
    const { paceWhileSpeakingWpm, ...r } = rhythm;
    render(<SpeakingInsights rate={rate} rhythm={r} />);
    expect(tile('active').getByText('—')).toBeTruthy();
  });
});

describe('SpeakingInsights, the fuller layout', () => {
  const fuller = { ...rhythm, segments: [{ type: 'speech', sec: 6, startSec: 0, tier: 'steady' }, { type: 'pause', sec: 2.7, startSec: 6, long: true }, { type: 'speech', sec: 10, startSec: 8.7, tier: 'loud' }, { type: 'pause', sec: 1.4, startSec: 18.7, long: true }, { type: 'speech', sec: 16, startSec: 20.1, tier: 'soft' }] };
  it('says it is information only', () => {
    render(<SpeakingInsights rate={rate} rhythm={fuller} />);
    expect(screen.getByText('Information only')).toBeTruthy();
  });
  it('draws the share of time spent speaking as a row of ticks, without a verdict', () => {
    render(<SpeakingInsights rate={rate} rhythm={fuller} />);
    const ticks = within(screen.getByTestId('insight-time')).getByTestId('time-ticks');
    const on = ticks.querySelectorAll('[data-on="true"]').length;
    expect(ticks.querySelectorAll('span').length).toBe(40);
    expect(on).toBe(Math.round(fuller.speechPercent / 100 * 40));
  });
  it('puts both paces on one scale and says no target is set', () => {
    render(<SpeakingInsights rate={rate} rhythm={fuller} />);
    const scale = screen.getByTestId('pace-scale');
    expect(scale.querySelectorAll('[data-marker]').length).toBe(2);
    expect(scale.textContent).toMatch(/No target is set\. Pace is not a grade\./);
  });
  it('lists each pause of a second or more with when it started and how long it was', () => {
    render(<SpeakingInsights rate={rate} rhythm={fuller} />);
    const list = screen.getByTestId('pause-list');
    expect(within(list).getAllByTestId('pause-row').map(r => r.textContent)).toEqual(['00:06 2.7 s', '00:18 1.4 s']);
  });
  it('leaves the list and the scale out when there is no rhythm', () => {
    render(<SpeakingInsights rate={rate} rhythm={null} />);
    expect(screen.queryByTestId('pause-list')).toBeNull();
    expect(screen.queryByTestId('pace-scale')).toBeNull();
  });
  it('says so when there was no pause of a second or more', () => {
    render(<SpeakingInsights rate={rate} rhythm={{ ...fuller, longPauses: 0, longestPauseSec: 0.4, segments: [{ type: 'speech', sec: 20, startSec: 0, tier: 'steady' }] }} />);
    expect(screen.getByTestId('pause-list').textContent).toMatch(/None of 1 second or more/);
  });
});
