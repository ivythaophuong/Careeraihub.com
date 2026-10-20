import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ActionBar from './ActionBar';

afterEach(cleanup);
const show = (props) => render(<ActionBar status="Ready to answer" detail="Type or record your answer." primary={{ label: 'Get AI Feedback', onClick: vi.fn() }} {...props} />);

describe('ActionBar', () => {
  it('shows the status, the detail, and the primary action', () => {
    show();
    expect(screen.getByText('Ready to answer')).toBeTruthy();
    expect(screen.getByText('Type or record your answer.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Get AI Feedback/ })).toBeTruthy();
  });
  it('runs the actions, and a disabled one does nothing', () => {
    const primary = vi.fn(); const secondary = vi.fn();
    show({ primary: { label: 'Go', onClick: primary }, secondary: { label: 'Skip', onClick: secondary } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(primary).toHaveBeenCalledTimes(1); expect(secondary).toHaveBeenCalledTimes(1);
    cleanup();
    const off = vi.fn();
    show({ primary: { label: 'Go', onClick: off, disabled: true } });
    expect(screen.getByRole('button', { name: 'Go' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(off).not.toHaveBeenCalled();
  });
  it('can show more than one secondary action and no primary', () => {
    show({ primary: null, secondary: [{ label: 'One', onClick: vi.fn() }, { label: 'Two', onClick: vi.fn() }] });
    expect(screen.getByRole('button', { name: 'One' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Two' })).toBeTruthy();
  });
  it('is a labelled group and its status is announced politely', () => {
    show();
    expect(screen.getByRole('group', { name: /actions/i })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/Ready to answer/);
  });
});
