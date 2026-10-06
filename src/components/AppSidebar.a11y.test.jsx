// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import AppSidebar from './AppSidebar';

const setup = (props = {}) => {
  const p = { activeModule: 'scan', onNavigate: vi.fn(), user: { name: 'Ann Lee', email: 'ann@x.com' }, onLogout: vi.fn(), collapsed: false, onToggle: vi.fn(), ...props };
  const r = render(<AppSidebar {...p} />);
  return { ...r, p };
};
afterEach(cleanup);

describe('AppSidebar accessibility', () => {
  it('names the main navigation and marks the current page', () => {
    const { container } = setup({ activeModule: 'scan' });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const current = nav.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toMatch(/ATS|Scan/i);
    expect(container.querySelectorAll('.app-sidebar-item:not([aria-current])').length).toBeGreaterThan(0);
  });

  it('gives the collapse button a name and its expanded state', () => {
    const { p } = setup({ collapsed: false });
    const btn = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(btn);
    expect(p.onToggle).toHaveBeenCalled();
  });

  it('keeps every item reachable by name when the sidebar is collapsed (labels are hidden)', () => {
    setup({ collapsed: true });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const b of within(nav).getAllByRole('button')) expect((b.getAttribute('aria-label') || b.textContent).trim().length).toBeGreaterThan(0);
  });

  it('names the sign-out button', () => {
    const { p } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(p.onLogout).toHaveBeenCalled();
  });

  it('hides decorative icons from screen readers', () => {
    const { container } = setup();
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
    svgs.forEach(s => expect(s.getAttribute('aria-hidden')).toBe('true'));
  });

  it('marks the current phone tab and exposes the More drawer as a dialog', () => {
    setup({ activeModule: 'dashboard' });
    const primary = screen.getByRole('navigation', { name: 'Primary' });
    expect(primary.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    const more = within(primary).getByRole('button', { name: /More/ });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('dialog', { name: 'All tools' })).toBeTruthy();
  });

  it('does not add a second bottom navigation (main\'s BottomNav is not used)', () => {
    const { container } = setup();
    expect(container.querySelectorAll('.mob-bottom-nav')).toHaveLength(1);
  });
});
