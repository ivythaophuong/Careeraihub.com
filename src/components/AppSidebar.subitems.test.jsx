// @vitest-environment jsdom
// The parts of a feature sit inside it in the sidebar: Interview Coach opens onto its six parts and each one opens directly.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import AppSidebar from './AppSidebar';

const setup = (props = {}) => {
  const p = { activeModule: 'simulate', activeSub: 'dashboard', onNavigate: vi.fn(), user: { name: 'Ann Lee', email: 'ann@x.com' }, onLogout: vi.fn(), collapsed: false, onToggle: vi.fn(), ...props };
  render(<AppSidebar {...p} />);
  return p;
};
afterEach(cleanup);
const nav = () => within(screen.getByRole('navigation', { name: 'Main' }));
const SUBS = ['Overview', 'Study Modules', 'Live Session', 'Weakness Radar', 'STAR Bank', 'AI Memory'];

describe('sub-items in the sidebar', () => {
  it('shows the six parts under Interview Coach while it is the open feature', () => {
    setup();
    const group = nav().getByRole('group', { name: /Interview Coach sections/i });
    expect(within(group).getAllByRole('button').map(b => b.textContent.trim())).toEqual(SUBS);
  });
  it('marks the part you are in, and only that one as the current page', () => {
    setup({ activeSub: 'session' });
    const group = within(nav().getByRole('group', { name: /Interview Coach sections/i }));
    expect(group.getByRole('button', { name: 'Live Session' }).getAttribute('aria-current')).toBe('page');
    expect(group.getByRole('button', { name: 'Overview' }).getAttribute('aria-current')).toBeNull();
    expect(nav().getAllByRole('button').filter(b => b.getAttribute('aria-current') === 'page')).toHaveLength(1);
  });
  it('opens a part directly: the module and the part are passed together', () => {
    const p = setup();
    fireEvent.click(nav().getByRole('button', { name: 'Weakness Radar' }));
    expect(p.onNavigate).toHaveBeenCalledWith('simulate', 'weakness');
  });
  it('clicking the feature itself opens its first part', () => {
    const p = setup({ activeSub: 'session' });
    fireEvent.click(nav().getByRole('button', { name: /^Interview Coach/ }));
    expect(p.onNavigate).toHaveBeenCalledWith('simulate', 'dashboard');
  });
  it('shows no parts for the other features, and none for Interview Coach when another feature is open', () => {
    setup({ activeModule: 'scan', activeSub: null });
    expect(nav().queryByRole('group', { name: /sections/i })).toBeNull();
    expect(nav().queryByRole('button', { name: 'Live Session' })).toBeNull();
  });
  it('hides the parts when the sidebar is collapsed to icons, and the feature still opens', () => {
    const p = setup({ collapsed: true });
    expect(nav().queryByRole('group', { name: /sections/i })).toBeNull();
    fireEvent.click(nav().getByRole('button', { name: 'Interview Coach' }));
    expect(p.onNavigate).toHaveBeenCalledWith('simulate', 'dashboard');
  });
  it('keeps the parent marked as the open feature while a part is open', () => {
    const { container } = render(<AppSidebar activeModule="simulate" activeSub="starbank" onNavigate={() => {}} user={{ name: 'A' }} onLogout={() => {}} collapsed={false} onToggle={() => {}} />);
    expect(container.querySelector('.app-sidebar-item.active')?.textContent).toMatch(/Interview Coach/);
  });
  it('other features still navigate with just their name', () => {
    const p = setup({ activeModule: 'simulate' });
    fireEvent.click(nav().getByRole('button', { name: /Salary Prep/ }));
    expect(p.onNavigate).toHaveBeenCalledWith('salary', undefined);
  });
});
