import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import AnswerTabs from './AnswerTabs';

afterEach(cleanup);
const show = (props) => render(<AnswerTabs mode="text" onChange={vi.fn()} voiceAvailable voiceUnlocked draftKept={false} {...props} />);

describe('AnswerTabs', () => {
  it('shows Type answer and Voice answer as tabs, the current one selected', () => {
    show({ mode: 'voice' });
    expect(screen.getByRole('tab', { name: /type answer/i }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('tab', { name: /voice answer/i }).getAttribute('aria-selected')).toBe('true');
  });
  it('changes mode when a tab is chosen', () => {
    const onChange = vi.fn();
    show({ onChange });
    fireEvent.click(screen.getByRole('tab', { name: /voice answer/i }));
    expect(onChange).toHaveBeenCalledWith('voice');
    fireEvent.click(screen.getByRole('tab', { name: /type answer/i }));
    expect(onChange).toHaveBeenCalledWith('text');
  });
  it('locks Voice answer until it is unlocked, says why, and does not change mode', () => {
    const onChange = vi.fn();
    show({ voiceUnlocked: false, onChange });
    const tab = screen.getByRole('tab', { name: /voice answer/i });
    expect(tab.getAttribute('aria-disabled')).toBe('true');
    expect(tab.textContent).toMatch(/🔒/);
    fireEvent.click(tab);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/unlocks after you finish one timed round/i)).toBeTruthy();
  });
  it('has no tabs at all when voice is not available: just the heading', () => {
    show({ voiceAvailable: false });
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByText('Your answer')).toBeTruthy();
  });
  it('says the draft is kept on this device only when it is, in plain words', () => {
    show({ draftKept: true });
    expect(screen.getByText(/draft kept on this device/i)).toBeTruthy();
    cleanup();
    show({ draftKept: false });
    expect(screen.queryByText(/draft kept/i)).toBeNull();
  });
});
