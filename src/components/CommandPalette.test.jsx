// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CommandPalette } from './OriginalFeatures';

afterEach(cleanup);
const MODULES = [{ id: 'dashboard', icon: 'D', label: 'Dashboard' }, { id: 'scan', icon: 'S', label: 'ATS Scanner' }, { id: 'salary', icon: 'M', label: 'Salary Prep' }];
const open = (props = {}) => {
  const p = { modules: MODULES, setActiveModule: vi.fn(), setAuthModal: vi.fn(), user: { id: 'u' }, onClose: vi.fn(), ...props };
  render(<CommandPalette {...p} />);
  return p;
};
const input = () => screen.getByRole('combobox');

describe('the command palette can be used with the keyboard alone', () => {
  it('is a labelled dialog with a combobox that owns a listbox of options', () => {
    open();
    expect(screen.getByRole('dialog', { name: /command palette/i })).toBeTruthy();
    expect(input().getAttribute('aria-label')).toBeTruthy();
    expect(input().getAttribute('aria-expanded')).toBe('true');
    const list = screen.getByRole('listbox');
    expect(input().getAttribute('aria-controls')).toBe(list.id);
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('the first option is active at the start and the input says which one', () => {
    open();
    const opts = screen.getAllByRole('option');
    expect(opts[0].getAttribute('aria-selected')).toBe('true');
    expect(input().getAttribute('aria-activedescendant')).toBe(opts[0].id);
  });

  it('ArrowDown and ArrowUp move the active option and wrap around at the ends', () => {
    open();
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[2].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0].getAttribute('aria-selected')).toBe('true');
  });

  it('Enter opens the active option and closes the palette', () => {
    const p = open();
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(p.setActiveModule).toHaveBeenCalledWith('scan');
    expect(p.onClose).toHaveBeenCalledTimes(1);
  });

  it('typing narrows the list and the active option goes back to the first match', () => {
    const p = open();
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.change(input(), { target: { value: 'sal' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(p.setActiveModule).toHaveBeenCalledWith('salary');
  });

  it('Enter with no match does nothing and says nothing was found', () => {
    const p = open();
    fireEvent.change(input(), { target: { value: 'zzzz' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(p.setActiveModule).not.toHaveBeenCalled();
    expect(p.onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/no matches/i)).toBeTruthy();
  });

  it('Escape closes the palette', () => {
    const p = open();
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(p.onClose).toHaveBeenCalledTimes(1);
  });

  it('focus goes back to the control that opened it when it closes', () => {
    const opener = document.createElement('button'); document.body.appendChild(opener); opener.focus();
    const { unmount } = render(<CommandPalette modules={MODULES} setActiveModule={vi.fn()} setAuthModal={vi.fn()} user={{ id: 'u' }} onClose={vi.fn()} />);
    expect(document.activeElement).toBe(input());
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
